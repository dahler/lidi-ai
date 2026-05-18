from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.middleware.auth import require_admin
from app.models.organization import Organization
from app.models.chatbot import Chatbot
from app.models.user import User, UserRole
from app.models.conversation import Conversation
from app.models.message import Message

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Organizations ──────────────────────────────────────────────────────────

@router.get("/organizations")
async def list_organizations(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Organization).order_by(Organization.created_at.desc())
    )
    orgs = result.scalars().all()

    rows = []
    for o in orgs:
        chatbot_ids_r = await db.execute(
            select(Chatbot.id, Chatbot.is_active).where(
                Chatbot.organization_id == o.id
            )
        )
        cb_rows = chatbot_ids_r.all()
        chatbot_ids = [r[0] for r in cb_rows]
        active_count = sum(1 for r in cb_rows if r[1])

        total_tokens = 0
        if chatbot_ids:
            tok = await db.scalar(
                select(
                    func.coalesce(func.sum(Message.input_tokens), 0)
                    + func.coalesce(func.sum(Message.output_tokens), 0)
                ).join(
                    Conversation, Message.conversation_id == Conversation.id
                ).where(Conversation.chatbot_id.in_(chatbot_ids))
            )
            total_tokens = int(tok or 0)

        rows.append({
            "id": o.id,
            "name": o.name,
            "slug": o.slug,
            "created_at": o.created_at.isoformat(),
            "chatbots": len(chatbot_ids),
            "active_chatbots": active_count,
            "total_tokens": total_tokens,
        })

    return rows


@router.delete(
    "/organizations/{org_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_organization(
    org_id: int,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    await db.delete(org)
    await db.commit()


@router.get("/organizations/{org_id}/stats")
async def get_organization_stats(
    org_id: int,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    chatbot_ids_result = await db.execute(
        select(Chatbot.id).where(Chatbot.organization_id == org_id)
    )
    chatbot_ids = [r[0] for r in chatbot_ids_result.all()]

    if not chatbot_ids:
        return {
            "org_id": org_id,
            "chatbots": 0,
            "conversations": 0,
            "messages": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
        }

    conv_count = await db.scalar(
        select(func.count(Conversation.id)).where(
            Conversation.chatbot_id.in_(chatbot_ids)
        )
    )
    msg_count = await db.scalar(
        select(func.count(Message.id)).join(
            Conversation, Message.conversation_id == Conversation.id
        ).where(Conversation.chatbot_id.in_(chatbot_ids))
    )
    input_tokens = await db.scalar(
        select(func.coalesce(func.sum(Message.input_tokens), 0)).join(
            Conversation, Message.conversation_id == Conversation.id
        ).where(Conversation.chatbot_id.in_(chatbot_ids))
    )
    output_tokens = await db.scalar(
        select(func.coalesce(func.sum(Message.output_tokens), 0)).join(
            Conversation, Message.conversation_id == Conversation.id
        ).where(Conversation.chatbot_id.in_(chatbot_ids))
    )

    return {
        "org_id": org_id,
        "chatbots": len(chatbot_ids),
        "conversations": conv_count or 0,
        "messages": msg_count or 0,
        "input_tokens": int(input_tokens or 0),
        "output_tokens": int(output_tokens or 0),
        "total_tokens": int((input_tokens or 0) + (output_tokens or 0)),
    }


@router.patch("/organizations/{org_id}/chatbots")
async def bulk_update_org_chatbots(
    org_id: int,
    body: dict,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if "is_active" not in body:
        raise HTTPException(status_code=400, detail="is_active field required")

    await db.execute(
        update(Chatbot)
        .where(Chatbot.organization_id == org_id)
        .values(is_active=bool(body["is_active"]))
    )
    await db.commit()

    result = await db.execute(
        select(func.count(Chatbot.id)).where(Chatbot.organization_id == org_id)
    )
    count = result.scalar_one()
    return {"updated": count, "is_active": bool(body["is_active"])}


# ── Users ──────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.id))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "role": u.role.value if u.role else None,
            "organization_id": u.organization_id,
            "is_admin": u.is_admin,
            "created_at": (
                u.created_at.isoformat() if u.created_at else None
            ),
        }
        for u in users
    ]


@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    body: dict,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if "role" in body:
        try:
            user.role = UserRole(body["role"])
            user.is_admin = user.role == UserRole.SUPER_ADMIN
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role: {body['role']}",
            )

    await db.commit()
    await db.refresh(user)
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role.value if user.role else None,
        "organization_id": user.organization_id,
        "is_admin": user.is_admin,
        "created_at": (
            user.created_at.isoformat() if user.created_at else None
        ),
    }


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete your own account",
        )
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()


