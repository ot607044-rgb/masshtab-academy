"""Real transaction tests. Use an isolated migrated PostgreSQL test database.

CALENDAR_TEST_DATABASE_URL=postgresql+asyncpg://... pytest tests/test_calendar_postgres.py
"""
import asyncio
import os
import uuid

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.main import app
from app.database import get_db
from app.api.deps import get_current_user
from app.models import Company, User, Employee
from app.models.recruitment import Interview, CalendarPublicLink

TEST_URL = os.getenv("CALENDAR_TEST_DATABASE_URL")
pytestmark = [pytest.mark.asyncio, pytest.mark.skipif(not TEST_URL, reason="isolated PostgreSQL test database required")]


@pytest_asyncio.fixture
async def pg_context():
    engine = create_async_engine(TEST_URL, pool_size=12, max_overflow=4)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    company_id = uuid.uuid4()
    async with sessions() as db:
        db.add(Company(id=company_id, name="Calendar transaction test", slug=str(company_id)))
        await db.flush()
        user = User(id=uuid.uuid4(), company_id=company_id, email=f"{company_id}@example.org", full_name="Existing HR", hashed_password="unused", role="hr", is_active=True)
        db.add(user)
        await db.commit()

    async def database():
        async with sessions() as db:
            try:
                yield db
                await db.commit()
            except Exception:
                await db.rollback()
                raise

    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            response = await client.put("/api/v1/recruitment/availability/rules", json={"timezone": "Asia/Yekaterinburg", "rules": [{"weekday": 0, "start_minute": 600, "end_minute": 720, "slot_minutes": 30}]})
            assert response.status_code == 200, response.text
            token = (await client.post("/api/v1/recruitment/public-link")).json()["token"]
            yield client, sessions, user, token
    finally:
        app.dependency_overrides.clear()
        async with sessions() as db:
            await db.execute(delete(Company).where(Company.id == company_id))
            await db.commit()
        await engine.dispose()


def guest(start="2030-01-07T05:00:00Z"):
    return {"starts_at": start, "duration_minutes": 30, "visitor_name": "Guest", "visitor_contact": "guest@example.org"}


async def test_parallel_public_requests_create_exactly_one_meeting(pg_context):
    client, sessions, user, token = pg_context
    responses = await asyncio.gather(*[client.post(f"/api/v1/public-calendar/{token}/book", json=guest()) for _ in range(12)])
    assert sorted(r.status_code for r in responses) == [201] + [409] * 11, [r.text for r in responses]
    async with sessions() as db:
        meetings = (await db.execute(select(Interview).where(Interview.company_id == user.company_id))).scalars().all()
        assert len(meetings) == 1
        assert meetings[0].starts_at.isoformat() == "2030-01-07T05:00:00+00:00"
        assert (await db.execute(select(Employee).where(Employee.company_id == user.company_id))).scalars().all() == []


async def test_public_and_internal_writers_share_the_same_lock(pg_context):
    client, _, user, token = pg_context
    internal = {"title": "Internal", "starts_at": "2030-01-07T05:00:00Z", "duration_minutes": 30, "participant_ids": [str(user.id)]}
    responses = await asyncio.gather(client.post(f"/api/v1/public-calendar/{token}/book", json=guest()), client.post("/api/v1/recruitment/interviews", json=internal))
    assert sorted(r.status_code for r in responses) == [201, 409], [r.text for r in responses]


async def test_parallel_link_creation_and_settings_survive_new_sessions(pg_context):
    client, sessions, user, token = pg_context
    responses = await asyncio.gather(*[client.post("/api/v1/recruitment/public-link") for _ in range(8)])
    assert {r.json()["token"] for r in responses} == {token}
    async with sessions() as db:
        links = (await db.execute(select(CalendarPublicLink).where(CalendarPublicLink.company_id == user.company_id))).scalars().all()
        assert len(links) == 1
    state = (await client.get("/api/v1/recruitment/availability")).json()
    assert state["timezone"] == "Asia/Yekaterinburg" and len(state["rules"]) == 1
    response = await client.get(f"/api/v1/public-calendar/{token}/slots", params={"start": "2030-01-07T00:00:00Z", "end": "2030-01-08T00:00:00Z"})
    assert len(response.json()["slots"]) == 4
