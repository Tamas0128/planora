"""projekt életciklus: átvétel, építési napló, vevői ajánlat verziók

Revision ID: f1b2c3d4e5f6
Revises: e9a4b5c6d7e8
Create Date: 2026-11-23 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1b2c3d4e5f6'
down_revision: Union[str, None] = 'e9a4b5c6d7e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'atvetelek',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('projekt_id', sa.Integer(), sa.ForeignKey('projektek.id', ondelete='CASCADE'), nullable=False),
        sa.Column('datum', sa.Date(), nullable=False),
        sa.Column('atado_nev', sa.String(255), nullable=False),
        sa.Column('atvevo_nev', sa.String(255), nullable=False),
        sa.Column('hibak', sa.Text(), nullable=True),
        sa.Column('megjegyzes', sa.Text(), nullable=True),
        sa.Column('garancia_honap', sa.Integer(), nullable=False, server_default='24'),
        sa.Column('allapot', sa.Enum('TERVEZET', 'ALAIRT', name='atvetelallapot'), nullable=False),
        sa.Column('alairva_at', sa.DateTime(), nullable=True),
        sa.Column('garancia_lejar', sa.Date(), nullable=True),
        sa.Column('letrehozo_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_atvetelek_projekt_id', 'atvetelek', ['projekt_id'])

    op.create_table(
        'naplo_bejegyzesek',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('projekt_id', sa.Integer(), sa.ForeignKey('projektek.id', ondelete='CASCADE'), nullable=False),
        sa.Column('datum', sa.Date(), nullable=False),
        sa.Column('idojaras', sa.String(100), nullable=True),
        sa.Column('letszam', sa.Integer(), nullable=True),
        sa.Column('munka', sa.Text(), nullable=False),
        sa.Column('megjegyzes', sa.Text(), nullable=True),
        sa.Column('szerzo_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_naplo_bejegyzesek_projekt_id', 'naplo_bejegyzesek', ['projekt_id'])

    op.create_table(
        'naplo_fotok',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('bejegyzes_id', sa.Integer(), sa.ForeignKey('naplo_bejegyzesek.id', ondelete='CASCADE'), nullable=False),
        sa.Column('utvonal', sa.String(255), nullable=False),
        sa.Column('eredeti_nev', sa.String(255), nullable=True),
        sa.Column('tartalom_tipus', sa.String(100), nullable=True),
        sa.Column('meret', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_naplo_fotok_bejegyzes_id', 'naplo_fotok', ['bejegyzes_id'])

    op.create_table(
        'vevoi_ajanlatok',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('projekt_id', sa.Integer(), sa.ForeignKey('projektek.id', ondelete='CASCADE'), nullable=False),
        sa.Column('cim', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_vevoi_ajanlatok_projekt_id', 'vevoi_ajanlatok', ['projekt_id'])

    op.create_table(
        'ajanlat_verziok',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('ajanlat_id', sa.Integer(), sa.ForeignKey('vevoi_ajanlatok.id', ondelete='CASCADE'), nullable=False),
        sa.Column('verzio', sa.Integer(), nullable=False),
        sa.Column('allapot', sa.Enum('TERVEZET', 'ELKULDVE', 'ELFOGADVA', 'ELUTASITVA', name='ajanlatallapot'), nullable=False),
        sa.Column('ervenyes_ig', sa.Date(), nullable=True),
        sa.Column('megjegyzes', sa.Text(), nullable=True),
        sa.Column('netto_osszeg', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('letrehozo_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('ajanlat_id', 'verzio', name='uq_ajanlat_verzio'),
    )
    op.create_index('ix_ajanlat_verziok_ajanlat_id', 'ajanlat_verziok', ['ajanlat_id'])

    op.create_table(
        'ajanlat_sorok',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('verzio_id', sa.Integer(), sa.ForeignKey('ajanlat_verziok.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sorrend', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('megnevezes', sa.String(255), nullable=False),
        sa.Column('mennyiseg', sa.Numeric(12, 3), nullable=False, server_default='1'),
        sa.Column('egyseg', sa.String(30), nullable=True),
        sa.Column('egysegar', sa.Numeric(14, 2), nullable=False, server_default='0'),
    )
    op.create_index('ix_ajanlat_sorok_verzio_id', 'ajanlat_sorok', ['verzio_id'])


def downgrade() -> None:
    op.drop_table('ajanlat_sorok')
    op.drop_table('ajanlat_verziok')
    op.drop_table('vevoi_ajanlatok')
    op.drop_table('naplo_fotok')
    op.drop_table('naplo_bejegyzesek')
    op.drop_table('atvetelek')
    op.execute('DROP TYPE IF EXISTS ajanlatallapot')
    op.execute('DROP TYPE IF EXISTS atvetelallapot')
