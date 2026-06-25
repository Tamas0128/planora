"""add ondelete constraints for activity_dependencies and audit_logs

Revision ID: 69cf170f42ab
Revises: dd42ae18fb52
Create Date: 2026-06-25 07:11:14.178167

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '69cf170f42ab'
down_revision: Union[str, None] = 'dd42ae18fb52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "activity_dependencies_activity_id_fkey", "activity_dependencies", type_="foreignkey"
    )
    op.create_foreign_key(
        "activity_dependencies_activity_id_fkey",
        "activity_dependencies",
        "activities",
        ["activity_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint(
        "activity_dependencies_prerequisite_id_fkey",
        "activity_dependencies",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "activity_dependencies_prerequisite_id_fkey",
        "activity_dependencies",
        "activities",
        ["prerequisite_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint("audit_logs_project_id_fkey", "audit_logs", type_="foreignkey")
    op.create_foreign_key(
        "audit_logs_project_id_fkey",
        "audit_logs",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "activity_dependencies_activity_id_fkey", "activity_dependencies", type_="foreignkey"
    )
    op.create_foreign_key(
        "activity_dependencies_activity_id_fkey",
        "activity_dependencies",
        "activities",
        ["activity_id"],
        ["id"],
    )
    op.drop_constraint(
        "activity_dependencies_prerequisite_id_fkey",
        "activity_dependencies",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "activity_dependencies_prerequisite_id_fkey",
        "activity_dependencies",
        "activities",
        ["prerequisite_id"],
        ["id"],
    )
    op.drop_constraint("audit_logs_project_id_fkey", "audit_logs", type_="foreignkey")
    op.create_foreign_key(
        "audit_logs_project_id_fkey", "audit_logs", "projects", ["project_id"], ["id"]
    )
