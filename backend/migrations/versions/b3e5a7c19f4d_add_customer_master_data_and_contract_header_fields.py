"""add customer master-data fields (ugyfeltorzs) + contract header fields

Revision ID: b3e5a7c19f4d
Revises: a7d91f3c6e02
Create Date: 2026-08-07 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3e5a7c19f4d'
down_revision: Union[str, None] = 'a7d91f3c6e02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('customers', sa.Column('mailing_address', sa.String(length=500), nullable=True))
    op.add_column('customers', sa.Column('company_registry_number', sa.String(length=50), nullable=True))
    op.add_column('customers', sa.Column('bank_account_number', sa.String(length=50), nullable=True))
    op.add_column('customers', sa.Column('representative_name', sa.String(length=255), nullable=True))
    op.add_column('customers', sa.Column('representative_title', sa.String(length=255), nullable=True))
    op.add_column('customers', sa.Column('contact_name', sa.String(length=255), nullable=True))

    op.add_column('contracts', sa.Column('own_company_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_contracts_own_company_id', 'contracts', 'own_companies',
        ['own_company_id'], ['id'], ondelete='SET NULL',
    )
    op.create_index(op.f('ix_contracts_own_company_id'), 'contracts', ['own_company_id'], unique=False)
    op.add_column('contracts', sa.Column('contract_type', sa.String(length=255), nullable=True))
    op.add_column('contracts', sa.Column('effective_date', sa.Date(), nullable=True))
    # Net values per VAT rate rather than a single value+vat_type pair — a
    # client contract can mix 27% and 5% items (user, 2026-08-07); gross is
    # derived per-bucket at document-generation time, not stored.
    op.add_column('contracts', sa.Column('net_value_standard', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('contracts', sa.Column('net_value_reduced', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('contracts', sa.Column('currency', sa.String(length=3), server_default='HUF', nullable=False))
    op.add_column('contracts', sa.Column('payment_terms_days', sa.Integer(), nullable=True))
    op.add_column('contracts', sa.Column('payment_method', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('contracts', 'payment_method')
    op.drop_column('contracts', 'payment_terms_days')
    op.drop_column('contracts', 'currency')
    op.drop_column('contracts', 'net_value_reduced')
    op.drop_column('contracts', 'net_value_standard')
    op.drop_column('contracts', 'effective_date')
    op.drop_column('contracts', 'contract_type')
    op.drop_index(op.f('ix_contracts_own_company_id'), table_name='contracts')
    op.drop_constraint('fk_contracts_own_company_id', 'contracts', type_='foreignkey')
    op.drop_column('contracts', 'own_company_id')

    op.drop_column('customers', 'contact_name')
    op.drop_column('customers', 'representative_title')
    op.drop_column('customers', 'representative_name')
    op.drop_column('customers', 'bank_account_number')
    op.drop_column('customers', 'company_registry_number')
    op.drop_column('customers', 'mailing_address')