# ── Chatbots ───────────────────────────────────────────────────────────────

@router.get("/chatbots")
async def list_chatbots(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Chatbot).order_by(Chatbot.created_at.desc())
    )
    chatbots = result.scalars().all()
    return [
        {
            "id": c.id,
            "organization_id": c.organization_id,
            "name": c.name,
            "is_active": c.is_active,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
        }
        for c in chatbots
    ]


@router.patch("/chatbots/{chatbot_id}")
async def update_chatbot(
    chatbot_id: int,
    body: dict,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    chatbot = await db.get(Chatbot, chatbot_id)
    if not chatbot:
        raise HTTPException(status_code=404, detail="Chatbot not found")

    if "is_active" in body:
        chatbot.is_active = bool(body["is_active"])

    await db.commit()
    await db.refresh(chatbot)
    return {
        "id": chatbot.id,
        "organization_id": chatbot.organization_id,
        "name": chatbot.name,
        "is_active": chatbot.is_active,
        "created_at": chatbot.created_at.isoformat(),
        "updated_at": chatbot.updated_at.isoformat(),
    }


@router.delete(
    "/chatbots/{chatbot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_chatbot(
    chatbot_id: int,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    chatbot = await db.get(Chatbot, chatbot_id)
    if not chatbot:
        raise HTTPException(status_code=404, detail="Chatbot not found")
    await db.delete(chatbot)
    await db.commit()


# ── Conversations ──────────────────────────────────────────────────────────

@router.get("/conversations")
async def list_conversations(
    chatbot_id: Optional[int] = None,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Conversation).order_by(
        Conversation.created_at.desc()
    )
    if chatbot_id is not None:
        query = query.where(Conversation.chatbot_id == chatbot_id)

    result = await db.execute(query)
    convs = result.scalars().all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "user_id": c.user_id,
            "chatbot_id": c.chatbot_id,
            "origin": c.origin,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
        }
        for c in convs
    ]


@router.get("/conversations/{conv_id}/messages")
async def get_conversation_messages(
    conv_id: int,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    conv = await db.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


# ── Analytics ──────────────────────────────────────────────────────────────

@router.get("/analytics/origins")
async def analytics_by_origin(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Conversations and messages grouped by origin (source website)."""
    result = await db.execute(
        select(
            Conversation.origin,
            func.count(Conversation.id).label("conversations"),
        )
        .group_by(Conversation.origin)
        .order_by(func.count(Conversation.id).desc())
    )
    rows = result.all()

    out = []
    for origin, conv_count in rows:
        msg_count = await db.scalar(
            select(func.count(Message.id))
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(
                Conversation.origin == origin
                if origin is not None
                else Conversation.origin.is_(None)
            )
        )
        out.append({
            "origin": origin or "(unknown)",
            "conversations": conv_count,
            "messages": msg_count or 0,
        })
    return out


@router.get("/analytics/chatbots")
async def analytics_by_chatbot(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Conversations and token usage grouped by chatbot (API key)."""
    result = await db.execute(
        select(
            Chatbot.id,
            Chatbot.name,
            Chatbot.api_key,
            func.count(Conversation.id).label("conversations"),
        )
        .join(Conversation, Conversation.chatbot_id == Chatbot.id, isouter=True)
        .group_by(Chatbot.id, Chatbot.name, Chatbot.api_key)
        .order_by(func.count(Conversation.id).desc())
    )
    rows = result.all()

    out = []
    for chatbot_id, name, api_key, conv_count in rows:
        msg_count = await db.scalar(
            select(func.count(Message.id))
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(Conversation.chatbot_id == chatbot_id)
        )
        input_tok = await db.scalar(
            select(func.coalesce(func.sum(Message.input_tokens), 0))
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(Conversation.chatbot_id == chatbot_id)
        )
        output_tok = await db.scalar(
            select(func.coalesce(func.sum(Message.output_tokens), 0))
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(Conversation.chatbot_id == chatbot_id)
        )
        out.append({
            "chatbot_id": chatbot_id,
            "name": name,
            "api_key": api_key,
            "conversations": conv_count,
            "messages": msg_count or 0,
            "input_tokens": int(input_tok or 0),
            "output_tokens": int(output_tok or 0),
            "total_tokens": int((input_tok or 0) + (output_tok or 0)),
        })
    return out
