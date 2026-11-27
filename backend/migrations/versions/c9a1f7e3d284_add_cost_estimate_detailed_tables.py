"""add cost_estimate_detailed tables (tételes költségvetés, Phase 4)

Revision ID: c9a1f7e3d284
Revises: b6d2e9f4c817
Create Date: 2026-08-25 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c9a1f7e3d284'
down_revision: Union[str, None] = 'b6d2e9f4c817'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'cost_estimate_detailed',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_cost_estimate_detailed_project_id'), 'cost_estimate_detailed', ['project_id'], unique=False
    )

    op.create_table(
        'cost_estimate_detailed_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('estimate_id', sa.Integer(), nullable=False),
        sa.Column('catalog_item_id', sa.Integer(), nullable=True),
        sa.Column('code', sa.String(length=50), nullable=True),
        sa.Column('description', sa.String(length=500), nullable=False),
        sa.Column('unit', sa.String(length=20), nullable=False),
        sa.Column('chapter', sa.String(length=255), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column('unit_price_material', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('unit_price_labor', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['estimate_id'], ['cost_estimate_detailed.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['catalog_item_id'], ['price_catalog_items.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_cost_estimate_detailed_items_estimate_id'),
        'cost_estimate_detailed_items',
        ['estimate_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_cost_estimate_detailed_items_estimate_id'), table_name='cost_estimate_detailed_items'
    )
    op.drop_table('cost_estimate_detailed_items')

    op.drop_index(op.f('ix_cost_estimate_detailed_project_id'), table_name='cost_estimate_detailed')
    op.drop_table('cost_estimate_detailed')
