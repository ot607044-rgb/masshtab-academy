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
