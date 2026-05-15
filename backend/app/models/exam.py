from __future__ import annotations

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSON, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.common import TimestampMixin, UUIDPrimaryKeyMixin


class ExamQuestion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "exam_questions"

    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), nullable=False, index=True)
    chapter_id: Mapped[str | None] = mapped_column(ForeignKey("chapters.id"), nullable=True, index=True)
    teacher_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    type: Mapped[str] = mapped_column(
        Enum("single", "multi", "fill", "short", "proof", name="exam_question_type", native_enum=False),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list[dict[str, object]] | None] = mapped_column(JSON, nullable=True)
    answer: Mapped[object] = mapped_column(JSON, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))

    course: Mapped["Course"] = relationship()
    chapter: Mapped["Chapter | None"] = relationship()
    teacher: Mapped["User | None"] = relationship()


class Exam(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "exams"

    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), nullable=False, index=True)
    chapter_id: Mapped[str | None] = mapped_column(ForeignKey("chapters.id"), nullable=True, index=True)
    teacher_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_score: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    pass_score: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    # Kept for compatibility with the initial schema. New code uses time_limit_minutes.
    time_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    time_limit_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[object | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    end_time: Mapped[object | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_shuffled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    show_result_policy: Mapped[str] = mapped_column(
        Enum("after_submit", "after_end", "manual", name="exam_result_policy", native_enum=False),
        nullable=False,
        default="after_submit",
    )
    status: Mapped[str] = mapped_column(
        Enum("draft", "published", "closed", name="exam_status", native_enum=False),
        nullable=False,
        default="draft",
    )

    course: Mapped["Course"] = relationship()
    chapter: Mapped["Chapter | None"] = relationship()
    teacher: Mapped["User | None"] = relationship()
    paper_questions: Mapped[list["ExamQuestionInPaper"]] = relationship(
        back_populates="exam",
        cascade="all, delete-orphan",
        order_by="ExamQuestionInPaper.order_index",
    )
    attempts: Mapped[list["ExamAttempt"]] = relationship(back_populates="exam", cascade="all, delete-orphan")


class ExamQuestionInPaper(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "exam_question_in_papers"

    exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("exam_questions.id"), nullable=False, index=True)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[object] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    exam: Mapped[Exam] = relationship(back_populates="paper_questions")
    question: Mapped[ExamQuestion] = relationship()


class ExamAttempt(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "exam_attempts"

    exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    answers: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    auto_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    manual_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_score: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    question_order: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum("in_progress", "submitted", "pending_review", "graded", "expired", name="exam_attempt_status", native_enum=False),
        nullable=False,
        default="in_progress",
    )
    started_at: Mapped[object] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    deadline_at: Mapped[object | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    last_saved_at: Mapped[object | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    submitted_at: Mapped[object | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    graded_at: Mapped[object | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    violation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    exam: Mapped[Exam] = relationship(back_populates="attempts")
    user: Mapped["User"] = relationship()
    answer_items: Mapped[list["ExamAttemptAnswer"]] = relationship(
        back_populates="attempt",
        cascade="all, delete-orphan",
    )


class ExamAttemptAnswer(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "exam_attempt_answers"

    attempt_id: Mapped[str] = mapped_column(ForeignKey("exam_attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("exam_questions.id"), nullable=False, index=True)
    answer: Mapped[object | None] = mapped_column(JSON, nullable=True)
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    auto_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    manual_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    final_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_score: Mapped[int] = mapped_column(Integer, nullable=False)
    teacher_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    graded_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    graded_at: Mapped[object | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    updated_at: Mapped[object] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    attempt: Mapped[ExamAttempt] = relationship(back_populates="answer_items")
    question: Mapped[ExamQuestion] = relationship()
    grader: Mapped["User | None"] = relationship(foreign_keys=[graded_by])
