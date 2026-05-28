"""HR schema: departments, positions, employees, knowledge matrix

Revision ID: 002
Revises: 001
Create Date: 2026-01-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── departments ───────────────────────────────────────────────────────────
    op.create_table(
        "departments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("head_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_departments_company_id", "departments", ["company_id"])

    # ── positions ─────────────────────────────────────────────────────────────
    op.create_table(
        "positions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("required_skills", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_positions_company_id", "positions", ["company_id"])

    # ── employees ─────────────────────────────────────────────────────────────
    employee_status_enum = postgresql.ENUM(
        "active", "probation", "vacation", "fired", name="employeestatus"
    )
    employee_status_enum.create(op.get_bind())

    op.create_table(
        "employees",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("position_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("manager_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "status",
            sa.Enum("active", "probation", "vacation", "fired", name="employeestatus"),
            nullable=False,
            server_default="active",
        ),
        sa.Column("hire_date", sa.Date(), nullable=True),
        sa.Column("weak_areas", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("learning_history", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("test_results", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["position_id"], ["positions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["manager_id"], ["employees.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employees_company_id", "employees", ["company_id"])

    # ── knowledge_topics ──────────────────────────────────────────────────────
    op.create_table(
        "knowledge_topics",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "difficulty_level",
            sa.Enum("basic", "intermediate", "advanced", name="difficultylevel"),
            nullable=False,
            server_default="basic",
        ),
        sa.Column(
            "criticality",
            sa.Enum("low", "medium", "high", "critical", name="criticality"),
            nullable=False,
            server_default="medium",
        ),
        sa.Column("required_knowledge_level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("related_lessons", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("related_tests", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_knowledge_topics_company_id", "knowledge_topics", ["company_id"])

    # ── position_topics (M2M matrix) ──────────────────────────────────────────
    op.create_table(
        "position_topics",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("position_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["position_id"], ["positions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["topic_id"], ["knowledge_topics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_position_topics_company_id", "position_topics", ["company_id"])
    op.create_index("uq_position_topic", "position_topics", ["position_id", "topic_id"], unique=True)


def downgrade() -> None:
    op.drop_table("position_topics")
    op.drop_index("ix_knowledge_topics_company_id", table_name="knowledge_topics")
    op.drop_table("knowledge_topics")
    op.execute("DROP TYPE IF EXISTS difficultylevel")
    op.execute("DROP TYPE IF EXISTS criticality")
    op.drop_index("ix_employees_company_id", table_name="employees")
    op.drop_table("employees")
    op.execute("DROP TYPE IF EXISTS employeestatus")
    op.drop_index("ix_positions_company_id", table_name="positions")
    op.drop_table("positions")
    op.drop_index("ix_departments_company_id", table_name="departments")
    op.drop_table("departments")
