from __future__ import annotations

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.common import TimestampMixin, UUIDPrimaryKeyMixin


class Note(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "notes"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    course_id: Mapped[str | None] = mapped_column(ForeignKey("courses.id"), nullable=True, index=True)
    chapter_id: Mapped[str | None] = mapped_column(ForeignKey("chapters.id"), nullable=True, index=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(64)), nullable=False, server_default=text("'{}'"))
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    source_paragraph_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)

    user: Mapped["User"] = relationship(back_populates="notes")
    course: Mapped["Course | None"] = relationship(back_populates="notes")
    chapter: Mapped["Chapter | None"] = relationship(back_populates="notes")
    shares: Mapped[list["NoteShare"]] = relationship(back_populates="note", cascade="all, delete-orphan")


class NoteShare(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "note_shares"

    note_id: Mapped[str] = mapped_column(
        ForeignKey("notes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(96), unique=True, nullable=False, index=True)
    expires_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    created_at: Mapped[object] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)

    note: Mapped["Note"] = relationship(back_populates="shares")
