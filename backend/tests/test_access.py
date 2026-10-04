import uuid

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.main import app
from app.database import Base, get_db
from app.api.deps import get_current_user
from app.core.security import get_password_hash
from app.models.base import utc_now
from app.models import Company, Department, Employee, Lesson, LessonAssignment, User
from app.models import Test as AcademyTest, Question, AnswerOption
from app.models.lesson import LessonStatus


@pytest_asyncio.fixture
async def ctx():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        company = Company(id=uuid.uuid4(), name="Масштаб", slug="m", is_active=True)
        db.add(company)
        await db.flush()

        def account(role, email):
            return User(id=uuid.uuid4(), company_id=company.id, email=email, full_name=role, role=role, hashed_password=get_password_hash("password123"), activated_at=utc_now())

        admin, hr, head, method, worker = (account(r, f"{r}@example.org") for r in ("company_admin", "hr", "department_head", "methodologist", "employee"))
        sales = Department(id=uuid.uuid4(), company_id=company.id, name="Продажи")
        support = Department(id=uuid.uuid4(), company_id=company.id, name="Поддержка")
        db.add_all([admin, hr, head, method, worker, sales, support])
        await db.flush()
        head_card = Employee(id=uuid.uuid4(), company_id=company.id, full_name="Руководитель", user_id=head.id, department_id=sales.id)
        worker_card = Employee(id=uuid.uuid4(), company_id=company.id, full_name="Сотрудник", user_id=worker.id, department_id=sales.id)
        colleague = Employee(id=uuid.uuid4(), company_id=company.id, full_name="Коллега", department_id=sales.id)
        outsider = Employee(id=uuid.uuid4(), company_id=company.id, full_name="Другой отдел", department_id=support.id)
        newcomer = Employee(id=uuid.uuid4(), company_id=company.id, full_name="Новичок")
        db.add_all([head_card, worker_card, colleague, outsider, newcomer])
        await db.commit()

        current = {"user": admin}

        async def database():
            yield db

        app.dependency_overrides[get_db] = database
        app.dependency_overrides[get_current_user] = lambda: current["user"]
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            yield {
                "client": client, "db": db, "current": current, "company": company,
                "admin": admin, "hr": hr, "head": head, "method": method, "worker": worker,
                "worker_card": worker_card, "colleague": colleague, "outsider": outsider, "newcomer": newcomer,
            }
        app.dependency_overrides.clear()
    await engine.dispose()


async def grant(c, employee, email="new@example.org", role="employee"):
    c["current"]["user"] = c["admin"]
    return await c["client"].post(f"/api/v1/access/employees/{employee.id}", json={"email": email, "role": role})


@pytest.mark.asyncio
async def test_invitation_sets_password_and_signs_in(ctx):
    client = ctx["client"]
    issued = await grant(ctx, ctx["newcomer"], email="New@Example.org")
    assert issued.status_code == 201, issued.text
    body = issued.json()
    assert body["user"]["status"] == "invited" and body["user"]["employee_id"] == str(ctx["newcomer"].id)
    assert body["email_sent"] is False
    token = body["invite_path"].removeprefix("/invite/")

    # Not activated yet — no way to sign in
    assert (await client.post("/api/v1/auth/login", json={"email": "new@example.org", "password": "anything1"})).status_code == 401
    info = await client.get(f"/api/v1/auth/invitations/{token}")
    assert info.status_code == 200 and info.json()["email"] == "new@example.org" and info.json()["company_name"] == "Масштаб"
    assert (await client.post(f"/api/v1/auth/invitations/{token}/accept", json={"password": "short"})).status_code == 422
    accepted = await client.post(f"/api/v1/auth/invitations/{token}/accept", json={"password": "secret-pass"})
    assert accepted.status_code == 200 and accepted.json()["role"] == "employee"
    # One-time link
    assert (await client.post(f"/api/v1/auth/invitations/{token}/accept", json={"password": "secret-pass"})).status_code == 404
    login = await client.post("/api/v1/auth/login", json={"email": "NEW@example.org", "password": "secret-pass"})
    assert login.status_code == 200
    users = (await client.get("/api/v1/access/users")).json()
    assert next(u for u in users if u["email"] == "new@example.org")["status"] == "active"


@pytest.mark.asyncio
async def test_resend_invalidates_previous_link(ctx):
    client = ctx["client"]
    first = (await grant(ctx, ctx["newcomer"])).json()
    second = await client.post(f"/api/v1/access/users/{first['user']['id']}/invitation")
    assert second.status_code == 200
    assert (await client.get(f"/api/v1/auth/invitations/{first['invite_path'].removeprefix('/invite/')}")).status_code == 404
    assert (await client.get(f"/api/v1/auth/invitations/{second.json()['invite_path'].removeprefix('/invite/')}")).status_code == 200


@pytest.mark.asyncio
async def test_grant_validation(ctx):
    assert (await grant(ctx, ctx["newcomer"], email="hr@example.org")).status_code == 409
    assert (await grant(ctx, ctx["newcomer"], role="super_admin")).status_code == 422
    assert (await grant(ctx, ctx["worker_card"], email="other@example.org")).status_code == 409
    ctx["current"]["user"] = ctx["hr"]
    assert (await ctx["client"].post(f"/api/v1/access/employees/{ctx['newcomer'].id}", json={"email": "x@example.org"})).status_code == 403
    assert (await ctx["client"].get("/api/v1/access/users")).status_code == 403


