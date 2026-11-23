"""projekt koordináták (térkép)

Revision ID: c4e5f6a7b8c9
Revises: b3d4e5f6a7b8
Create Date: 2026-11-23 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4e5f6a7b8c9'
down_revision: Union[str, None] = 'b3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('projektek', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('projektek', sa.Column('longitude', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('projektek', 'longitude')
    op.drop_column('projektek', 'latitude')
