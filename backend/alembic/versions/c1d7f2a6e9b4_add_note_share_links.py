"""add note share links

Revision ID: c1d7f2a6e9b4
Revises: 9a4f13c7b8d2
Create Date: 2026-05-11 00:00:01

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c1d7f2a6e9b4"
down_revision: Union[str, Sequence[str], None] = "9a4f13c7b8d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "note_shares",
        sa.Column("note_id", sa.String(length=36), nullable=False),
        sa.Column("created_by_id", sa.String(length=36), nullable=False),
        sa.Column("token", sa.String(length=96), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_note_shares_created_by_id"), "note_shares", ["created_by_id"], unique=False)
    op.create_index(op.f("ix_note_shares_expires_at"), "note_shares", ["expires_at"], unique=False)
    op.create_index(op.f("ix_note_shares_note_id"), "note_shares", ["note_id"], unique=False)
    op.create_index(op.f("ix_note_shares_token"), "note_shares", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_note_shares_token"), table_name="note_shares")
    op.drop_index(op.f("ix_note_shares_note_id"), table_name="note_shares")
    op.drop_index(op.f("ix_note_shares_expires_at"), table_name="note_shares")
    op.drop_index(op.f("ix_note_shares_created_by_id"), table_name="note_shares")
    op.drop_table("note_shares")
