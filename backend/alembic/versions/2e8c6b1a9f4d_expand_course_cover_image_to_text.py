"""expand course cover_image to text

Revision ID: 2e8c6b1a9f4d
Revises: 7c54278adc01
Create Date: 2026-05-07 20:20:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "2e8c6b1a9f4d"
down_revision: Union[str, Sequence[str], None] = "7c54278adc01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "courses",
        "cover_image",
        existing_type=sa.String(length=512),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "courses",
        "cover_image",
        existing_type=sa.Text(),
        type_=sa.String(length=512),
        existing_nullable=True,
    )
