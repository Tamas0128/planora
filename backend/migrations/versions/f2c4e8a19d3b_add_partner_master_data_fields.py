"""add partner master-data fields (alvallalkozoi torzs)

Revision ID: f2c4e8a19d3b
Revises: e91a3c7f5b28
Create Date: 2026-08-07 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f2c4e8a19d3b'
down_revision: Union[str, None] = 'e91a3c7f5b28'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('partners', sa.Column('mailing_address', sa.String(length=500), nullable=True))
    op.add_column('partners', sa.Column('company_registry_number', sa.String(length=50), nullable=True))
    op.add_column('partners', sa.Column('bank_account_number', sa.String(length=50), nullable=True))
    op.add_column('partners', sa.Column('representative_name', sa.String(length=255), nullable=True))
    op.add_column('partners', sa.Column('representative_title', sa.String(length=255), nullable=True))
    op.add_column('partners', sa.Column('contact_name', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('partners', 'contact_name')
    op.drop_column('partners', 'representative_title')
    op.drop_column('partners', 'representative_name')
    op.drop_column('partners', 'bank_account_number')
    op.drop_column('partners', 'company_registry_number')
    op.drop_column('partners', 'mailing_address')
