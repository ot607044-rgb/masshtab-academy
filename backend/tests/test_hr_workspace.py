import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.main import app
from app.database import Base, get_db
from app.api.deps import get_current_user
from app.models import Company, User, Employee, Position, Lesson, LessonAssignment, Test as AcademyTest, TestAttempt as AcademyAttempt
from app.models.lesson import LessonStatus


@pytest_asyncio.fixture
async def context():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        company = Company(id=uuid.uuid4(), name="Test", slug="test", is_active=True)
        other = Company(id=uuid.uuid4(), name="Other", slug="other", is_active=True)
        db.add_all([company, other])
        await db.flush()
        user = User(id=uuid.uuid4(), company_id=company.id, email="hr@example.org", full_name="HR", hashed_password="unused", role="hr")
        foreign_position = Position(id=uuid.uuid4(), company_id=other.id, name="Foreign")
        employee = Employee(id=uuid.uuid4(), company_id=company.id, full_name="Employee", weak_areas=[])
        db.add_all([user, foreign_position, employee])
        await db.commit()

        async def database():
            yield db

        app.dependency_overrides[get_db] = database
        app.dependency_overrides[get_current_user] = lambda: user
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            yield client, db, user, employee, foreign_position
        app.dependency_overrides.clear()
    await engine.dispose()


async def create_candidate(client):
    vacancy = await client.post("/api/v1/recruitment/vacancies", json={"title": "Sales manager"})
    assert vacancy.status_code == 201, vacancy.text
    candidate = await client.post("/api/v1/recruitment/candidates", json={"full_name": "Applicant", "vacancy_id": vacancy.json()["id"], "email": "applicant@example.org"})
    assert candidate.status_code == 201, candidate.text
    return candidate.json()


@pytest.mark.asyncio
async def test_employee_photo_upload_replace_read_delete_and_private_storage(context, tmp_path, monkeypatch):
    from io import BytesIO
    from PIL import Image
    from app.config import settings
    client, db, user, employee, _ = context
    monkeypatch.setattr(settings, "UPLOADS_DIR", str(tmp_path))
    photo = BytesIO()
    Image.new("RGB", (600, 800), "red").save(photo, "PNG")
    url = f"/api/v1/employees/{employee.id}/photo"
    uploaded = await client.post(url, files={"file": ("../../photo.png", photo.getvalue(), "image/png")})
    assert uploaded.status_code == 200, uploaded.text
    assert uploaded.json()["photo_url"].startswith(url)
    await db.refresh(employee)
    first = tmp_path / ".employee-photos" / str(user.company_id) / str(employee.id) / employee.photo_filename
    assert first.is_file()
    assert (await client.get(f"/uploads/.employee-photos/{user.company_id}/{employee.id}/{employee.photo_filename}")).status_code == 404
    downloaded = await client.get(url)
    assert downloaded.status_code == 200 and downloaded.headers["content-type"] == "image/jpeg"
    assert downloaded.headers["cache-control"] == "private, no-store"
    with Image.open(BytesIO(downloaded.content)) as image:
        assert max(image.size) <= 512
    assert (await client.post(url, files={"file": ("photo.png", photo.getvalue(), "image/png")})).status_code == 200
    assert not first.exists()
    await db.refresh(employee)
    second = first.parent / employee.photo_filename
    assert second.is_file()
    assert (await client.delete(url)).status_code == 200
    assert not second.exists()
    assert (await client.get(url)).status_code == 404
    assert (await client.get(f"/api/v1/employees/{employee.id}")).json()["photo_url"] is None


@pytest.mark.asyncio
async def test_employee_photo_rejects_invalid_upload_and_foreign_company(context):
    client, _, user, employee, foreign_position = context
    url = f"/api/v1/employees/{employee.id}/photo"
    invalid = {"file": ("fake.png", b"<script>not an image</script>", "image/png")}
    assert (await client.post(url, files=invalid)).status_code == 400
    assert (await client.post(url, files={"file": ("huge.png", b"x" * (5 * 1024 * 1024 + 1), "image/png")})).status_code == 413
    user.company_id = foreign_position.company_id
    assert (await client.get(url)).status_code == 403
    assert (await client.post(url, files=invalid)).status_code == 403
    assert (await client.delete(url)).status_code == 403
    user.company_id = employee.company_id
    user.role = "employee"
    assert (await client.post(url, files=invalid)).status_code == 403
    assert (await client.delete(url)).status_code == 403


