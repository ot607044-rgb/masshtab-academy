from io import StringIO

from alembic import command
from alembic.config import Config


def test_fresh_database_creates_employee_enum_once():
    output = StringIO()
    config = Config("alembic.ini", output_buffer=output)
    command.upgrade(config, "head", sql=True)
    sql = output.getvalue()
    assert sql.count("CREATE TYPE employeestatus") == 1
    assert "CREATE TABLE recruitment_candidates" in sql
    assert "ALTER TYPE employeestatus RENAME VALUE 'probation' TO 'PROBATION'" in sql


def test_activation_columns_are_created_only_once():
    output = StringIO()
    command.upgrade(Config("alembic.ini", output_buffer=output), "head", sql=True)
    sql = output.getvalue()
    assert sql.count("ALTER TABLE users ADD COLUMN activated_at") == 1
    assert "ADD COLUMN IF NOT EXISTS activated_at" not in sql
    assert sql.count("ALTER TABLE users ADD COLUMN last_login_at") == 1
    assert "ADD COLUMN IF NOT EXISTS last_login_at" not in sql


def test_downgrading_redundant_revision_preserves_activation_columns():
    output = StringIO()
    command.downgrade(Config("alembic.ini", output_buffer=output), "015:014", sql=True)
    assert "DROP COLUMN" not in output.getvalue()
