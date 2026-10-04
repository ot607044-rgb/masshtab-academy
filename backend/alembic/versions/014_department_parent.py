"""Nest departments: optional parent department for the structure map.

Revision ID: 014
Revises: 013
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("departments", sa.Column("parent_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_departments_parent_id", "departments", "departments", ["parent_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_departments_parent_id", "departments", ["parent_id"])


def downgrade():
    op.drop_index("ix_departments_parent_id", table_name="departments")
    op.drop_constraint("fk_departments_parent_id", "departments", type_="foreignkey")
    op.drop_column("departments", "parent_id")
