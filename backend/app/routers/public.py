"""
Public endpoints — no authentication required.
Used by the embeddable widget frontend.
"""
import json
import uuid as uuid_lib
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.database import get_db, async_session_maker
from app.models.chatbot import Chatbot
from app.models.conversation import Conversation
from app.models.document_chunk import DocumentChunk
from app.models.message import Message
from app.services.embedding import EmbeddingService
from app.services.ai import AIService
from app.schemas.chatbot import PublicChatRequest, PublicConfigResponse

router = APIRouter(prefix="/public", tags=["public"])


async def _get_active_chatbot(api_key: str, db: AsyncSession) -> Chatbot:
    result = await db.execute(
        select(Chatbot).where(
            Chatbot.api_key == api_key,
            Chatbot.is_active.is_(True),
        )
    )
    chatbot = result.scalar_one_or_none()
    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found or inactive",
        )
    return chatbot


async def _retrieve_chunks(
    query: str, chatbot_id: int, db: AsyncSession, top_k: int = 5
) -> list[str]:
    # Skip embedding call if no documents are indexed for this chatbot
    count_result = await db.execute(
        select(DocumentChunk.id)
        .where(DocumentChunk.chatbot_id == chatbot_id)
        .limit(1)
    )
    if count_result.scalar_one_or_none() is None:
        return []

    embed_svc = EmbeddingService()
    query_embedding = await embed_svc.embed_text(query)
    if not query_embedding:
        return []

    result = await db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.chatbot_id == chatbot_id)
        .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
        .limit(top_k)
    )
    chunks = result.scalars().all()
    return [c.chunk_text for c in chunks]


@router.get("/config/{api_key}", response_model=PublicConfigResponse)
async def get_chatbot_config(
    api_key: str,
    db: AsyncSession = Depends(get_db),
):
    chatbot = await _get_active_chatbot(api_key, db)
    return PublicConfigResponse(
        id=chatbot.id,
        name=chatbot.name,
        welcome_message=chatbot.welcome_message,
        theme_color=chatbot.theme_color,
    )


@router.post("/chat")
async def public_chat(
    body: PublicChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # 1. Validate chatbot
    chatbot = await _get_active_chatbot(body.api_key, db)

    # 2. Guardrails check
    if chatbot.guardrails_enabled and chatbot.blocked_keywords:
        keywords = [
            k.strip().lower()
            for k in chatbot.blocked_keywords.split(",")
            if k.strip()
        ]
        if any(kw in body.message.lower() for kw in keywords):
            async def _blocked():
                yield f"data: {json.dumps(chatbot.off_topic_message)}\n\n"
            return StreamingResponse(
                _blocked(), media_type="text/event-stream"
            )

    # 3. Get or create conversation by UUID
    conv: Conversation | None = None
    if body.conversation_uuid:
        try:
            parsed_uuid = uuid_lib.UUID(body.conversation_uuid)
            result = await db.execute(
                select(Conversation).where(
                    Conversation.uuid == parsed_uuid,
                    Conversation.chatbot_id == chatbot.id,
                )
            )
            conv = result.scalar_one_or_none()
        except ValueError:
            pass  # malformed UUID — create a fresh conversation

    # Prefer host_origin from the widget body (the actual customer website).
    # The HTTP Origin header would only reflect the widget server's origin.
    raw_origin = (
        body.host_origin
        or request.headers.get("origin")
        or request.headers.get("referer")
    )
    if raw_origin:
        try:
            parsed = urlparse(raw_origin)
            if parsed.netloc:
                request_origin = f"{parsed.scheme}://{parsed.netloc}"
            else:
                request_origin = raw_origin[:255]
        except Exception:
            request_origin = raw_origin[:255]
    else:
        request_origin = None

    if conv is None:
        conv = Conversation(chatbot_id=chatbot.id, origin=request_origin)
        db.add(conv)
        await db.flush()

    conversation_uuid = str(conv.uuid)

    # 4. Retrieve relevant chunks and build the full prompt first,
    #    so input_tokens reflects everything actually sent to the AI.
    chunks = await _retrieve_chunks(body.message, chatbot.id, db)

    base_prompt = chatbot.system_prompt
    if chatbot.guardrails_enabled and chatbot.allowed_topics:
        base_prompt = (
            f"{base_prompt}\n\n"
            f"Only answer questions related to: {chatbot.allowed_topics}. "
            f"For anything else reply: {chatbot.off_topic_message}"
        )
    if chunks:
        context = "\n\n".join(chunks)
        system = (
            f"{base_prompt}\n\nUse the following context to answer:\n{context}"
        )
    else:
        system = base_prompt

    llm_messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": body.message},
    ]

    # Count input tokens across the entire prompt sent to the AI
    input_tokens = max(1, sum(len(m["content"]) for m in llm_messages) // 4)

    # 5. Save user message and touch conversation timestamp
    db.add(
        Message(
            conversation_id=conv.id,
            role="user",
            content=body.message,
            input_tokens=input_tokens,
        )
    )
    conv.updated_at = datetime.now(timezone.utc)
    await db.commit()

    # 7. Stream; persist assistant reply via fresh session after stream ends
    ai_svc = AIService()

    async def _stream():
        meta = json.dumps(
            {"type": "meta", "conversation_uuid": conversation_uuid}
        )
        yield f"data: {meta}\n\n"

        full_response = ""
        async for chunk in ai_svc.generate_response_stream(llm_messages):
            full_response += chunk
            yield f"data: {json.dumps(chunk)}\n\n"

        async with async_session_maker() as save_db:
            save_db.add(
                Message(
                    conversation_id=conv.id,
                    role="assistant",
                    content=full_response,
                    output_tokens=max(1, len(full_response) // 4),
                )
            )
            await save_db.execute(
                update(Conversation)
                .where(Conversation.id == conv.id)
                .values(updated_at=datetime.now(timezone.utc))
            )
            await save_db.commit()

    return StreamingResponse(_stream(), media_type="text/event-stream")