@pytest.mark.asyncio
async def test_employee_profile_edit_persists_and_preserves_learning(context):
    from app.models.department import Department
    client, db, user, employee, _ = context
    department = Department(id=uuid.uuid4(), company_id=user.company_id, name="Own")
    position = Position(id=uuid.uuid4(), company_id=user.company_id, name="Own", department_id=department.id)
    db.add_all([department, position])
    employee.email = "old@example.org"
    employee.phone = "123"
    employee.weak_areas = ["Taxes"]
    employee.learning_history = [{"lesson": "Completed"}]
    employee.test_results = {"score": 55}
    await db.commit()
    url = f"/api/v1/employees/{employee.id}"
    changed = await client.patch(url, json={"full_name": "Updated", "department_id": str(department.id), "position_id": str(position.id), "status": "vacation", "hire_date": "2026-10-01", "email": None, "phone": None})
    assert changed.status_code == 200, changed.text
    saved = (await client.get(url)).json()
    assert saved["full_name"] == "Updated" and saved["status"] == "vacation"
    assert saved["department_id"] == str(department.id) and saved["position_id"] == str(position.id)
    assert saved["email"] is None and saved["phone"] is None
    assert saved["weak_areas"] == ["Taxes"] and saved["test_results"] == {"score": 55}
    assert saved["learning_history"] == [{"lesson": "Completed"}]
    cleared = await client.patch(url, json={"department_id": None, "position_id": None, "hire_date": None})
    assert cleared.status_code == 200
    assert all(cleared.json()[key] is None for key in ["department_id", "position_id", "hire_date"])
    assert cleared.json()["status"] == "vacation"


@pytest.mark.asyncio
async def test_employee_profile_edit_company_and_role_guards(context):
    client, db, user, employee, foreign_position = context
    url = f"/api/v1/employees/{employee.id}"
    assert (await client.patch(url, json={"position_id": str(foreign_position.id)})).status_code == 404
    assert (await client.patch(url, json={"department_id": str(uuid.uuid4())})).status_code == 404
    user.company_id = foreign_position.company_id
    assert (await client.patch(url, json={"status": "fired"})).status_code == 403
    user.company_id = employee.company_id
    user.role = "employee"
    employee.user_id = user.id
    await db.flush()
    assert (await client.patch(url, json={"status": "active"})).status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [{"full_name": ""}, {"full_name": "  "}, {"full_name": None}, {"full_name": "x" * 256}, {"status": None}, {"status": "invalid"}, {"phone": "1" * 51}])
async def test_employee_profile_edit_rejects_invalid_data(context, payload):
    client, _, _, employee, _ = context
    assert (await client.patch(f"/api/v1/employees/{employee.id}", json=payload)).status_code == 422


@pytest.mark.asyncio
async def test_department_edit_persists_and_preserves_employee_and_position(context):
    from app.models.department import Department
    client, db, user, employee, _ = context
    department = Department(id=uuid.uuid4(), company_id=user.company_id, name="Finance", description="Old", head_id=employee.id)
    position = Position(id=uuid.uuid4(), company_id=user.company_id, name="Accountant", department_id=department.id)
    db.add_all([department, position])
    await db.flush()
    employee.department_id = department.id
    await db.commit()
    url = f"/api/v1/departments/{department.id}"
    response = await client.patch(url, json={"name": "Accounting", "description": None, "head_id": None})
    assert response.status_code == 200, response.text
    saved = (await client.get(url)).json()
    assert saved["name"] == "Accounting"
    assert saved["description"] is None and saved["head_id"] is None
    await db.refresh(employee)
    await db.refresh(position)
    assert employee.department_id == position.department_id == department.id


