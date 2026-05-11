"""make notes course optional and searchable

Revision ID: 9a4f13c7b8d2
Revises: 4f1a8b0c9d2e
Create Date: 2026-05-11 00:00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9a4f13c7b8d2"
down_revision: Union[str, Sequence[str], None] = "4f1a8b0c9d2e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "notes",
        "course_id",
        existing_type=sa.String(length=36),
        nullable=True,
    )
    op.create_index(
        "idx_notes_fts",
        "notes",
        [sa.text("to_tsvector('english', coalesce(title, '') || ' ' || content)")],
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("idx_notes_fts", table_name="notes", postgresql_using="gin")
    op.alter_column(
        "notes",
        "course_id",
        existing_type=sa.String(length=36),
        nullable=False,
    )
