"""expand codelabs for sandbox scoring

Revision ID: d6a8b4c2e1f0
Revises: c1d7f2a6e9b4
Create Date: 2026-05-13 00:00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "d6a8b4c2e1f0"
down_revision: Union[str, Sequence[str], None] = "c1d7f2a6e9b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("codelabs", sa.Column("chapter_id", sa.String(length=36), nullable=True))
    op.add_column("codelabs", sa.Column("teacher_id", sa.String(length=36), nullable=True))
    op.add_column("codelabs", sa.Column("time_limit_ms", sa.Integer(), nullable=False, server_default="30000"))
    op.add_column("codelabs", sa.Column("memory_limit_mb", sa.Integer(), nullable=False, server_default="256"))
    op.add_column("codelabs", sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column(
        "codelabs",
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.execute("UPDATE codelabs SET teacher_id = courses.teacher_id FROM courses WHERE codelabs.course_id = courses.id")
    op.execute("UPDATE codelabs SET description = '' WHERE description IS NULL")
    op.alter_column("codelabs", "teacher_id", existing_type=sa.String(length=36), nullable=False)
    op.alter_column("codelabs", "description", existing_type=sa.Text(), nullable=False)
    op.create_index(op.f("ix_codelabs_chapter_id"), "codelabs", ["chapter_id"], unique=False)
    op.create_index(op.f("ix_codelabs_teacher_id"), "codelabs", ["teacher_id"], unique=False)
    op.create_foreign_key("fk_codelabs_chapter_id_chapters", "codelabs", "chapters", ["chapter_id"], ["id"])
    op.create_foreign_key("fk_codelabs_teacher_id_users", "codelabs", "users", ["teacher_id"], ["id"])
    op.drop_column("codelabs", "test_script")

    op.create_table(
        "codelab_test_cases",
        sa.Column("codelab_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("input_data", sa.Text(), nullable=False),
        sa.Column("expected_output", sa.Text(), nullable=False),
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["codelab_id"], ["codelabs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_codelab_test_cases_codelab_id"), "codelab_test_cases", ["codelab_id"], unique=False)

    op.add_column(
        "code_submissions",
        sa.Column(
            "mode",
            sa.Enum("run", "submit", name="code_submission_mode", native_enum=False),
            nullable=False,
            server_default="submit",
        ),
    )
    op.add_column("code_submissions", sa.Column("score", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("code_submissions", sa.Column("max_score", sa.Integer(), nullable=False, server_default="0"))
    op.add_column(
        "code_submissions",
        sa.Column("result_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.alter_column(
        "code_submissions",
        "status",
        existing_type=sa.Enum("pending", "running", "success", "failed", "error", name="code_submission_status", native_enum=False),
        type_=sa.Enum(
            "pending",
            "running",
            "success",
            "failed",
            "error",
            "timeout",
            name="code_submission_status",
            native_enum=False,
        ),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "code_submissions",
        "status",
        existing_type=sa.Enum(
            "pending",
            "running",
            "success",
            "failed",
            "error",
            "timeout",
            name="code_submission_status",
            native_enum=False,
        ),
        type_=sa.Enum("pending", "running", "success", "failed", "error", name="code_submission_status", native_enum=False),
        existing_nullable=False,
    )
    op.drop_column("code_submissions", "result_json")
    op.drop_column("code_submissions", "max_score")
    op.drop_column("code_submissions", "score")
    op.drop_column("code_submissions", "mode")

    op.drop_index(op.f("ix_codelab_test_cases_codelab_id"), table_name="codelab_test_cases")
    op.drop_table("codelab_test_cases")

    op.add_column("codelabs", sa.Column("test_script", sa.Text(), nullable=False, server_default=""))
    op.drop_constraint("fk_codelabs_teacher_id_users", "codelabs", type_="foreignkey")
    op.drop_constraint("fk_codelabs_chapter_id_chapters", "codelabs", type_="foreignkey")
    op.drop_index(op.f("ix_codelabs_teacher_id"), table_name="codelabs")
    op.drop_index(op.f("ix_codelabs_chapter_id"), table_name="codelabs")
    op.alter_column("codelabs", "description", existing_type=sa.Text(), nullable=True)
    op.drop_column("codelabs", "updated_at")
    op.drop_column("codelabs", "is_published")
    op.drop_column("codelabs", "memory_limit_mb")
    op.drop_column("codelabs", "time_limit_ms")
    op.drop_column("codelabs", "teacher_id")
    op.drop_column("codelabs", "chapter_id")
