from __future__ import annotations

from sqlalchemy import Boolean, CheckConstraint, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
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
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    paragraph_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[object] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship(back_populates="questions")
    course: Mapped["Course"] = relationship(back_populates="questions")
    chapter: Mapped["Chapter | None"] = relationship(back_populates="questions")
    answers: Mapped[list["Answer"]] = relationship(back_populates="question", cascade="all, delete-orphan")


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

    question: Mapped["Question"] = relationship(back_populates="answers")
    user: Mapped["User | None"] = relationship(back_populates="answers")
    votes: Mapped[list["AnswerVote"]] = relationship(back_populates="answer", cascade="all, delete-orphan")


class AnswerVote(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "answer_votes"
    __table_args__ = (
        UniqueConstraint("user_id", "answer_id", name="uq_answer_votes_user_answer"),
        CheckConstraint("vote IN (-1, 1)", name="ck_answer_votes_vote"),
    )

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    answer_id: Mapped[str] = mapped_column(
        ForeignKey("answers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    vote: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[object] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[object] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="answer_votes")
    answer: Mapped["Answer"] = relationship(back_populates="votes")
