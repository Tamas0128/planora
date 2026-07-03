"""site_manager/subcontractor roles + user avatar + project thumbnail

Revision ID: c1a5f6e9b2d4
Revises: 9a18a81a65dc
Create Date: 2026-07-03 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1a5f6e9b2d4'
down_revision: Union[str, None] = '9a18a81a65dc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New enum values must be committed before they can be referenced by any
    # row in this same migration run (Postgres restriction on ALTER TYPE ...
    # ADD VALUE) - fine here since nothing in this migration uses them yet.
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'site_manager'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'subcontractor'")
    op.add_column('users', sa.Column('avatar_key', sa.String(length=500), nullable=True))
    op.add_column('projects', sa.Column('thumbnail_key', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'thumbnail_key')
    op.drop_column('users', 'avatar_key')
    # Postgres has no ALTER TYPE ... DROP VALUE - leaving the enum values in
    # place on downgrade is the standard workaround.
