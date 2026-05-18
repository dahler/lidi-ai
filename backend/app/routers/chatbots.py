from fastapi import (
    APIRouter, Depends, HTTPException, status,
    BackgroundTasks, UploadFile, File,  # noqa: F401
)
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import require_customer_admin
from app.models.user import User
from app.models.attachment import Attachment
from app.models.document_chunk import DocumentChunk
from app.models.conversation import Conversation
from app.models.message import Message
from app.repositories.chatbot import ChatbotRepository
from app.repositories.organization import OrganizationRepository
from app.schemas.chatbot import (
    ChatbotCreate,
    ChatbotUpdate,
    ChatbotResponse,
)
from app.services.knowledge_graph import KnowledgeGraphService
from app.services.storage import StorageService
from app.config import settings

router = APIRouter(prefix="/chatbots", tags=["chatbots"])


async def _ensure_org(
    user: User, db: AsyncSession
) -> int:
    """Return the user's org id, creating one on first chatbot if needed."""
    if user.organization_id:
        return user.organization_id

    org_repo = OrganizationRepository(db)
    org = await org_repo.create_for_user(
        name=f"{user.name or user.email}'s Workspace"
    )

    # Link user to the new org
    from app.repositories.user import UserRepository
    await UserRepository(db).update(user.id, organization_id=org.id)

    return org.id


@router.post("", response_model=ChatbotResponse)
async def create_chatbot(
    body: ChatbotCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_customer_admin),
):
    org_id = await _ensure_org(current_user, db)
    repo = ChatbotRepository(db)
    chatbot = await repo.create(
        organization_id=org_id,
        name=body.name,
        welcome_message=body.welcome_message,
        theme_color=body.theme_color,
        system_prompt=body.system_prompt,
    )
    return chatbot


@router.get("", response_model=list[ChatbotResponse])
async def list_chatbots(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_customer_admin),
):
    if not current_user.organization_id:
        return []
    repo = ChatbotRepository(db)
    return await repo.get_by_organization(current_user.organization_id)


@router.get("/{chatbot_id}", response_model=ChatbotResponse)
async def get_chatbot(
    chatbot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_customer_admin),
):
    repo = ChatbotRepository(db)
    chatbot = await repo.get_by_id(chatbot_id)
    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found",
        )
    if chatbot.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    return chatbot


@router.put("/{chatbot_id}", response_model=ChatbotResponse)
async def update_chatbot(
    chatbot_id: int,
    body: ChatbotUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_customer_admin),
):
    repo = ChatbotRepository(db)
    chatbot = await repo.get_by_id(chatbot_id)
    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found",
        )
    if chatbot.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    updated = await repo.update(
        chatbot_id, **body.model_dump(exclude_none=True)
    )
    return updated


@router.delete("/{chatbot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chatbot(
    chatbot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_customer_admin),
):
    repo = ChatbotRepository(db)
    chatbot = await repo.get_by_id(chatbot_id)
    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found",
        )
    if chatbot.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    await repo.delete(chatbot_id)


# ── Stats ──────────────────────────────────────────────────────────────────

@router.get("/{chatbot_id}/stats")
async def get_chatbot_stats(
    chatbot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_customer_admin),
):
    repo = ChatbotRepository(db)
    chatbot = await repo.get_by_id(chatbot_id)
    if not chatbot or chatbot.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Chatbot not found")

    conv_count = await db.scalar(
        select(func.count(Conversation.id)).where(
            Conversation.chatbot_id == chatbot_id
        )
    )
    msg_count = await db.scalar(
        select(func.count(Message.id)).join(
            Conversation, Message.conversation_id == Conversation.id
        ).where(Conversation.chatbot_id == chatbot_id)
    )
    doc_count = await db.scalar(
        select(func.count(Attachment.id)).where(
            Attachment.chatbot_id == chatbot_id
        )
    )
    chunk_count = await db.scalar(
        select(func.count(DocumentChunk.id)).where(
            DocumentChunk.chatbot_id == chatbot_id
        )
    )

    input_tokens = await db.scalar(
        select(func.coalesce(func.sum(Message.input_tokens), 0)).join(
            Conversation, Message.conversation_id == Conversation.id
        ).where(Conversation.chatbot_id == chatbot_id)
    )
    output_tokens = await db.scalar(
        select(func.coalesce(func.sum(Message.output_tokens), 0)).join(
            Conversation, Message.conversation_id == Conversation.id
        ).where(Conversation.chatbot_id == chatbot_id)
    )

    return {
        "conversations": conv_count or 0,
        "messages": msg_count or 0,
        "documents": doc_count or 0,
        "chunks": chunk_count or 0,
        "input_tokens": int(input_tokens or 0),
        "output_tokens": int(output_tokens or 0),
        "total_tokens": int((input_tokens or 0) + (output_tokens or 0)),
    }


