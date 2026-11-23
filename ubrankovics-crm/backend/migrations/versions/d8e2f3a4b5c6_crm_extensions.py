"""crm extensions: audit, custom fields, tags, campaigns, tickets, sales targets

Revision ID: d8e2f3a4b5c6
Revises: c7d1e2f3a4b5
Create Date: 2026-11-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd8e2f3a4b5c6'
down_revision: Union[str, None] = 'c7d1e2f3a4b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('erdeklodok', sa.Column('varhato_lezaras', sa.Date(), nullable=True))

    op.create_table('audit_naplo',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('entitas', sa.String(length=50), nullable=False),
    sa.Column('entitas_id', sa.Integer(), nullable=True),
    sa.Column('muvelet', sa.String(length=50), nullable=False),
    sa.Column('reszletek', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_naplo_entitas'), 'audit_naplo', ['entitas'], unique=False)
    op.create_index(op.f('ix_audit_naplo_created_at'), 'audit_naplo', ['created_at'], unique=False)

    op.create_table('egyedi_mezok',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('entitas', sa.String(length=20), nullable=False),
    sa.Column('nev', sa.String(length=100), nullable=False),
    sa.Column('tipus', sa.String(length=20), nullable=False),
    sa.Column('sorrend', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('entitas', 'nev', name='uq_egyedi_mezo_entitas_nev')
    )
    op.create_table('egyedi_mezo_ertekek',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('mezo_id', sa.Integer(), nullable=False),
    sa.Column('entitas_id', sa.Integer(), nullable=False),
    sa.Column('ertek', sa.Text(), nullable=False),
    sa.ForeignKeyConstraint(['mezo_id'], ['egyedi_mezok.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('mezo_id', 'entitas_id', name='uq_egyedi_mezo_ertek')
    )
    op.create_index(op.f('ix_egyedi_mezo_ertekek_entitas_id'), 'egyedi_mezo_ertekek', ['entitas_id'], unique=False)

    op.create_table('cimkek',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('nev', sa.String(length=100), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('nev')
    )
    op.create_table('ugyfel_cimkek',
    sa.Column('ugyfel_id', sa.Integer(), nullable=False),
    sa.Column('cimke_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['cimke_id'], ['cimkek.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['ugyfel_id'], ['ugyfelek.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('ugyfel_id', 'cimke_id')
    )
    op.create_table('kampanyok',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('nev', sa.String(length=255), nullable=False),
    sa.Column('targy', sa.String(length=255), nullable=False),
    sa.Column('uzenet', sa.Text(), nullable=False),
    sa.Column('cimke_id', sa.Integer(), nullable=True),
    sa.Column('cimzettek_szama', sa.Integer(), nullable=False),
    sa.Column('elkuldve_szama', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['cimke_id'], ['cimkek.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('jegyek',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('ugyfel_id', sa.Integer(), nullable=False),
    sa.Column('projekt_id', sa.Integer(), nullable=True),
    sa.Column('targy', sa.String(length=255), nullable=False),
    sa.Column('leiras', sa.Text(), nullable=True),
    sa.Column('allapot', sa.Enum('NYITOTT', 'FOLYAMATBAN', 'MEGOLDVA', 'LEZART', name='jegyallapot'), nullable=False),
    sa.Column('prioritas', sa.Enum('ALACSONY', 'NORMAL', 'SURGOS', name='jegyprioritas'), nullable=False),
    sa.Column('felelos_id', sa.Integer(), nullable=True),
    sa.Column('letrehozo_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('lezarva_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['felelos_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['letrehozo_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['projekt_id'], ['projektek.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['ugyfel_id'], ['ugyfelek.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_jegyek_ugyfel_id'), 'jegyek', ['ugyfel_id'], unique=False)
    op.create_table('ertekesitesi_celok',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('honap', sa.String(length=7), nullable=False),
    sa.Column('osszeg', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('honap')
    )


def downgrade() -> None:
    op.drop_table('ertekesitesi_celok')
    op.drop_index(op.f('ix_jegyek_ugyfel_id'), table_name='jegyek')
    op.drop_table('jegyek')
    op.drop_table('kampanyok')
    op.drop_table('ugyfel_cimkek')
    op.drop_table('cimkek')
    op.drop_index(op.f('ix_egyedi_mezo_ertekek_entitas_id'), table_name='egyedi_mezo_ertekek')
    op.drop_table('egyedi_mezo_ertekek')
    op.drop_table('egyedi_mezok')
    op.drop_index(op.f('ix_audit_naplo_created_at'), table_name='audit_naplo')
    op.drop_index(op.f('ix_audit_naplo_entitas'), table_name='audit_naplo')
    op.drop_table('audit_naplo')
    op.drop_column('erdeklodok', 'varhato_lezaras')
    sa.Enum(name='jegyprioritas').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='jegyallapot').drop(op.get_bind(), checkfirst=True)
