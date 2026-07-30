"""activity template include_by_default + activity is_archived

Revision ID: a1b2c3d4e5f6
Revises: f3b8c7d2a615
Create Date: 2026-07-30 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f3b8c7d2a615'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'activity_templates',
        sa.Column('include_by_default', sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        'activities',
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('activities', 'is_archived')
    op.drop_column('activity_templates', 'include_by_default')
