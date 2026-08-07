"""add document generator tables (subcontractor_contracts, document_templates, generated_documents)

Revision ID: d4f6a8c1b3e7
Revises: c8f14d7e2a91
Create Date: 2026-08-06 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'd4f6a8c1b3e7'
down_revision: Union[str, None] = 'c8f14d7e2a91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # op.create_table's checkfirst=False means every column carrying an
    # inline sa.Enum unconditionally emits CREATE TYPE unless told
    # otherwise — fine the first time a brand-new enum is introduced
    # (documentfamily, tigdocumentsubtype, generateddocumentstatus,
    # subcontractorcontractstatus below), but every *second* reference to
    # documentfamily/tigdocumentsubtype (generated_documents) and every
    # reference to the already-existing 'vattype'/'buildingtype' (created by
    # earlier, already-applied migrations a4f27c9d1e3b / dd42ae18fb52) must
    # pass create_type=False or Postgres raises "type already exists".
    # create_type is a postgresql.ENUM-only kwarg — sa.Enum (generic,
    # cross-dialect) silently ignores it, so those columns use
    # postgresql.ENUM directly instead of sa.Enum.
    op.create_table(
        'subcontractor_contracts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('partner_id', sa.Integer(), nullable=False),
        sa.Column('contract_number', sa.String(length=50), nullable=False),
        sa.Column('scope_of_work', sa.Text(), nullable=True),
        sa.Column('value', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('vat_type', postgresql.ENUM('STANDARD_27', 'REDUCED_5', 'REVERSE_CHARGE', name='vattype', create_type=False), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('status', sa.Enum('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', name='subcontractorcontractstatus'), nullable=False),
        sa.Column('signed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['partner_id'], ['partners.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('contract_number'),
    )
    op.create_index(op.f('ix_subcontractor_contracts_project_id'), 'subcontractor_contracts', ['project_id'], unique=False)
    op.create_index(op.f('ix_subcontractor_contracts_partner_id'), 'subcontractor_contracts', ['partner_id'], unique=False)
    op.create_index(op.f('ix_subcontractor_contracts_contract_number'), 'subcontractor_contracts', ['contract_number'], unique=True)

    op.create_table(
        'document_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('family', sa.Enum('TIG', 'CLIENT_CONTRACT', 'SUBCONTRACTOR_CONTRACT', name='documentfamily'), nullable=False),
        sa.Column('doc_subtype', sa.Enum('NORMAL', 'HELYESBITO', 'POTMUNKA', name='tigdocumentsubtype'), nullable=False),
        sa.Column('building_type', postgresql.ENUM('LIGHT_STEEL', 'CLT', 'TIMBER_FRAME', 'OTHER', name='buildingtype', create_type=False), nullable=True),
        sa.Column('is_delay_variant', sa.Boolean(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('s3_key', sa.String(length=500), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('uploaded_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_document_templates_family'), 'document_templates', ['family'], unique=False)

    op.create_table(
        'generated_documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('family', postgresql.ENUM('TIG', 'CLIENT_CONTRACT', 'SUBCONTRACTOR_CONTRACT', name='documentfamily', create_type=False), nullable=False),
        sa.Column('source_id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('template_id', sa.Integer(), nullable=False),
        sa.Column('doc_subtype', postgresql.ENUM('NORMAL', 'HELYESBITO', 'POTMUNKA', name='tigdocumentsubtype', create_type=False), nullable=False),
        sa.Column('delay_reason', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'READY', 'FAILED', name='generateddocumentstatus'), nullable=False),
        sa.Column('docx_s3_key', sa.String(length=500), nullable=False),
        sa.Column('pdf_s3_key', sa.String(length=500), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('generated_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['template_id'], ['document_templates.id']),
        sa.ForeignKeyConstraint(['generated_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_generated_documents_family'), 'generated_documents', ['family'], unique=False)
    op.create_index(op.f('ix_generated_documents_project_id'), 'generated_documents', ['project_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_generated_documents_project_id'), table_name='generated_documents')
    op.drop_index(op.f('ix_generated_documents_family'), table_name='generated_documents')
    op.drop_table('generated_documents')

    op.drop_index(op.f('ix_document_templates_family'), table_name='document_templates')
    op.drop_table('document_templates')

    op.drop_index(op.f('ix_subcontractor_contracts_contract_number'), table_name='subcontractor_contracts')
    op.drop_index(op.f('ix_subcontractor_contracts_partner_id'), table_name='subcontractor_contracts')
    op.drop_index(op.f('ix_subcontractor_contracts_project_id'), table_name='subcontractor_contracts')
    op.drop_table('subcontractor_contracts')

    # op.drop_table doesn't drop the Postgres ENUM types it created — left
    # behind, a re-run of upgrade() would fail with "type already exists".
    # 'vattype'/'buildingtype' are NOT dropped here — they're owned by
    # earlier migrations (a4f27c9d1e3b / dd42ae18fb52) and still used by
    # other tables.
    sa.Enum(name='generateddocumentstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='documentfamily').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='tigdocumentsubtype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='subcontractorcontractstatus').drop(op.get_bind(), checkfirst=True)
