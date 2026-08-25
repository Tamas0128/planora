"""add cost estimate rough tables (rough_estimate_rates, cost_estimate_rough)

Revision ID: a3c8f1e0b5d2
Revises: d9f3c7b2e651
Create Date: 2026-08-25 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3c8f1e0b5d2'
down_revision: Union[str, None] = 'd9f3c7b2e651'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'rough_estimate_rates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column(
            'category',
            sa.Enum(
                'EARTHWORK_FOUNDATION', 'BASEMENT_WALL', 'EXTERIOR_WALL', 'INTERIOR_WALL',
                'WALKABLE_SLAB', 'LIGHT_SLAB', 'ROOF_STRUCTURE', 'ROOF_COVERING',
                'OPENINGS', 'MECHANICAL', 'ELECTRICAL', 'FINISHES',
                name='roughestimatecategory',
            ),
            nullable=False,
        ),
        sa.Column(
            'wall_type',
            sa.Enum('LIGHT_STEEL', 'CLT', 'TIMBER_FRAME', 'BRICK', name='walltype'),
            nullable=True,
        ),
        sa.Column(
            'roof_covering_type',
            sa.Enum('TILE', 'METAL_SHEET', 'SHINGLE', 'FLAT_ROOF', name='roofcoveringtype'),
            nullable=True,
        ),
        sa.Column(
            'foundation_type',
            sa.Enum('STRIP', 'SLAB', 'POINT', name='foundationtype'),
            nullable=True,
        ),
        sa.Column('price_economy', sa.Float(), nullable=False),
        sa.Column('price_standard', sa.Float(), nullable=False),
        sa.Column('price_premium', sa.Float(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'category', 'wall_type', 'roof_covering_type', 'foundation_type',
            name='uq_rough_estimate_rate_variant',
        ),
    )
    op.create_index(
        op.f('ix_rough_estimate_rates_category'), 'rough_estimate_rates', ['category'], unique=False
    )

    op.create_table(
        'cost_estimate_rough',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column(
            'finish_level',
            sa.Enum('ECONOMY', 'STANDARD', 'PREMIUM', name='finishlevel'),
            nullable=False,
        ),
        sa.Column('floor_area_sqm', sa.Float(), nullable=False),
        sa.Column('exterior_wall_fm', sa.Float(), nullable=False),
        sa.Column(
            'exterior_wall_type',
            sa.Enum('LIGHT_STEEL', 'CLT', 'TIMBER_FRAME', 'BRICK', name='walltype'),
            nullable=False,
        ),
        sa.Column('interior_wall_fm', sa.Float(), nullable=False),
        sa.Column(
            'interior_wall_type',
            sa.Enum('LIGHT_STEEL', 'CLT', 'TIMBER_FRAME', 'BRICK', name='walltype'),
            nullable=False,
        ),
        sa.Column('has_basement', sa.Boolean(), nullable=False),
        sa.Column('basement_wall_fm', sa.Float(), nullable=False),
        sa.Column('walkable_slab_sqm', sa.Float(), nullable=False),
        sa.Column('light_slab_sqm', sa.Float(), nullable=False),
        sa.Column('roof_area_sqm', sa.Float(), nullable=False),
        sa.Column(
            'roof_covering_type',
            sa.Enum('TILE', 'METAL_SHEET', 'SHINGLE', 'FLAT_ROOF', name='roofcoveringtype'),
            nullable=False,
        ),
        sa.Column(
            'foundation_type',
            sa.Enum('STRIP', 'SLAB', 'POINT', name='foundationtype'),
            nullable=False,
        ),
        sa.Column('breakdown', sa.JSON(), nullable=False),
        sa.Column('total_net_min', sa.Float(), nullable=False),
        sa.Column('total_net_max', sa.Float(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_cost_estimate_rough_project_id'), 'cost_estimate_rough', ['project_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_cost_estimate_rough_project_id'), table_name='cost_estimate_rough')
    op.drop_table('cost_estimate_rough')

    op.drop_index(op.f('ix_rough_estimate_rates_category'), table_name='rough_estimate_rates')
    op.drop_table('rough_estimate_rates')

    # op.drop_table doesn't drop the Postgres ENUM types it created — left
    # behind, a re-run of upgrade() would fail with "type already exists".
    sa.Enum(name='finishlevel').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='foundationtype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='roofcoveringtype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='walltype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='roughestimatecategory').drop(op.get_bind(), checkfirst=True)
