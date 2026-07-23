"""add assignee_id to activities

Revision ID: f3b8c7d2a615
Revises: ecad659235ac
Create Date: 2026-07-23 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f3b8c7d2a615'
down_revision: Union[str, None] = 'ecad659235ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('activities', sa.Column('assignee_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_activities_assignee_id_users', 'activities', 'users',
        ['assignee_id'], ['id'], ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_activities_assignee_id_users', 'activities', type_='foreignkey')
    op.drop_column('activities', 'assignee_id')
