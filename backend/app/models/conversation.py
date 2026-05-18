import uuid as uuid_lib
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UUID, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.chatbot import Chatbot
    from app.models.message import Message
    from app.models.user import User


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    uuid: Mapped[uuid_lib.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, default=uuid_lib.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), default="New Chat")
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    chatbot_id: Mapped[int | None] = mapped_column(
        ForeignKey("chatbots.id", ondelete="SET NULL"), nullable=True, index=True
    )
    anonymous_session_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    origin: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User | None"] = relationship(
        "User", back_populates="conversations"
    )
    chatbot: Mapped["Chatbot | None"] = relationship(
        "Chatbot",
        back_populates="conversations",
        foreign_keys=[chatbot_id],
    )
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )
