"""project_second_client_contact

Revision ID: c7e5a2f19d4c
Revises: b4d8e2f6a913
Create Date: 2026-08-04 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c7e5a2f19d4c'
down_revision: Union[str, None] = 'b4d8e2f6a913'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("client_phone_2", sa.String(length=50), nullable=True))
    op.add_column("projects", sa.Column("client_email_2", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "client_email_2")
    op.drop_column("projects", "client_phone_2")