@pytest.mark.asyncio
async def test_dismissal_blocks_sign_in_and_keeps_history(ctx):
    client = ctx["client"]
    ctx["current"]["user"] = ctx["hr"]
    fired = await client.patch(f"/api/v1/employees/{ctx['worker_card'].id}", json={"status": "fired"})
    assert fired.status_code == 200 and fired.json()["user_id"] == str(ctx["worker"].id)
    login = await client.post("/api/v1/auth/login", json={"email": "employee@example.org", "password": "password123"})
    assert login.status_code == 403
    ctx["current"]["user"] = ctx["admin"]
    row = next(u for u in (await client.get("/api/v1/access/users")).json() if u["id"] == str(ctx["worker"].id))
    assert row["status"] == "blocked" and row["employee_status"] == "fired"
    assert (await client.patch(f"/api/v1/access/users/{ctx['worker'].id}", json={"is_active": True})).status_code == 409


@pytest.mark.asyncio
async def test_block_role_change_and_self_protection(ctx):
    client = ctx["client"]
    blocked = await client.patch(f"/api/v1/access/users/{ctx['method'].id}", json={"is_active": False, "role": "hr"})
    assert blocked.status_code == 200 and blocked.json()["status"] == "blocked" and blocked.json()["role"] == "hr"
    assert (await client.post("/api/v1/auth/login", json={"email": "methodologist@example.org", "password": "password123"})).status_code == 403
    assert (await client.patch(f"/api/v1/access/users/{ctx['admin'].id}", json={"is_active": False})).status_code == 409
    assert (await client.patch(f"/api/v1/access/users/{ctx['hr'].id}", json={"role": "super_admin"})).status_code == 422
    assert (await client.patch(f"/api/v1/users/{ctx['hr'].id}", json={"role": "super_admin"})).status_code == 403


@pytest.mark.asyncio
async def test_employee_sees_only_own_card(ctx):
    client = ctx["client"]
    ctx["current"]["user"] = ctx["worker"]
    listed = (await client.get("/api/v1/employees/")).json()
    assert [e["id"] for e in listed] == [str(ctx["worker_card"].id)]
    assert (await client.get(f"/api/v1/employees/{ctx['colleague'].id}")).status_code == 403
    assert (await client.get(f"/api/v1/workspace/employees/{ctx['colleague'].id}")).status_code == 403
    assert (await client.get(f"/api/v1/workspace/employees/{ctx['worker_card'].id}")).status_code == 200
    assert (await client.get(f"/api/v1/users/{ctx['hr'].id}")).status_code == 403
    ctx["current"]["user"] = ctx["method"]
    assert (await client.get("/api/v1/employees/")).json() == []


@pytest.mark.asyncio
async def test_department_head_sees_own_department_only(ctx):
    client = ctx["client"]
    ctx["current"]["user"] = ctx["head"]
    names = {e["full_name"] for e in (await client.get("/api/v1/employees/")).json()}
    assert names == {"Руководитель", "Сотрудник", "Коллега"}
    assert (await client.get(f"/api/v1/workspace/employees/{ctx['colleague'].id}")).status_code == 200
    assert (await client.get(f"/api/v1/workspace/employees/{ctx['outsider'].id}")).status_code == 403
    team = {e["full_name"] for e in (await client.get("/api/v1/analytics/my-department")).json()}
    assert team == names
    ctx["current"]["user"] = ctx["hr"]
    assert len((await client.get("/api/v1/employees/")).json()) == 5


@pytest.mark.asyncio
async def test_learning_data_is_not_shared_between_employees(ctx):
    client, db, company = ctx["client"], ctx["db"], ctx["company"]
    lesson = Lesson(id=uuid.uuid4(), company_id=company.id, title="Урок", status=LessonStatus.PUBLISHED)
    test = AcademyTest(id=uuid.uuid4(), company_id=company.id, title="Тест", status="published")
    db.add_all([lesson, test])
    await db.flush()
    question = Question(id=uuid.uuid4(), test_id=test.id, company_id=company.id, question_type="single", text="?", points=1, order_index=0)
    db.add(question)
    await db.flush()
    db.add(AnswerOption(id=uuid.uuid4(), question_id=question.id, text="Да", is_correct=True, order_index=0))
    foreign = LessonAssignment(id=uuid.uuid4(), company_id=company.id, lesson_id=lesson.id, employee_id=ctx["colleague"].id)
    db.add(foreign)
    await db.commit()

    ctx["current"]["user"] = ctx["worker"]
    detail = (await client.get(f"/api/v1/tests/{test.id}")).json()
    assert "is_correct" not in detail["questions"][0]["options"][0]
    assert (await client.get(f"/api/v1/tests/{test.id}/results")).status_code == 403
    assert (await client.patch(f"/api/v1/assignments/{foreign.id}/status", json={"status": "completed"})).status_code == 403
    ctx["current"]["user"] = ctx["method"]
    assert (await client.get(f"/api/v1/tests/{test.id}")).json()["questions"][0]["options"][0]["is_correct"] is True
    assert (await client.get(f"/api/v1/tests/{test.id}/results")).status_code == 403
    ctx["current"]["user"] = ctx["hr"]
    assert (await client.get(f"/api/v1/tests/{test.id}/results")).status_code == 200


@pytest.mark.asyncio
async def test_employee_card_cannot_be_linked_to_foreign_account(ctx):
    ctx["current"]["user"] = ctx["hr"]
    response = await ctx["client"].patch(f"/api/v1/employees/{ctx['newcomer'].id}", json={"user_id": str(ctx["admin"].id)})
    assert response.status_code == 200 and response.json()["user_id"] is None
