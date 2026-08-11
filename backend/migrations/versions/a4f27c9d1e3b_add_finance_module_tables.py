"""add finance module tables (partners, tigs, subcontractor/customer invoices)

Revision ID: a4f27c9d1e3b
Revises: be06cdbee2cc
Create Date: 2026-08-05 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a4f27c9d1e3b'
down_revision: Union[str, None] = 'be06cdbee2cc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # op.create_table (unlike op.add_column) auto-CREATEs the Postgres enum
    # type as part of the table DDL, so no explicit sa.Enum(...).create()
    # dance is needed here — that's only required when a migration is the
    # first to introduce a new enum via add_column on an EXISTING table
    # (see the next migration, add_project_financial_fields).
    op.create_table(
        'partners',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('tax_number', sa.String(length=50), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('billing_address', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_partners_name'), 'partners', ['name'], unique=False)

    op.create_table(
        'tigs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('partner_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('net_value', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('vat_type', sa.Enum('STANDARD_27', 'REDUCED_5', 'REVERSE_CHARGE', name='vattype'), nullable=False),
        sa.Column('gross_value', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('status', sa.Enum('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'INVOICED', 'CLOSED', name='tigstatus'), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['partner_id'], ['partners.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_tigs_project_id'), 'tigs', ['project_id'], unique=False)
    op.create_index(op.f('ix_tigs_partner_id'), 'tigs', ['partner_id'], unique=False)

    op.create_table(
        'subcontractor_invoices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('partner_id', sa.Integer(), nullable=False),
        sa.Column('tig_id', sa.Integer(), nullable=True),
        sa.Column('invoice_number', sa.String(length=50), nullable=False),
        sa.Column('performance_date', sa.Date(), nullable=False),
        sa.Column('issue_date', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('payment_date', sa.Date(), nullable=True),
        sa.Column('net_value', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('vat_type', sa.Enum('STANDARD_27', 'REDUCED_5', 'REVERSE_CHARGE', name='vattype'), nullable=False),
        sa.Column('gross_value', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('paid_amount', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('status', sa.Enum('RECEIVED', 'APPROVED', 'AWAITING_PAYMENT', 'PAID', 'OVERDUE', name='subcontractorinvoicestatus'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['partner_id'], ['partners.id']),
        sa.ForeignKeyConstraint(['tig_id'], ['tigs.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('partner_id', 'invoice_number', name='uq_subcontractor_invoice_number'),
    )
    op.create_index(op.f('ix_subcontractor_invoices_project_id'), 'subcontractor_invoices', ['project_id'], unique=False)
    op.create_index(op.f('ix_subcontractor_invoices_partner_id'), 'subcontractor_invoices', ['partner_id'], unique=False)
    op.create_index(op.f('ix_subcontractor_invoices_tig_id'), 'subcontractor_invoices', ['tig_id'], unique=False)

    op.create_table(
        'customer_invoices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('invoice_number', sa.String(length=50), nullable=False),
        sa.Column('issue_date', sa.Date(), nullable=False),
        sa.Column('performance_date', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('payment_received_date', sa.Date(), nullable=True),
        sa.Column('net_value', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('vat_type', sa.Enum('STANDARD_27', 'REDUCED_5', 'REVERSE_CHARGE', name='vattype'), nullable=False),
        sa.Column('gross_value', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('paid_amount', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('status', sa.Enum('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', name='customerinvoicestatus'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invoice_number'),
    )
    op.create_index(op.f('ix_customer_invoices_project_id'), 'customer_invoices', ['project_id'], unique=False)
    op.create_index(op.f('ix_customer_invoices_invoice_number'), 'customer_invoices', ['invoice_number'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_customer_invoices_invoice_number'), table_name='customer_invoices')
    op.drop_index(op.f('ix_customer_invoices_project_id'), table_name='customer_invoices')
    op.drop_table('customer_invoices')

    op.drop_index(op.f('ix_subcontractor_invoices_tig_id'), table_name='subcontractor_invoices')
    op.drop_index(op.f('ix_subcontractor_invoices_partner_id'), table_name='subcontractor_invoices')
    op.drop_index(op.f('ix_subcontractor_invoices_project_id'), table_name='subcontractor_invoices')
    op.drop_table('subcontractor_invoices')

    op.drop_index(op.f('ix_tigs_partner_id'), table_name='tigs')
    op.drop_index(op.f('ix_tigs_project_id'), table_name='tigs')
    op.drop_table('tigs')

    op.drop_index(op.f('ix_partners_name'), table_name='partners')
    op.drop_table('partners')

    # op.drop_table doesn't drop the Postgres ENUM types it created — left
    # behind, a re-run of upgrade() would fail with "type already exists".
    sa.Enum(name='customerinvoicestatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='subcontractorinvoicestatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='tigstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='vattype').drop(op.get_bind(), checkfirst=True)
