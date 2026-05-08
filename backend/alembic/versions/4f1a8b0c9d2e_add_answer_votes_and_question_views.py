"""add answer votes and question views

Revision ID: 4f1a8b0c9d2e
Revises: 2e8c6b1a9f4d
Create Date: 2026-05-08 09:40:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "4f1a8b0c9d2e"
down_revision: Union[str, Sequence[str], None] = "2e8c6b1a9f4d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "questions",
        sa.Column("view_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )

    op.create_table(
        "answer_votes",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("answer_id", sa.String(length=36), nullable=False),
        sa.Column("vote", sa.Integer(), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.CheckConstraint("vote IN (-1, 1)", name="ck_answer_votes_vote"),
        sa.ForeignKeyConstraint(["answer_id"], ["answers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "answer_id", name="uq_answer_votes_user_answer"),
    )
    op.create_index(op.f("ix_answer_votes_answer_id"), "answer_votes", ["answer_id"], unique=False)
    op.create_index(op.f("ix_answer_votes_user_id"), "answer_votes", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_answer_votes_user_id"), table_name="answer_votes")
    op.drop_index(op.f("ix_answer_votes_answer_id"), table_name="answer_votes")
    op.drop_table("answer_votes")
    op.drop_column("questions", "view_count")