# ── Documents (per chatbot) ────────────────────────────────────────────────

@router.get("/{chatbot_id}/documents")
async def list_chatbot_documents(
    chatbot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_customer_admin),
):
    repo = ChatbotRepository(db)
    chatbot = await repo.get_by_id(chatbot_id)
    if not chatbot or chatbot.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Chatbot not found")

    result = await db.execute(
        select(Attachment)
        .where(Attachment.chatbot_id == chatbot_id)
        .order_by(Attachment.created_at.desc())
    )
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "filename": d.original_filename,
            "content_type": d.content_type,
            "file_size": d.file_size,
            "created_at": d.created_at.isoformat(),
        }
        for d in docs
    ]


@router.post("/{chatbot_id}/documents")
async def upload_chatbot_document(
    chatbot_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_customer_admin),
):
    repo = ChatbotRepository(db)
    chatbot = await repo.get_by_id(chatbot_id)
    if not chatbot or chatbot.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Chatbot not found")

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max {settings.MAX_FILE_SIZE // (1024*1024)}MB",
        )
    await file.seek(0)

    storage = StorageService()
    file_info = await storage.save_file(file)

    attachment = Attachment(
        filename=file_info["filename"],
        original_filename=file_info["original_filename"],
        content_type=file_info["content_type"],
        file_size=file_info["file_size"],
        file_path=file_info["file_path"],
        user_id=current_user.id,
        chatbot_id=chatbot_id,
        is_company_doc=False,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    kg_service = KnowledgeGraphService(db)
    stats = await kg_service.ingest_document(
        attachment_id=attachment.id,
        user_id=current_user.id,
        is_company_doc=False,
        extract_graph=False,
        chatbot_id=chatbot_id,
    )

    if "error" in stats:
        storage.delete_file(attachment.filename)
        await db.delete(attachment)
        await db.commit()
        raise HTTPException(status_code=500, detail=stats["error"])

    return {
        "id": attachment.id,
        "filename": attachment.original_filename,
        "chunks": stats.get("chunks_created", 0),
    }


@router.delete(
    "/{chatbot_id}/documents/{doc_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_chatbot_document(
    chatbot_id: int,
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_customer_admin),
):
    repo = ChatbotRepository(db)
    chatbot = await repo.get_by_id(chatbot_id)
    if not chatbot or chatbot.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Chatbot not found")

    doc = await db.get(Attachment, doc_id)
    if not doc or doc.chatbot_id != chatbot_id:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.execute(
        delete(DocumentChunk).where(DocumentChunk.attachment_id == doc_id)
    )
    storage = StorageService()
    storage.delete_file(doc.filename)
    await db.delete(doc)
    await db.commit()


# ── Conversations (per chatbot) ────────────────────────────────────────────

@router.get("/{chatbot_id}/conversations")
async def list_chatbot_conversations(
    chatbot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_customer_admin),
):
    repo = ChatbotRepository(db)
    chatbot = await repo.get_by_id(chatbot_id)
    if not chatbot or chatbot.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Chatbot not found")

    result = await db.execute(
        select(Conversation)
        .where(Conversation.chatbot_id == chatbot_id)
        .order_by(Conversation.updated_at.desc())
    )
    convs = result.scalars().all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "origin": c.origin,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
        }
        for c in convs
    ]


@router.get("/{chatbot_id}/conversations/{conv_id}/messages")
async def get_chatbot_conversation_messages(
    chatbot_id: int,
    conv_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_customer_admin),
):
    repo = ChatbotRepository(db)
    chatbot = await repo.get_by_id(chatbot_id)
    if not chatbot or chatbot.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Chatbot not found")

    conv = await db.get(Conversation, conv_id)
    if not conv or conv.chatbot_id != chatbot_id:
        raise HTTPException(
            status_code=404, detail="Conversation not found"
        )

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at)
    )
    msgs = result.scalars().all()
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
        }
        for m in msgs
    ]
