"""Recruitment and interview calendar.

Revision ID: 008
Revises: 007
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def timestamps():
    return [sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False)]


def common():
    return [sa.Column("id", UUID(as_uuid=True), primary_key=True), sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)]


def upgrade():
    op.create_table("recruitment_vacancies", *common(), sa.Column("title", sa.String(300), nullable=False), sa.Column("description", sa.Text()), sa.Column("position_id", UUID(as_uuid=True), sa.ForeignKey("positions.id", ondelete="SET NULL")), sa.Column("department_id", UUID(as_uuid=True), sa.ForeignKey("departments.id", ondelete="SET NULL")), sa.Column("status", sa.String(20), nullable=False, server_default="open"), sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")), *timestamps())
    op.create_table("recruitment_candidates", *common(), sa.Column("vacancy_id", UUID(as_uuid=True), sa.ForeignKey("recruitment_vacancies.id", ondelete="SET NULL")), sa.Column("full_name", sa.String(255), nullable=False), sa.Column("email", sa.String(255)), sa.Column("phone", sa.String(50)), sa.Column("source", sa.String(100), nullable=False, server_default="manual"), sa.Column("stage", sa.String(20), nullable=False, server_default="new"), sa.Column("notes", sa.Text()), sa.Column("history", sa.JSON(), nullable=False, server_default=sa.text("'[]'")), sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="SET NULL"), unique=True), *timestamps())
    op.create_table("recruitment_interviews", *common(), sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("recruitment_candidates.id", ondelete="CASCADE"), nullable=False), sa.Column("title", sa.String(300), nullable=False), sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False), sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="30"), sa.Column("meeting_url", sa.String(2048)), sa.Column("notes", sa.Text()), sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")), *timestamps())
    for table in ("recruitment_vacancies", "recruitment_candidates", "recruitment_interviews"):
        op.create_index(f"ix_{table}_company_id", table, ["company_id"])
    op.create_index("ix_recruitment_interviews_starts_at", "recruitment_interviews", ["starts_at"])


def downgrade():
    for table in ("recruitment_interviews", "recruitment_candidates", "recruitment_vacancies"):
        op.drop_table(table)
