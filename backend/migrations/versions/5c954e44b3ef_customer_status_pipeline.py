"""customer_status_pipeline

Revision ID: 5c954e44b3ef
Revises: e2b9254f41af
Create Date: 2026-07-31 14:12:43.288814

"""
from typing import Sequence, Union

from alembic import op

revision: str = '5c954e44b3ef'
down_revision: Union[str, None] = 'e2b9254f41af'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Customer.status IS the sales pipeline now (no separate Lead/Opportunity
    # entity — user's simplification, 2026-07-31). ADD VALUE can't run in the
    # same transaction as its first use, so each needs its own
    # autocommit_block(). ACTIVE/INACTIVE are intentionally left in the type
    # (dropping enum values is painful in Postgres) — the app just stops
    # writing them; any pre-existing rows get remapped to their closest
    # pipeline equivalent below.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE customerstatus ADD VALUE IF NOT EXISTS 'NEW'")
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE customerstatus ADD VALUE IF NOT EXISTS 'QUOTE_SENT'")
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE customerstatus ADD VALUE IF NOT EXISTS 'ORDERED'")

    op.execute("UPDATE customers SET status = 'ORDERED' WHERE status = 'ACTIVE'")
    op.execute("UPDATE customers SET status = 'ARCHIVED' WHERE status = 'INACTIVE'")


def downgrade() -> None:
    op.execute("UPDATE customers SET status = 'ACTIVE' WHERE status = 'ORDERED'")
    op.execute("UPDATE customers SET status = 'INQUIRING' WHERE status IN ('NEW', 'QUOTE_SENT')")
    # NEW/QUOTE_SENT/ORDERED values are left in the Postgres enum type on
    # downgrade — removing enum values requires rebuilding the type, not
    # worth it for a downgrade path that's never expected to run for real.