@pytest.mark.asyncio
async def test_department_edit_company_and_role_guards(context):
    from app.models.department import Department
    client, db, user, _, foreign_position = context
    department = Department(id=uuid.uuid4(), company_id=user.company_id, name="Own")
    foreign = Department(id=uuid.uuid4(), company_id=foreign_position.company_id, name="Foreign")
    foreign_head = Employee(id=uuid.uuid4(), company_id=foreign_position.company_id, full_name="Foreign head")
    db.add_all([department, foreign, foreign_head])
    await db.commit()
    assert (await client.patch(f"/api/v1/departments/{foreign.id}", json={"name": "Wrong"})).status_code == 403
    assert (await client.patch(f"/api/v1/departments/{department.id}", json={"head_id": str(foreign_head.id)})).status_code == 404
    user.role = "employee"
    assert (await client.patch(f"/api/v1/departments/{department.id}", json={"name": "Wrong"})).status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["", "   ", None, "x" * 256])
async def test_department_edit_rejects_invalid_name(context, name):
    from app.models.department import Department
    client, db, user, *_ = context
    department = Department(id=uuid.uuid4(), company_id=user.company_id, name="Own")
    db.add(department)
    await db.commit()
    assert (await client.patch(f"/api/v1/departments/{department.id}", json={"name": name})).status_code == 422


@pytest.mark.asyncio
async def test_position_edit_persists_and_clears_optional_fields(context):
    from app.models.department import Department
    client, db, user, employee, _ = context
    department = Department(id=uuid.uuid4(), company_id=user.company_id, name="Finance")
    position = Position(id=uuid.uuid4(), company_id=user.company_id, name="Accountant", description="Old", department_id=department.id, required_skills=["Excel"])
    db.add_all([department, position])
    await db.flush()
    employee.position_id = position.id
    await db.commit()
    url = f"/api/v1/positions/{position.id}"
    response = await client.patch(url, json={"name": "Chief accountant", "description": None, "department_id": None, "required_skills": []})
    assert response.status_code == 200, response.text
    saved = (await client.get(url)).json()
    assert saved["name"] == "Chief accountant"
    assert saved["description"] is None
    assert saved["department_id"] is None
    assert saved["required_skills"] == []
    await db.refresh(employee)
    assert employee.position_id == position.id


@pytest.mark.asyncio
async def test_position_edit_rejects_foreign_department_and_company(context):
    from app.models.department import Department
    client, db, user, _, foreign_position = context
    position = Position(id=uuid.uuid4(), company_id=user.company_id, name="Own")
    department = Department(id=uuid.uuid4(), company_id=foreign_position.company_id, name="Foreign")
    db.add_all([position, department])
    await db.commit()
    assert (await client.patch(f"/api/v1/positions/{position.id}", json={"department_id": str(department.id)})).status_code == 404
    assert (await client.patch(f"/api/v1/positions/{foreign_position.id}", json={"name": "Wrong"})).status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["", "   ", None, "x" * 256])
async def test_position_edit_rejects_invalid_name(context, name):
    client, db, user, *_ = context
    position = Position(id=uuid.uuid4(), company_id=user.company_id, name="Own")
    db.add(position)
    await db.commit()
    assert (await client.patch(f"/api/v1/positions/{position.id}", json={"name": name})).status_code == 422


@pytest.mark.asyncio
async def test_employee_cannot_edit_position(context):
    client, db, user, *_ = context
    position = Position(id=uuid.uuid4(), company_id=user.company_id, name="Own")
    db.add(position)
    await db.commit()
    user.role = "employee"
    assert (await client.patch(f"/api/v1/positions/{position.id}", json={"name": "Wrong"})).status_code == 403


@pytest.mark.asyncio
async def test_candidate_stage_and_history_persist(context):
    client, *_ = context
    candidate = await create_candidate(client)
    response = await client.patch(f"/api/v1/recruitment/candidates/{candidate['id']}", json={"stage": "interview"})
    assert response.status_code == 200
    result = (await client.get(f"/api/v1/recruitment/candidates/{candidate['id']}")).json()
    assert result["stage"] == "interview"
    assert result["history"][-1]["stage"] == "interview"


