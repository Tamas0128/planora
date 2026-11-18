"""add szerkezet munkanem csoport

Revision ID: a1f3c9e2b7d4
Revises: 12331ac1d68b
Create Date: 2026-11-18 12:00:00

"""
from typing import Sequence, Union

from alembic import op

revision: str = "a1f3c9e2b7d4"
down_revision: Union[str, None] = "12331ac1d68b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres can't add an enum value inside the same transaction that
    # might use it, so this needs to run outside Alembic's default
    # transactional DDL.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE munkanemcsoport ADD VALUE IF NOT EXISTS 'SZERKEZET'")


def downgrade() -> None:
    # Postgres has no "DROP VALUE" for enums; not reversible without
    # recreating the type, which isn't worth it for a dev-only addition.
    pass
