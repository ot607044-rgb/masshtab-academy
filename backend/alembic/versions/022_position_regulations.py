"""Position regulations (duty variants) and their assignment to employees.

Revision ID: 022
Revises: 021
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("position_regulations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position_id", UUID(as_uuid=True), sa.ForeignKey("positions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("summary", sa.String(255)),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("goal", sa.Text()),
        sa.Column("duties", sa.JSON(), nullable=False),
        sa.Column("updated_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("updated_by_name", sa.String(255)),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_position_regulations_company_id", "position_regulations", ["company_id"])
    op.create_index("ix_position_regulations_position_id", "position_regulations", ["position_id"])
    op.create_table("regulation_assignments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("regulation_id", UUID(as_uuid=True), sa.ForeignKey("position_regulations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("require_ack", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("acknowledged_at", sa.DateTime()),
        sa.Column("assigned_at", sa.DateTime(), nullable=False),
        sa.Column("assigned_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.UniqueConstraint("employee_id", name="uq_regulation_assignments_employee"),
    )
    op.create_index("ix_regulation_assignments_company_id", "regulation_assignments", ["company_id"])
    op.create_index("ix_regulation_assignments_regulation_id", "regulation_assignments", ["regulation_id"])


def downgrade():
    op.drop_table("regulation_assignments")
    op.drop_table("position_regulations")
