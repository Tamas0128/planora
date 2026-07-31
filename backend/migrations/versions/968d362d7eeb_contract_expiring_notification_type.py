"""contract_expiring_notification_type

Revision ID: 968d362d7eeb
Revises: 75fc3f1b6369
Create Date: 2026-07-31 09:31:35.709561

"""
from typing import Sequence, Union

from alembic import op

revision: str = '968d362d7eeb'
down_revision: Union[str, None] = '75fc3f1b6369'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres stores the Python Enum *member name* as the label (confirmed via
    # \dT+ notificationtype: OVERDUE_TASK/UPCOMING_PREP/SLIPPING_PROJECT), not
    # .value — ADD VALUE can't run inside the same transaction as its first
    # use, but it's fine to run standalone like this. autocommit_block()
    # ensures it isn't wrapped in the migration's normal transaction, since
    # ALTER TYPE ... ADD VALUE cannot execute inside one.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'CONTRACT_EXPIRING'")


def downgrade() -> None:
    # Postgres has no DROP VALUE for enums — removing a value would require
    # rebuilding the type from scratch. Not worth it for a downgrade path
    # that's never expected to run against data using this value.
    pass