@pytest.mark.asyncio
async def test_company_isolation_and_foreign_references(context):
    client, db, user, _, foreign_position = context
    response = await client.post("/api/v1/recruitment/vacancies", json={"title": "Wrong", "position_id": str(foreign_position.id)})
    assert response.status_code == 404
    candidate = await create_candidate(client)
    user.company_id = foreign_position.company_id
    assert (await client.get("/api/v1/recruitment/candidates")).json() == []
    assert (await client.patch(f"/api/v1/recruitment/candidates/{candidate['id']}", json={"stage": "offer"})).status_code == 404


@pytest.mark.asyncio
async def test_hiring_is_idempotent_and_preserves_history(context):
    client, *_ = context
    candidate = await create_candidate(client)
    url = f"/api/v1/recruitment/candidates/{candidate['id']}/hire"
    assert (await client.post(url, json={"hire_date": "2026-10-05"})).status_code == 409
    await client.patch(f"/api/v1/recruitment/candidates/{candidate['id']}", json={"stage": "offer"})
    first = await client.post(url, json={"hire_date": "2026-10-05"})
    second = await client.post(url, json={"hire_date": "2026-10-05"})
    assert first.status_code == second.status_code == 200
    assert first.json()["employee_id"] == second.json()["employee_id"]
    detail = (await client.get(f"/api/v1/workspace/employees/{first.json()['employee_id']}")).json()
    assert detail["recruitment_history"][-1]["stage"] == "hired"


@pytest.mark.asyncio
async def test_interview_is_in_calendar_and_requires_timezone(context):
    client, *_ = context
    candidate = await create_candidate(client)
    payload = {"candidate_id": candidate["id"], "title": "Interview", "starts_at": "2026-10-05T10:00:00+05:00", "duration_minutes": 30}
    assert (await client.post("/api/v1/recruitment/interviews", json={**payload, "starts_at": "2026-10-05T10:00:00"})).status_code == 422
    response = await client.post("/api/v1/recruitment/interviews", json=payload)
    assert response.status_code == 201, response.text
    events = (await client.get("/api/v1/recruitment/interviews", params={"start": "2026-10-01T00:00:00Z", "end": "2026-11-01T00:00:00Z"})).json()
    assert events[0]["candidate_name"] == "Applicant"
    assert (await client.delete(f"/api/v1/recruitment/interviews/{response.json()['id']}")).status_code == 204
    assert (await client.get("/api/v1/recruitment/interviews")).json() == []


@pytest.mark.asyncio
async def test_calendar_meeting_can_be_created_without_candidate(context):
    client, db, user, *_ = context
    participant = User(id=uuid.uuid4(), company_id=user.company_id, email="lead@example.org", full_name="Lead", hashed_password="unused", role="department_head")
    db.add(participant)
    await db.commit()

    payload = {
        "meeting_type": "planning",
        "candidate_id": None,
        "participant_ids": [str(participant.id)],
        "title": "Командная планёрка",
        "starts_at": "2026-10-06T11:00:00+05:00",
        "duration_minutes": 45,
    }
    created = await client.post("/api/v1/recruitment/interviews", json=payload)
    assert created.status_code == 201, created.text
    assert created.json()["meeting_type"] == "planning"
    assert created.json()["candidate_id"] is None
    assert created.json()["candidate_name"] is None

    conflict = await client.post("/api/v1/recruitment/interviews", json={**payload, "title": "Другая встреча", "starts_at": "2026-10-06T11:15:00+05:00"})
    assert conflict.status_code == 409

    events = (await client.get("/api/v1/recruitment/interviews", params={"start": "2026-10-06T00:00:00+05:00", "end": "2026-10-07T00:00:00+05:00"})).json()
    assert events[0]["title"] == "Командная планёрка"
    assert events[0]["participants"][0]["full_name"] == "Lead"


