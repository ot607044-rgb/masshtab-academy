"""Calendar availability and public booking.

Revision ID: 018
Revises: 017
Create Date: 2026-10-06 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def timestamps():
    return [
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    ]


def upgrade():
    op.add_column("recruitment_interviews", sa.Column("external_name", sa.String(255)))
    op.add_column("recruitment_interviews", sa.Column("external_contact", sa.String(255)))
    op.create_table(
        "calendar_availability_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("start_minute", sa.Integer(), nullable=False),
        sa.Column("end_minute", sa.Integer(), nullable=False),
        sa.Column("slot_minutes", sa.Integer(), nullable=False, server_default="30"),
        *timestamps(),
    )
    op.create_table(
        "calendar_blocks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(300)),
        *timestamps(),
    )
    op.create_table(
        "calendar_public_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(80), nullable=False, unique=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        *timestamps(),
    )
    for table in ("calendar_availability_rules", "calendar_blocks", "calendar_public_links"):
        op.create_index(f"ix_{table}_company_id", table, ["company_id"])
        op.create_index(f"ix_{table}_user_id", table, ["user_id"])
    op.create_index("ix_calendar_blocks_starts_at", "calendar_blocks", ["starts_at"])
    op.create_index("ix_calendar_public_links_token", "calendar_public_links", ["token"], unique=True)


def downgrade():
    op.drop_table("calendar_public_links")
    op.drop_table("calendar_blocks")
    op.drop_table("calendar_availability_rules")
    op.drop_column("recruitment_interviews", "external_contact")
    op.drop_column("recruitment_interviews", "external_name")
