"""expand exams for online assessment

Revision ID: f4b8c2d9a6e1
Revises: e9f2a7c5d3b1
Create Date: 2026-05-15 16:45:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "f4b8c2d9a6e1"
down_revision = "e9f2a7c5d3b1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("exam_questions", sa.Column("chapter_id", sa.String(length=36), nullable=True))
    op.add_column("exam_questions", sa.Column("teacher_id", sa.String(length=36), nullable=True))
    op.add_column("exam_questions", sa.Column("tags", postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column("exam_questions", sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False))
    op.add_column("exam_questions", sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index(op.f("ix_exam_questions_chapter_id"), "exam_questions", ["chapter_id"], unique=False)
    op.create_index(op.f("ix_exam_questions_teacher_id"), "exam_questions", ["teacher_id"], unique=False)
    op.create_foreign_key("fk_exam_questions_chapter_id_chapters", "exam_questions", "chapters", ["chapter_id"], ["id"])
    op.create_foreign_key("fk_exam_questions_teacher_id_users", "exam_questions", "users", ["teacher_id"], ["id"])
    op.alter_column(
        "exam_questions",
        "answer",
        existing_type=sa.Text(),
        type_=postgresql.JSON(astext_type=sa.Text()),
        postgresql_using="to_json(answer)::json",
        existing_nullable=False,
    )

    op.add_column("exams", sa.Column("chapter_id", sa.String(length=36), nullable=True))
    op.add_column("exams", sa.Column("teacher_id", sa.String(length=36), nullable=True))
    op.add_column("exams", sa.Column("pass_score", sa.Integer(), server_default="60", nullable=False))
    op.add_column("exams", sa.Column("time_limit_minutes", sa.Integer(), server_default="30", nullable=False))
    op.add_column("exams", sa.Column("max_attempts", sa.Integer(), server_default="1", nullable=False))
    op.add_column(
        "exams",
        sa.Column(
            "show_result_policy",
            sa.Enum("after_submit", "after_end", "manual", name="exam_result_policy", native_enum=False),
            nullable=False,
            server_default="after_submit",
        ),
    )
    op.add_column("exams", sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False))
    op.execute("UPDATE exams SET time_limit_minutes = time_limit WHERE time_limit IS NOT NULL")
    op.execute("UPDATE exams SET pass_score = GREATEST(1, CAST(ROUND(total_score * 0.6) AS INTEGER)) WHERE total_score IS NOT NULL")
    op.alter_column("exams", "time_limit", existing_type=sa.Integer(), server_default="30", existing_nullable=False)
    op.create_index(op.f("ix_exams_chapter_id"), "exams", ["chapter_id"], unique=False)
    op.create_index(op.f("ix_exams_teacher_id"), "exams", ["teacher_id"], unique=False)
    op.create_foreign_key("fk_exams_chapter_id_chapters", "exams", "chapters", ["chapter_id"], ["id"])
    op.create_foreign_key("fk_exams_teacher_id_users", "exams", "users", ["teacher_id"], ["id"])

    op.create_table(
        "exam_question_in_papers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("exam_id", sa.String(length=36), nullable=False),
        sa.Column("question_id", sa.String(length=36), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["exam_id"], ["exams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["exam_questions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_exam_question_in_papers_exam_id"), "exam_question_in_papers", ["exam_id"], unique=False)
    op.create_index(op.f("ix_exam_question_in_papers_question_id"), "exam_question_in_papers", ["question_id"], unique=False)

    op.add_column("exam_attempts", sa.Column("auto_score", sa.Integer(), server_default="0", nullable=False))
    op.add_column("exam_attempts", sa.Column("manual_score", sa.Integer(), server_default="0", nullable=False))
    op.add_column("exam_attempts", sa.Column("total_score", sa.Integer(), server_default="100", nullable=False))
    op.add_column("exam_attempts", sa.Column("question_order", postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column("exam_attempts", sa.Column("deadline_at", postgresql.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("exam_attempts", sa.Column("last_saved_at", postgresql.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("exam_attempts", sa.Column("graded_at", postgresql.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("exam_attempts", sa.Column("violation_count", sa.Integer(), server_default="0", nullable=False))

    op.create_table(
        "exam_attempt_answers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("attempt_id", sa.String(length=36), nullable=False),
        sa.Column("question_id", sa.String(length=36), nullable=False),
        sa.Column("answer", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("is_correct", sa.Boolean(), nullable=True),
        sa.Column("auto_score", sa.Integer(), nullable=True),
        sa.Column("manual_score", sa.Integer(), nullable=True),
        sa.Column("final_score", sa.Integer(), nullable=True),
        sa.Column("max_score", sa.Integer(), nullable=False),
        sa.Column("teacher_comment", sa.Text(), nullable=True),
        sa.Column("graded_by", sa.String(length=36), nullable=True),
        sa.Column("graded_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["attempt_id"], ["exam_attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["graded_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["question_id"], ["exam_questions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_exam_attempt_answers_attempt_id"), "exam_attempt_answers", ["attempt_id"], unique=False)
    op.create_index(op.f("ix_exam_attempt_answers_graded_by"), "exam_attempt_answers", ["graded_by"], unique=False)
    op.create_index(op.f("ix_exam_attempt_answers_question_id"), "exam_attempt_answers", ["question_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_exam_attempt_answers_question_id"), table_name="exam_attempt_answers")
    op.drop_index(op.f("ix_exam_attempt_answers_graded_by"), table_name="exam_attempt_answers")
    op.drop_index(op.f("ix_exam_attempt_answers_attempt_id"), table_name="exam_attempt_answers")
    op.drop_table("exam_attempt_answers")

    op.drop_column("exam_attempts", "violation_count")
    op.drop_column("exam_attempts", "graded_at")
    op.drop_column("exam_attempts", "last_saved_at")
    op.drop_column("exam_attempts", "deadline_at")
    op.drop_column("exam_attempts", "question_order")
    op.drop_column("exam_attempts", "total_score")
    op.drop_column("exam_attempts", "manual_score")
    op.drop_column("exam_attempts", "auto_score")

    op.drop_index(op.f("ix_exam_question_in_papers_question_id"), table_name="exam_question_in_papers")
    op.drop_index(op.f("ix_exam_question_in_papers_exam_id"), table_name="exam_question_in_papers")
    op.drop_table("exam_question_in_papers")

    op.drop_constraint("fk_exams_teacher_id_users", "exams", type_="foreignkey")
    op.drop_constraint("fk_exams_chapter_id_chapters", "exams", type_="foreignkey")
    op.drop_index(op.f("ix_exams_teacher_id"), table_name="exams")
    op.drop_index(op.f("ix_exams_chapter_id"), table_name="exams")
    op.drop_column("exams", "updated_at")
    op.drop_column("exams", "show_result_policy")
    op.drop_column("exams", "max_attempts")
    op.drop_column("exams", "time_limit_minutes")
    op.drop_column("exams", "pass_score")
    op.drop_column("exams", "teacher_id")
    op.drop_column("exams", "chapter_id")
    op.alter_column("exams", "time_limit", existing_type=sa.Integer(), server_default=None, existing_nullable=False)

    op.alter_column(
        "exam_questions",
        "answer",
        existing_type=postgresql.JSON(astext_type=sa.Text()),
        type_=sa.Text(),
        postgresql_using="answer::text",
        existing_nullable=False,
    )
    op.drop_constraint("fk_exam_questions_teacher_id_users", "exam_questions", type_="foreignkey")
    op.drop_constraint("fk_exam_questions_chapter_id_chapters", "exam_questions", type_="foreignkey")
    op.drop_index(op.f("ix_exam_questions_teacher_id"), table_name="exam_questions")
    op.drop_index(op.f("ix_exam_questions_chapter_id"), table_name="exam_questions")
    op.drop_column("exam_questions", "updated_at")
    op.drop_column("exam_questions", "is_active")
    op.drop_column("exam_questions", "tags")
    op.drop_column("exam_questions", "teacher_id")
    op.drop_column("exam_questions", "chapter_id")
