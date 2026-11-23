"""jelszó-visszaállítás tokenek és TOTP 2FA mezők

Revision ID: a2c3d4e5f6a7
Revises: f1b2c3d4e5f6
Create Date: 2026-11-23 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a2c3d4e5f6a7'
down_revision: Union[str, None] = 'f1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('totp_secret', sa.String(length=64), nullable=True))
    op.add_column('users', sa.Column('totp_enabled', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('users', sa.Column('totp_utolso_lepes', sa.Integer(), nullable=False, server_default='0'))
    op.create_table(
        'jelszo_visszaallitasok',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('lejar', sa.DateTime(), nullable=False),
        sa.Column('felhasznalva_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_jelszo_visszaallitasok_user_id', 'jelszo_visszaallitasok', ['user_id'])
    op.create_index('ix_jelszo_visszaallitasok_token_hash', 'jelszo_visszaallitasok', ['token_hash'], unique=True)


def downgrade() -> None:
    op.drop_table('jelszo_visszaallitasok')
    op.drop_column('users', 'totp_utolso_lepes')
    op.drop_column('users', 'totp_enabled')
    op.drop_column('users', 'totp_secret')
