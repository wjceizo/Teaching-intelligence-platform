from __future__ import annotations

from sqlalchemy import Enum, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base
from app.models.common import UUIDPrimaryKeyMixin


class CodeLab(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "codelabs"

    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(32), nullable=False)
    starter_code: Mapped[str] = mapped_column(Text, nullable=False)
    test_script: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[object] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)


class CodeSubmission(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "code_submissions"

    codelab_id: Mapped[str] = mapped_column(
        ForeignKey("codelabs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("pending", "running", "success", "failed", "error", name="code_submission_status", native_enum=False),
        nullable=False,
        default="pending",
    )
    logs: Mapped[str | None] = mapped_column(Text, nullable=True)
    tests_passed: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    tests_total: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    execution_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    submitted_at: Mapped[object] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