@pytest.mark.asyncio
async def test_interview_participants_conflicts_update_and_calendar_summary(context):
    client, db, user, *_ = context
    participant = User(id=uuid.uuid4(), company_id=user.company_id, email="lead@example.org", full_name="Lead", hashed_password="unused", role="department_head")
    foreign = User(id=uuid.uuid4(), company_id=uuid.uuid4(), email="foreign@example.org", full_name="Foreign", hashed_password="unused", role="hr")
    db.add_all([participant, foreign])
    await db.commit()
    candidate = await create_candidate(client)

    payload = {
        "candidate_id": candidate["id"],
        "participant_ids": [str(participant.id)],
        "title": "Interview",
        "starts_at": "2026-10-05T10:00:00+05:00",
        "duration_minutes": 60,
        "notes": "Initial screen",
    }
    created = await client.post("/api/v1/recruitment/interviews", json=payload)
    assert created.status_code == 201, created.text
    meeting = created.json()
    assert meeting["participant_ids"] == [str(participant.id)]
    assert meeting["participants"][0]["full_name"] == "Lead"

    overlapping = await client.post("/api/v1/recruitment/interviews", json={**payload, "starts_at": "2026-10-05T10:30:00+05:00"})
    assert overlapping.status_code == 409
    assert "занят" in overlapping.json()["detail"].lower()
    foreign_participant = await client.patch(f"/api/v1/recruitment/interviews/{meeting['id']}", json={"participant_ids": [str(foreign.id)]})
    assert foreign_participant.status_code == 404

    moved = await client.patch(
        f"/api/v1/recruitment/interviews/{meeting['id']}",
        json={"title": "Final", "starts_at": "2026-10-05T12:00:00+05:00", "duration_minutes": 30, "participant_ids": []},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["title"] == "Final"
    assert moved.json()["duration_minutes"] == 30
    assert moved.json()["participant_ids"] == []

    summary = (await client.get(
        "/api/v1/recruitment/interviews/calendar",
        params={"start": "2026-10-05T00:00:00+05:00", "end": "2026-10-12T00:00:00+05:00", "day": "2026-10-05T00:00:00+05:00"},
    )).json()
    assert summary["day_load_percent"] == 6
    assert summary["week_load_percent"] == 1
    assert summary["best_slot"]["starts_at"].startswith("2026-10-05T12:30:00")
    assert summary["free_slots"]


@pytest.mark.asyncio
async def test_recruitment_participants_are_company_scoped_for_hr(context):
    client, db, user, *_ = context
    own = User(id=uuid.uuid4(), company_id=user.company_id, email="own@example.org", full_name="Own", hashed_password="unused", role="employee")
    other = User(id=uuid.uuid4(), company_id=uuid.uuid4(), email="other@example.org", full_name="Other", hashed_password="unused", role="employee")
    db.add_all([own, other])
    await db.commit()

    participants = (await client.get("/api/v1/recruitment/participants")).json()
    names = {item["full_name"] for item in participants}
    assert {"HR", "Own"} <= names
    assert "Other" not in names


@pytest.mark.asyncio
async def test_employee_cannot_access_hr_or_other_profile(context):
    client, db, user, employee, _ = context
    user.role = "employee"
    await db.flush()
    assert (await client.get("/api/v1/recruitment/candidates")).status_code == 403
    assert (await client.get("/api/v1/workspace/dashboard")).status_code == 403
    assert (await client.get(f"/api/v1/workspace/employees/{employee.id}")).status_code == 403
    employee.user_id = user.id
    await db.flush()
    assert (await client.get(f"/api/v1/workspace/employees/{employee.id}")).status_code == 200


@pytest.mark.asyncio
async def test_diagnostics_use_latest_attempt_not_best_score(context):
    client, db, user, employee, _ = context
    test = AcademyTest(id=uuid.uuid4(), company_id=user.company_id, title="Test", passing_score=70)
    db.add(test)
    await db.flush()
    now = datetime.now(timezone.utc)
    db.add_all([
        AcademyAttempt(company_id=user.company_id, employee_id=employee.id, test_id=test.id, status="completed", score=95, passed=True, started_at=now-timedelta(days=2), completed_at=now-timedelta(days=2)),
        AcademyAttempt(company_id=user.company_id, employee_id=employee.id, test_id=test.id, status="completed", score=40, passed=False, started_at=now, completed_at=now),
    ])
    await db.commit()
    detail = (await client.get(f"/api/v1/workspace/employees/{employee.id}")).json()
    assert detail["knowledge_percent"] == 40
    assert detail["diagnostics"][0]["passed"] is False
    assert detail["diagnostics"][0]["attempts"] == 2


@pytest.mark.asyncio
async def test_dashboard_has_real_overdue_assignments(context):
    client, db, user, employee, _ = context
    lesson = Lesson(id=uuid.uuid4(), company_id=user.company_id, title="Lesson", status=LessonStatus.PUBLISHED)
    db.add(lesson)
    await db.flush()
    db.add(LessonAssignment(company_id=user.company_id, employee_id=employee.id, lesson_id=lesson.id, due_date="2000-01-01"))
    await db.commit()
    response = await client.get("/api/v1/workspace/dashboard")
    assert response.status_code == 200
    assert response.json()["stats"]["needs_attention"] == 1
    assert response.json()["attention"][0]["employee_id"] == str(employee.id)


@pytest.mark.asyncio
async def test_completed_lesson_timestamp_fits_postgres_column(context):
    client, db, user, employee, _ = context
    lesson = Lesson(id=uuid.uuid4(), company_id=user.company_id, title="Lesson", status=LessonStatus.PUBLISHED)
    db.add(lesson)
    await db.flush()
    assignment = LessonAssignment(company_id=user.company_id, employee_id=employee.id, lesson_id=lesson.id)
    db.add(assignment)
    await db.commit()
    response = await client.patch(f"/api/v1/assignments/{assignment.id}/status", json={"status": "completed"})
    assert response.status_code == 200
    assert len(response.json()["completed_at"]) <= 30


@pytest.mark.asyncio
async def test_employee_profile_is_tenant_scoped(context):
    client, db, user, employee, foreign_position = context
    user.company_id = foreign_position.company_id
    await db.flush()
    assert (await client.get(f"/api/v1/workspace/employees/{employee.id}")).status_code == 404


@pytest.mark.asyncio
async def test_department_nesting_create_move_and_delete(context):
    client, *_ = context
    root = (await client.post("/api/v1/departments/", json={"name": "Production"})).json()
    child = await client.post("/api/v1/departments/", json={"name": "Chief accountants", "parent_id": root["id"]})
    assert child.status_code == 201, child.text
    child = child.json()
    assert child["parent_id"] == root["id"]
    grandchild = (await client.post("/api/v1/departments/", json={"name": "VAT", "parent_id": child["id"]})).json()
    moved = await client.patch(f"/api/v1/departments/{child['id']}", json={"parent_id": None})
    assert moved.status_code == 200 and moved.json()["parent_id"] is None
    await client.patch(f"/api/v1/departments/{child['id']}", json={"parent_id": root["id"]})
    assert (await client.delete(f"/api/v1/departments/{child['id']}")).status_code == 204
    assert (await client.get(f"/api/v1/departments/{grandchild['id']}")).json()["parent_id"] == root["id"]


@pytest.mark.asyncio
async def test_department_parent_rejects_cycles_and_foreign_company(context):
    from app.models.department import Department
    client, db, user, _, foreign_position = context
    foreign = Department(id=uuid.uuid4(), company_id=foreign_position.company_id, name="Foreign")
    db.add(foreign)
    await db.commit()
    root = (await client.post("/api/v1/departments/", json={"name": "Root"})).json()
    child = (await client.post("/api/v1/departments/", json={"name": "Child", "parent_id": root["id"]})).json()
    assert (await client.patch(f"/api/v1/departments/{root['id']}", json={"parent_id": root["id"]})).status_code == 400
    assert (await client.patch(f"/api/v1/departments/{root['id']}", json={"parent_id": child["id"]})).status_code == 400
    assert (await client.post("/api/v1/departments/", json={"name": "X", "parent_id": str(foreign.id)})).status_code == 404
    assert (await client.patch(f"/api/v1/departments/{child['id']}", json={"parent_id": str(uuid.uuid4())})).status_code == 404
