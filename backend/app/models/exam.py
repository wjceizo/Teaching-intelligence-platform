from __future__ import annotations

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSON, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base
from app.models.common import UUIDPrimaryKeyMixin


class ExamQuestion(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "exam_questions"

    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(
        Enum("single", "multi", "fill", "short", "proof", name="exam_question_type", native_enum=False),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[object] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)


class Exam(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "exams"

    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_score: Mapped[int] = mapped_column(Integer, nullable=False)
    time_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[object | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    end_time: Mapped[object | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    is_shuffled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    status: Mapped[str] = mapped_column(
        Enum("draft", "published", "closed", name="exam_status", native_enum=False),
        nullable=False,
        default="draft",
    )
    created_at: Mapped[object] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)


class ExamAttempt(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "exam_attempts"

    exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    answers: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum("in_progress", "submitted", name="exam_attempt_status", native_enum=False),
        nullable=False,
        default="in_progress",
    )
    started_at: Mapped[object] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    submitted_at: Mapped[object | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
