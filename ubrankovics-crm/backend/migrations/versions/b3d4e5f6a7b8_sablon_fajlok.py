"""feltöltött docx sablonfájlok

Revision ID: b3d4e5f6a7b8
Revises: a2c3d4e5f6a7
Create Date: 2026-11-23 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3d4e5f6a7b8'
down_revision: Union[str, None] = 'a2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sablon_fajlok',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tipus', sa.String(30), nullable=False, unique=True),
        sa.Column('utvonal', sa.String(255), nullable=False),
        sa.Column('eredeti_nev', sa.String(255), nullable=False),
        sa.Column('meret', sa.Integer(), nullable=False),
        sa.Column('feltolto_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('sablon_fajlok')
