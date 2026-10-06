"""Owner time zones and durable calendar changes for future synchronization.

Revision ID: 019
Revises: 018
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("calendar_settings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="UTC"),
        sa.Column("buffer_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("company_id", "user_id"),
    )
    op.create_table("calendar_changes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("meeting_id", UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
    )
    for field in ("company_id", "meeting_id", "processed_at"):
        op.create_index(f"ix_calendar_changes_{field}", "calendar_changes", [field])
    for table in ("calendar_blocks", "recruitment_interviews"):
        op.create_index(f"ix_{table}_company_start", table, ["company_id", "starts_at"])
    # Retain the latest live token if earlier requests created duplicates.
    op.execute("""WITH ranked AS (
        SELECT id, row_number() OVER (PARTITION BY company_id, user_id ORDER BY created_at DESC, id DESC) AS n
        FROM calendar_public_links WHERE revoked_at IS NULL
    ) UPDATE calendar_public_links SET revoked_at = now(), enabled = false
      WHERE id IN (SELECT id FROM ranked WHERE n > 1)""")
    op.create_index("uq_calendar_public_link_owner", "calendar_public_links", ["company_id", "user_id"], unique=True, postgresql_where=sa.text("revoked_at IS NULL"))


def downgrade():
    op.drop_index("uq_calendar_public_link_owner", table_name="calendar_public_links")
    for table in ("calendar_blocks", "recruitment_interviews"):
        op.drop_index(f"ix_{table}_company_start", table_name=table)
    op.drop_table("calendar_changes")
    op.drop_table("calendar_settings")
