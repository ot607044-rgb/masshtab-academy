"""007 settings hr constructor

Revision ID: 007
Revises: 006
Create Date: 2026-01-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. funnels
    op.create_table(
        "funnels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "company_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_funnels_company_id", "funnels", ["company_id"])

    # 2. statuses (FK funnels)
    op.create_table(
        "statuses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "company_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "funnel_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("funnels.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("color", sa.String(20), nullable=True, server_default="#6366f1"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_final", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_positive", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_statuses_company_id", "statuses", ["company_id"])

    # 3. custom_sections
    op.create_table(
        "custom_sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "company_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("allowed_roles", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_custom_sections_company_id", "custom_sections", ["company_id"])

    # 4. custom_fields (FK custom_sections)
    op.create_table(
        "custom_fields",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "company_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("field_type", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column(
            "section_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("custom_sections.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("options", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_custom_fields_company_id", "custom_fields", ["company_id"])

    # 5. custom_section_records (FK custom_sections, statuses)
    op.create_table(
        "custom_section_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "section_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("custom_sections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "company_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("data", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "status_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("statuses.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_custom_section_records_section_id", "custom_section_records", ["section_id"])
    op.create_index("ix_custom_section_records_company_id", "custom_section_records", ["company_id"])

    # 6. funnel_stages (FK funnels, statuses)
    op.create_table(
        "funnel_stages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "funnel_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("funnels.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "status_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("statuses.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_funnel_stages_funnel_id", "funnel_stages", ["funnel_id"])

    # 7. integrations
    op.create_table(
        "integrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "company_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("access_token", sa.Text(), nullable=True),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="inactive"),
        sa.Column("settings_data", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_integrations_company_id", "integrations", ["company_id"])

    # 8. external_vacancies (FK integrations)
    op.create_table(
        "external_vacancies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "integration_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("integrations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "company_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("data", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("synced_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_external_vacancies_integration_id", "external_vacancies", ["integration_id"])
    op.create_index("ix_external_vacancies_company_id", "external_vacancies", ["company_id"])

    # 9. external_candidates (FK integrations)
    op.create_table(
        "external_candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "integration_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("integrations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "company_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("data", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("synced_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_external_candidates_integration_id", "external_candidates", ["integration_id"])
    op.create_index("ix_external_candidates_company_id", "external_candidates", ["company_id"])

    # 10. external_responses (FK external_vacancies, external_candidates)
    op.create_table(
        "external_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "integration_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("integrations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "company_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column(
            "vacancy_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("external_vacancies.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "candidate_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("external_candidates.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(50), nullable=True),
        sa.Column("data", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("synced_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_external_responses_integration_id", "external_responses", ["integration_id"])
    op.create_index("ix_external_responses_company_id", "external_responses", ["company_id"])

    # 11. integration_logs (FK integrations)
    op.create_table(
        "integration_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "integration_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("integrations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "company_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_integration_logs_integration_id", "integration_logs", ["integration_id"])
    op.create_index("ix_integration_logs_company_id", "integration_logs", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_integration_logs_company_id", table_name="integration_logs")
    op.drop_index("ix_integration_logs_integration_id", table_name="integration_logs")
    op.drop_table("integration_logs")

    op.drop_index("ix_external_responses_company_id", table_name="external_responses")
    op.drop_index("ix_external_responses_integration_id", table_name="external_responses")
    op.drop_table("external_responses")

    op.drop_index("ix_external_candidates_company_id", table_name="external_candidates")
    op.drop_index("ix_external_candidates_integration_id", table_name="external_candidates")
    op.drop_table("external_candidates")

    op.drop_index("ix_external_vacancies_company_id", table_name="external_vacancies")
    op.drop_index("ix_external_vacancies_integration_id", table_name="external_vacancies")
    op.drop_table("external_vacancies")

    op.drop_index("ix_integrations_company_id", table_name="integrations")
    op.drop_table("integrations")

    op.drop_index("ix_funnel_stages_funnel_id", table_name="funnel_stages")
    op.drop_table("funnel_stages")

    op.drop_index("ix_custom_section_records_company_id", table_name="custom_section_records")
    op.drop_index("ix_custom_section_records_section_id", table_name="custom_section_records")
    op.drop_table("custom_section_records")

    op.drop_index("ix_custom_fields_company_id", table_name="custom_fields")
    op.drop_table("custom_fields")

    op.drop_index("ix_custom_sections_company_id", table_name="custom_sections")
    op.drop_table("custom_sections")

    op.drop_index("ix_statuses_company_id", table_name="statuses")
    op.drop_table("statuses")

    op.drop_index("ix_funnels_company_id", table_name="funnels")
    op.drop_table("funnels")
