import secrets
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.attachment import Attachment
    from app.models.conversation import Conversation
    from app.models.document_chunk import DocumentChunk
    from app.models.organization import Organization


def _gen_api_key() -> str:
    return "bot_" + secrets.token_hex(24)


class Chatbot(Base):
    __tablename__ = "chatbots"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    api_key: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, default=_gen_api_key
    )
    name: Mapped[str] = mapped_column(String(255))
    welcome_message: Mapped[str] = mapped_column(
        Text, default="Hello! How can I help you today?"
    )
    theme_color: Mapped[str] = mapped_column(String(20), default="#6366f1")
    system_prompt: Mapped[str] = mapped_column(
        Text, default="You are a helpful assistant."
    )
    is_active: Mapped[bool] = mapped_column(default=True)

    # Guardrails
    guardrails_enabled: Mapped[bool] = mapped_column(default=False)
    blocked_keywords: Mapped[str] = mapped_column(Text, default="")
    allowed_topics: Mapped[str] = mapped_column(Text, default="")
    off_topic_message: Mapped[str] = mapped_column(
        Text,
        default=(
            "I'm sorry, I can only help with topics related to this service."
        ),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="chatbots"
    )
    attachments: Mapped[list["Attachment"]] = relationship(
        "Attachment",
        back_populates="chatbot",
        cascade="all, delete-orphan",
        foreign_keys="Attachment.chatbot_id",
    )
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        "DocumentChunk",
        back_populates="chatbot",
        cascade="all, delete-orphan",
        foreign_keys="DocumentChunk.chatbot_id",
    )
    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation",
        back_populates="chatbot",
        foreign_keys="Conversation.chatbot_id",
    )
