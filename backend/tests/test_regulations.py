import uuid

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.main import app
from app.database import Base, get_db
from app.api.deps import get_current_user
from app.models import Company, User, Employee, Position, Notification


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
        hr = User(id=uuid.uuid4(), company_id=company.id, email="hr@example.org", full_name="Юнусова Ольга", hashed_password="unused", role="hr")
        worker = User(id=uuid.uuid4(), company_id=company.id, email="w@example.org", full_name="Адилова Римма", hashed_password="unused", role="employee")
        accountant = Position(id=uuid.uuid4(), company_id=company.id, name="Бухгалтер")
        chief = Position(id=uuid.uuid4(), company_id=company.id, name="Главный бухгалтер")
        foreign = Position(id=uuid.uuid4(), company_id=other.id, name="Чужая")
        db.add_all([hr, worker, accountant, chief, foreign])
        await db.flush()
        employee = Employee(id=uuid.uuid4(), company_id=company.id, full_name="Адилова Римма", position_id=accountant.id, user_id=worker.id, weak_areas=[])
        db.add(employee)
        await db.commit()

        current = {"user": hr}

        async def database():
            yield db

        app.dependency_overrides[get_db] = database
        app.dependency_overrides[get_current_user] = lambda: current["user"]
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            yield client, db, current, worker, employee, accountant, chief, foreign
        app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_variants_duties_assignment_and_acknowledgement(context):
    client, db, current, worker, employee, accountant, chief, foreign = context
    created = await client.post("/api/v1/regulations/", json={"position_id": str(accountant.id), "name": "Банк и платежи", "summary": "Специализация", "goal": "Платежи вовремя", "duties": ["Платёжные поручения"]})
    assert created.status_code == 201, created.text
    regulation = created.json()
    assert regulation["updated_by_name"] == "Юнусова Ольга"
    second = await client.post("/api/v1/regulations/", json={"position_id": str(accountant.id), "name": "Основной регламент"})
    assert second.status_code == 201

    patched = await client.patch(f"/api/v1/regulations/{regulation['id']}", json={"duties": ["Платёжные поручения", "Сверка с банком"]})
    assert patched.json()["duties"] == ["Платёжные поручения", "Сверка с банком"]
    listed = await client.get("/api/v1/regulations/", params={"position_id": str(accountant.id)})
    assert [r["name"] for r in listed.json()] == ["Банк и платежи", "Основной регламент"]

    assigned = await client.post("/api/v1/regulations/assignments", json={"employee_id": str(employee.id), "regulation_id": regulation["id"], "require_ack": True})
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["notified"] is True and assigned.json()["acknowledged_at"] is None
    notes = (await db.execute(select(Notification).where(Notification.user_id == worker.id))).scalars().all()
    assert len(notes) == 1 and "Банк и платежи" in notes[0].message

    # Повторное назначение заменяет вариант, а не создаёт второе назначение
    again = await client.post("/api/v1/regulations/assignments", json={"employee_id": str(employee.id), "regulation_id": second.json()["id"], "require_ack": False})
    assert again.json()["id"] == assigned.json()["id"] and again.json()["notified"] is False
    assert len((await client.get("/api/v1/regulations/assignments")).json()) == 1

    current["user"] = worker
    mine = await client.get("/api/v1/regulations/my")
    assert mine.json()["regulation"]["name"] == "Основной регламент"
    assert mine.json()["position_name"] == "Бухгалтер"
    ack = await client.post("/api/v1/regulations/my/acknowledge")
    assert ack.json()["acknowledged_at"] is not None
    assert (await client.get("/api/v1/regulations/")).status_code == 403


@pytest.mark.asyncio
async def test_assignment_validates_position_and_company(context):
    client, db, current, worker, employee, accountant, chief, foreign = context
    assert (await client.post("/api/v1/regulations/", json={"position_id": str(foreign.id), "name": "X"})).status_code == 404
    chief_reg = (await client.post("/api/v1/regulations/", json={"position_id": str(chief.id), "name": "Главный"})).json()
    wrong = await client.post("/api/v1/regulations/assignments", json={"employee_id": str(employee.id), "regulation_id": chief_reg["id"]})
    assert wrong.status_code == 400
    deleted = await client.delete(f"/api/v1/regulations/{chief_reg['id']}")
    assert deleted.status_code == 204
    assert (await client.get("/api/v1/regulations/")).json() == []
    assert (await client.patch(f"/api/v1/regulations/{chief_reg['id']}", json={"name": "Y"})).status_code == 404
