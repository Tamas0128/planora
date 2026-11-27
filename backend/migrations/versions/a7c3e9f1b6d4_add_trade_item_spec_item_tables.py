"""add project_trade_items and project_spec_items tables

Revision ID: a7c3e9f1b6d4
Revises: d7f4b1c9a052
Create Date: 2026-11-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7c3e9f1b6d4'
down_revision: Union[str, None] = 'd7f4b1c9a052'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'project_trade_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('contractor', sa.String(length=255), nullable=True),
        sa.Column('info', sa.Text(), nullable=True),
        sa.Column('offer_status', sa.String(length=255), nullable=True),
        sa.Column('contract_status', sa.String(length=255), nullable=True),
        sa.Column('material_status', sa.String(length=255), nullable=True),
        sa.Column('expected_timing', sa.String(length=255), nullable=True),
        sa.Column('tig', sa.String(length=255), nullable=True),
        sa.Column('cross_trade_note', sa.Text(), nullable=True),
        sa.Column('extra_work_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_project_trade_items_project_id'), 'project_trade_items', ['project_id'], unique=False
    )

    op.create_table(
        'project_spec_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('group_name', sa.String(length=255), nullable=False),
        sa.Column('label', sa.String(length=500), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_project_spec_items_project_id'), 'project_spec_items', ['project_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_project_spec_items_project_id'), table_name='project_spec_items')
    op.drop_table('project_spec_items')

    op.drop_index(op.f('ix_project_trade_items_project_id'), table_name='project_trade_items')
    op.drop_table('project_trade_items')
