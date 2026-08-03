"""task_status_text_reminder

Revision ID: 7f2a4c8e91b3
Revises: 5c954e44b3ef
Create Date: 2026-08-03 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '7f2a4c8e91b3'
down_revision: Union[str, None] = '5c954e44b3ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("status_text", sa.String(length=255), nullable=True))
    op.add_column("activities", sa.Column("status_text", sa.String(length=255), nullable=True))
    op.add_column("activities", sa.Column("reminder_date", sa.Date(), nullable=True))
    # ADD VALUE can't run inside the same transaction as its first use.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'TASK_REMINDER'")


def downgrade() -> None:
    op.drop_column("activities", "reminder_date")
    op.drop_column("activities", "status_text")
    op.drop_column("projects", "status_text")
    # Postgres has no DROP VALUE for enums — not worth rebuilding the type
    # for a downgrade path that's never expected to run against real data.
