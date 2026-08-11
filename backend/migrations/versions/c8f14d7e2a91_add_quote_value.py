"""add quote value

Revision ID: c8f14d7e2a91
Revises: b7d3e5a9f1c2
Create Date: 2026-08-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c8f14d7e2a91'
down_revision: Union[str, None] = 'b7d3e5a9f1c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('quotes', sa.Column('value', sa.Numeric(precision=14, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column('quotes', 'value')
