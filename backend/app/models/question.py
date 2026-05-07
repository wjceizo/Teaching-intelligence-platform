from __future__ import annotations

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base
from app.models.common import UUIDPrimaryKeyMixin


class Question(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "questions"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), nullable=False, index=True)
    chapter_id: Mapped[str | None] = mapped_column(ForeignKey("chapters.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(
        Enum("ai", "teacher", name="question_type", native_enum=False),
        nullable=False,
        default="teacher",
    )
    status: Mapped[str] = mapped_column(
        Enum("open", "resolved", name="question_status", native_enum=False),
        nullable=False,
        default="open",
    )
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    paragraph_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[object] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)


class Answer(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "answers"

    question_id: Mapped[str] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_teacher: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    is_ai: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    upvotes: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    downvotes: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[object] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
