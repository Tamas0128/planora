"""unsubscribe flag + e-mail digest opt-in

Revision ID: e9a4b5c6d7e8
Revises: d8e2f3a4b5c6
Create Date: 2026-11-23 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e9a4b5c6d7e8'
down_revision: Union[str, None] = 'd8e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ugyfelek', sa.Column('leiratkozott', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('ugyfelek', sa.Column('leiratkozasi_token', sa.String(length=64), nullable=True))
    op.create_unique_constraint('uq_ugyfelek_leiratkozasi_token', 'ugyfelek', ['leiratkozasi_token'])
    op.add_column('users', sa.Column('email_ertesites', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('users', sa.Column('utolso_email_ertesites', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'utolso_email_ertesites')
    op.drop_column('users', 'email_ertesites')
    op.drop_constraint('uq_ugyfelek_leiratkozasi_token', 'ugyfelek', type_='unique')
    op.drop_column('ugyfelek', 'leiratkozasi_token')
    op.drop_column('ugyfelek', 'leiratkozott')
