from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING, List, Optional

from app.database import Base

if TYPE_CHECKING:
    from app.models.message import Message
    from app.models.user import User
    from app.models.document_chunk import DocumentChunk
    from app.models.chatbot import Chatbot


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    message_id: Mapped[int | None] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Multi-tenant isolation: which chatbot owns this document
    chatbot_id: Mapped[int | None] = mapped_column(
        ForeignKey("chatbots.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    is_company_doc: Mapped[bool] = mapped_column(
        Boolean, default=False, index=True
    )
    is_embedded: Mapped[bool] = mapped_column(Boolean, default=False)
    graph_status: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, default=None
    )

    filename: Mapped[str] = mapped_column(String(255))
    original_filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)
    file_path: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    message: Mapped["Message"] = relationship(
        "Message", back_populates="attachments"
    )
    user: Mapped["User"] = relationship("User", back_populates="attachments")
    chatbot: Mapped["Chatbot | None"] = relationship(
        "Chatbot",
        back_populates="attachments",
        foreign_keys="Attachment.chatbot_id",
    )
    chunks: Mapped[List["DocumentChunk"]] = relationship(
        "DocumentChunk",
        back_populates="attachment",
        cascade="all, delete-orphan",
    )

    @property
    def url(self) -> str:
        return f"/api/uploads/{self.filename}"

    @property
    def is_image(self) -> bool:
        return self.content_type.startswith("image/")

    @property
    def is_document(self) -> bool:
        doc_types = {
            "application/pdf",
            "text/plain",
            "text/markdown",
            "application/json",
            "text/html",
        }
        return (
            self.content_type in doc_types
            or self.content_type.startswith("text/")
        )
