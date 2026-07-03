"""fix site_manager/subcontractor enum casing to match SQLAlchemy's name-based storage

Revision ID: d7e4a1c3f890
Revises: c1a5f6e9b2d4
Create Date: 2026-07-03 15:10:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'd7e4a1c3f890'
down_revision: Union[str, None] = 'c1a5f6e9b2d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # sqlalchemy.Enum(SomeEnum) stores the Python member NAME by default
    # (ADMIN, PROJECT_MANAGER, ...), not .value - c1a5f6e9b2d4 mistakenly
    # added the lowercase .value strings instead, which UPDATE/INSERT then
    # rejected with "invalid input value for enum userrole" the moment any
    # activity's responsible_role was actually set to one of them. The
    # lowercase values from that migration are harmless orphans (Postgres
    # has no ALTER TYPE ... DROP VALUE) - just never referenced by the ORM.
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'SITE_MANAGER'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'SUBCONTRACTOR'")


def downgrade() -> None:
    pass
