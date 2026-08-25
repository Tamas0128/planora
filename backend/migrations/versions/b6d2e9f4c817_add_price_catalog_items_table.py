"""add price_catalog_items table (tételes ártábla, Phase 2)

Revision ID: b6d2e9f4c817
Revises: a3c8f1e0b5d2
Create Date: 2026-08-25 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b6d2e9f4c817'
down_revision: Union[str, None] = 'a3c8f1e0b5d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'price_catalog_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False),
        sa.Column('unit', sa.String(length=20), nullable=False),
        sa.Column('chapter', sa.String(length=255), nullable=False),
        sa.Column('unit_price_material', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('unit_price_labor', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            'source',
            sa.Enum('OWN', 'TERC_IMPORT', name='pricecatalogsource'),
            nullable=False,
        ),
        sa.Column('source_reference', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_price_catalog_items_code'), 'price_catalog_items', ['code'], unique=False)
    op.create_index(
        op.f('ix_price_catalog_items_chapter'), 'price_catalog_items', ['chapter'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_price_catalog_items_chapter'), table_name='price_catalog_items')
    op.drop_index(op.f('ix_price_catalog_items_code'), table_name='price_catalog_items')
    op.drop_table('price_catalog_items')

    sa.Enum(name='pricecatalogsource').drop(op.get_bind(), checkfirst=True)
