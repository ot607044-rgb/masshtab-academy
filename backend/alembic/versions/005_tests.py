"""005 tests and diagnostics

Revision ID: 005
Revises: 004
Create Date: 2025-01-01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("position_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("positions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("topic_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("knowledge_topics.id", ondelete="SET NULL"), nullable=True),
        sa.Column("lesson_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True),
        sa.Column("author_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("passing_score", sa.Integer, nullable=False, server_default="70"),
        sa.Column("max_attempts", sa.Integer, nullable=False, server_default="3"),
        sa.Column("time_limit_minutes", sa.Integer, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_tests_company", "tests", ["company_id"])
    op.create_index("ix_tests_status", "tests", ["status"])

    op.create_table(
        "questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("test_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tests.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("question_type", sa.String(20), nullable=False, server_default="single"),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("explanation", sa.Text, nullable=True),
        sa.Column("points", sa.Integer, nullable=False, server_default="1"),
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_questions_test", "questions", ["test_id"])

    op.create_table(
        "answer_options",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("question_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("is_correct", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
    )

    op.create_table(
        "test_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("test_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tests.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="in_progress"),
        sa.Column("score", sa.Float, nullable=True),
        sa.Column("passed", sa.Boolean, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("time_spent_seconds", sa.Integer, nullable=True),
        sa.Column("auto_assigned_lesson_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_attempts_employee", "test_attempts", ["employee_id"])

    op.create_table(
        "attempt_answers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("attempt_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("question_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("selected_option_ids", postgresql.JSON, nullable=True),
        sa.Column("text_answer", sa.Text, nullable=True),
        sa.Column("is_correct", sa.Boolean, nullable=True),
        sa.Column("points_earned", sa.Float, nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("attempt_answers")
    op.drop_table("test_attempts")
    op.drop_table("answer_options")
    op.drop_table("questions")
    op.drop_table("tests")
