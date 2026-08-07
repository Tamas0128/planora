"""add own_companies table + subcontractor_contracts/tigs header fields

Revision ID: a7d91f3c6e02
Revises: f2c4e8a19d3b
Create Date: 2026-08-07 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7d91f3c6e02'
down_revision: Union[str, None] = 'f2c4e8a19d3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'own_companies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('registered_address', sa.String(length=500), nullable=True),
        sa.Column('mailing_address', sa.String(length=500), nullable=True),
        sa.Column('tax_number', sa.String(length=50), nullable=True),
        sa.Column('company_registry_number', sa.String(length=50), nullable=True),
        sa.Column('bank_account_number', sa.String(length=50), nullable=True),
        sa.Column('representative_name', sa.String(length=255), nullable=True),
        sa.Column('representative_title', sa.String(length=255), nullable=True),
        sa.Column('contact_name', sa.String(length=255), nullable=True),
        sa.Column('contact_email', sa.String(length=255), nullable=True),
        sa.Column('contact_phone', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.add_column('subcontractor_contracts', sa.Column('own_company_id', sa.Integer(), nullable=True))
    op.add_column('subcontractor_contracts', sa.Column('contract_type', sa.String(length=255), nullable=True))
    op.add_column('subcontractor_contracts', sa.Column('currency', sa.String(length=3), server_default='HUF', nullable=False))
    op.add_column('subcontractor_contracts', sa.Column('payment_terms_days', sa.Integer(), nullable=True))
    op.add_column('subcontractor_contracts', sa.Column('payment_method', sa.String(length=255), nullable=True))
    op.add_column('subcontractor_contracts', sa.Column('effective_date', sa.Date(), nullable=True))
    op.create_foreign_key(
        'fk_subcontractor_contracts_own_company_id', 'subcontractor_contracts', 'own_companies',
        ['own_company_id'], ['id'], ondelete='SET NULL',
    )
    op.create_index(
        op.f('ix_subcontractor_contracts_own_company_id'), 'subcontractor_contracts', ['own_company_id'], unique=False
    )

    op.add_column('tigs', sa.Column('subcontractor_contract_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_tigs_subcontractor_contract_id', 'tigs', 'subcontractor_contracts',
        ['subcontractor_contract_id'], ['id'], ondelete='SET NULL',
    )
    op.create_index(
        op.f('ix_tigs_subcontractor_contract_id'), 'tigs', ['subcontractor_contract_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_tigs_subcontractor_contract_id'), table_name='tigs')
    op.drop_constraint('fk_tigs_subcontractor_contract_id', 'tigs', type_='foreignkey')
    op.drop_column('tigs', 'subcontractor_contract_id')

    op.drop_index(op.f('ix_subcontractor_contracts_own_company_id'), table_name='subcontractor_contracts')
    op.drop_constraint('fk_subcontractor_contracts_own_company_id', 'subcontractor_contracts', type_='foreignkey')
    op.drop_column('subcontractor_contracts', 'effective_date')
    op.drop_column('subcontractor_contracts', 'payment_method')
    op.drop_column('subcontractor_contracts', 'payment_terms_days')
    op.drop_column('subcontractor_contracts', 'currency')
    op.drop_column('subcontractor_contracts', 'contract_type')
    op.drop_column('subcontractor_contracts', 'own_company_id')

    op.drop_table('own_companies')
