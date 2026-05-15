from __future__ import annotations

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, JSON, String, Text, text
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.common import TimestampMixin, UUIDPrimaryKeyMixin


class CodeLab(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "codelabs"

    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), nullable=False, index=True)
    chapter_id: Mapped[str | None] = mapped_column(ForeignKey("chapters.id"), nullable=True, index=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(32), nullable=False)
    starter_code: Mapped[str] = mapped_column(Text, nullable=False)
    solution_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    max_score: Mapped[int] = mapped_column(Integer, nullable=False, default=100, server_default=text("100"))
    time_limit_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=30000)
    memory_limit_mb: Mapped[int] = mapped_column(Integer, nullable=False, default=256)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))

    course: Mapped["Course"] = relationship()
    chapter: Mapped["Chapter | None"] = relationship()
    teacher: Mapped["User"] = relationship()
    test_cases: Mapped[list["CodeLabTestCase"]] = relationship(
        back_populates="codelab",
        cascade="all, delete-orphan",
        order_by="CodeLabTestCase.order_index",
    )
    submissions: Mapped[list["CodeSubmission"]] = relationship(back_populates="codelab", cascade="all, delete-orphan")


class CodeLabTestCase(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "codelab_test_cases"

    codelab_id: Mapped[str] = mapped_column(
        ForeignKey("codelabs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    input_data: Mapped[str] = mapped_column(Text, nullable=False, default="")
    expected_output: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_hidden: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    codelab: Mapped["CodeLab"] = relationship(back_populates="test_cases")


class CodeSubmission(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "code_submissions"

    codelab_id: Mapped[str] = mapped_column(
        ForeignKey("codelabs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    mode: Mapped[str] = mapped_column(
        Enum("run", "submit", name="code_submission_mode", native_enum=False),
        nullable=False,
        default="submit",
    )
    status: Mapped[str] = mapped_column(
        Enum(
            "pending",
            "running",
            "success",
            "failed",
            "error",
            "timeout",
            name="code_submission_status",
            native_enum=False,
        ),
        nullable=False,
        default="pending",
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    max_score: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    logs: Mapped[str | None] = mapped_column(Text, nullable=True)
    tests_passed: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    tests_total: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    result_json: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    execution_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    submitted_at: Mapped[object] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    codelab: Mapped["CodeLab"] = relationship(back_populates="submissions")
    user: Mapped["User"] = relationship()
