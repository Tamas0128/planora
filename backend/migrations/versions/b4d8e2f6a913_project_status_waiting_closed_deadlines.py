"""project_status_waiting_closed_deadlines

Revision ID: b4d8e2f6a913
Revises: 7f2a4c8e91b3
Create Date: 2026-08-04 09:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'b4d8e2f6a913'
down_revision: Union[str, None] = '7f2a4c8e91b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ADD VALUE can't run inside the same transaction as its first use.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'WAITING'")
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'CLOSED'")

    op.add_column("projects", sa.Column("waiting_deadline", sa.Date(), nullable=True))
    op.add_column("projects", sa.Column("planning_deadline", sa.Date(), nullable=True))
    op.add_column("projects", sa.Column("foundation_deadline", sa.Date(), nullable=True))
    op.add_column("projects", sa.Column("structure_deadline", sa.Date(), nullable=True))
    op.add_column("projects", sa.Column("exterior_done_deadline", sa.Date(), nullable=True))
    op.add_column("projects", sa.Column("turnkey_deadline", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "turnkey_deadline")
    op.drop_column("projects", "exterior_done_deadline")
    op.drop_column("projects", "structure_deadline")
    op.drop_column("projects", "foundation_deadline")
    op.drop_column("projects", "planning_deadline")
    op.drop_column("projects", "waiting_deadline")
    # Postgres has no DROP VALUE for enums — not worth rebuilding the type
    # for a downgrade path that's never expected to run against real data.
