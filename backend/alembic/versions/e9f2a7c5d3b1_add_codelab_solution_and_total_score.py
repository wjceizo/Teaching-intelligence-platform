"""add codelab solution and total score

Revision ID: e9f2a7c5d3b1
Revises: d6a8b4c2e1f0
Create Date: 2026-05-15 00:00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "e9f2a7c5d3b1"
down_revision: Union[str, Sequence[str], None] = "d6a8b4c2e1f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("codelabs", sa.Column("solution_code", sa.Text(), nullable=True))
    op.add_column("codelabs", sa.Column("max_score", sa.Integer(), nullable=False, server_default="100"))
    op.execute("UPDATE codelabs SET max_score = 100 WHERE max_score IS NULL")


def downgrade() -> None:
    op.drop_column("codelabs", "max_score")
    op.drop_column("codelabs", "solution_code")
