"""add erdeklodok and kommunikaciok tables

Revision ID: c7d1e2f3a4b5
Revises: ba2a7a83aadf
Create Date: 2026-11-23 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7d1e2f3a4b5'
down_revision: Union[str, None] = 'ba2a7a83aadf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('erdeklodok',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('nev', sa.String(length=255), nullable=False),
    sa.Column('telefon', sa.String(length=50), nullable=True),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('forras', sa.String(length=100), nullable=True),
    sa.Column('allapot', sa.Enum('UJ', 'KAPCSOLATFELVETEL', 'AJANLAT', 'TARGYALAS', 'NYERT', 'ELVESZETT', name='erdeklodesallapot'), nullable=False),
    sa.Column('becsult_ertek', sa.Numeric(precision=14, scale=2), nullable=True),
    sa.Column('megjegyzes', sa.Text(), nullable=True),
    sa.Column('owner_id', sa.Integer(), nullable=True),
    sa.Column('ugyfel_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['ugyfel_id'], ['ugyfelek.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_erdeklodok_nev'), 'erdeklodok', ['nev'], unique=False)
    op.create_table('kommunikaciok',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('ugyfel_id', sa.Integer(), nullable=True),
    sa.Column('erdeklodes_id', sa.Integer(), nullable=True),
    sa.Column('tipus', sa.Enum('HIVAS', 'EMAIL', 'TALALKOZO', 'MEGJEGYZES', name='kommunikaciotipus'), nullable=False),
    sa.Column('datum', sa.DateTime(), nullable=False),
    sa.Column('tartalom', sa.Text(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['erdeklodes_id'], ['erdeklodok.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['ugyfel_id'], ['ugyfelek.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_kommunikaciok_ugyfel_id'), 'kommunikaciok', ['ugyfel_id'], unique=False)
    op.create_index(op.f('ix_kommunikaciok_erdeklodes_id'), 'kommunikaciok', ['erdeklodes_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_kommunikaciok_erdeklodes_id'), table_name='kommunikaciok')
    op.drop_index(op.f('ix_kommunikaciok_ugyfel_id'), table_name='kommunikaciok')
    op.drop_table('kommunikaciok')
    op.drop_index(op.f('ix_erdeklodok_nev'), table_name='erdeklodok')
    op.drop_table('erdeklodok')
    sa.Enum(name='kommunikaciotipus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='erdeklodesallapot').drop(op.get_bind(), checkfirst=True)
