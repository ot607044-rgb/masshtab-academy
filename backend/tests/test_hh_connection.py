import uuid
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
import pytest_asyncio
from cryptography.fernet import Fernet
from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.api.deps import get_current_user
from app.database import Base, get_db
from app.models import Company, User
from app.models.integration import Integration
from app.api.v1 import integrations


@pytest_asyncio.fixture
async def context(monkeypatch):
    monkeypatch.setenv('HH_CLIENT_ID', 'test-client')
    monkeypatch.setenv('HH_CLIENT_SECRET', 'test-secret')
    monkeypatch.setenv('HH_REDIRECT_URI', 'https://test/api/v1/integrations/hh/callback')
    monkeypatch.setenv('HH_USER_AGENT', 'Academy/1.0 (admin@example.org)')
    monkeypatch.setenv('HH_TOKEN_ENCRYPTION_KEY', Fernet.generate_key().decode())
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, expire_on_commit=False)() as db:
        company = Company(id=uuid.uuid4(), name='Test', slug='hh-test')
        user = User(id=uuid.uuid4(), company_id=company.id, email='admin@example.org', full_name='Admin', hashed_password='unused', role='company_admin', is_active=True)
        db.add_all([company, user])
        await db.commit()
        app = FastAPI()
        app.include_router(integrations.router, prefix='/api/v1/integrations')
        async def database():
            yield db
        app.dependency_overrides[get_db] = database
        app.dependency_overrides[get_current_user] = lambda: user
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='https://test') as client:
            yield client, db, user
    await engine.dispose()


@pytest.mark.asyncio
async def test_landing_is_honest_and_does_not_connect(context):
    client, db, _ = context
    response = await client.get('/api/v1/integrations/hh/callback')
    assert response.status_code == 200
    assert 'text/html' in response.headers['content-type']
    assert 'не подключён' in response.text
    assert response.headers['cache-control'] == 'no-store'
    assert (await db.execute(select(Integration))).scalars().all() == []


@pytest.mark.asyncio
async def test_configuration_and_permissions(context, monkeypatch):
    client, _, user = context
    monkeypatch.delenv('HH_CLIENT_SECRET')
    assert (await client.post('/api/v1/integrations/hh/connect')).status_code == 503
    user.role = 'hr'
    assert (await client.post('/api/v1/integrations/hh/connect')).status_code == 403


@pytest.mark.asyncio
async def test_callback_rejects_unrequested_code(context):
    client, _, _ = context
    response = await client.get('/api/v1/integrations/hh/callback?code=secret-code&state=forged')
    assert response.status_code == 400
    assert 'secret-code' not in response.text


@pytest.mark.asyncio
async def test_success_encryption_replay_and_browser_binding(context, monkeypatch):
    from app.api.v1 import hh_connection
    client, db, _ = context
    calls = []
    async def exchange(code, config):
        calls.append(code)
        return {'access_token': 'access-sensitive', 'refresh_token': 'refresh-sensitive', 'expires_in': 3600}, {'is_employer': True, 'employer': {'id': '123', 'name': 'Employer'}}
    monkeypatch.setattr(hh_connection, 'exchange_code', exchange)
    begin = await client.post('/api/v1/integrations/hh/connect')
    assert begin.status_code == 200, begin.text
    query = parse_qs(urlparse(begin.json()['authorization_url']).query)
    state = query['state'][0]
    cookie = client.cookies.get('hh_oauth_state')
    client.cookies.clear()
    path = '/api/v1/integrations/hh/callback'
    assert (await client.get(path, params={'code': 'valid', 'state': state})).status_code == 400
    client.cookies.set('hh_oauth_state', cookie)
    response = await client.get(path, params={'code': 'valid', 'state': state})
    assert response.status_code == 200, response.text
    record = (await db.execute(select(Integration))).scalar_one()
    assert record.status == 'active'
    assert 'access-sensitive' not in record.access_token
    assert 'refresh-sensitive' not in record.refresh_token
    assert record.settings_data['employer_id'] == '123'
    assert 'access-sensitive' not in response.text
    client.cookies.set('hh_oauth_state', cookie)
    assert (await client.get(path, params={'code': 'valid', 'state': state})).status_code == 400
    assert calls == ['valid']


@pytest.mark.asyncio
async def test_denial_consumes_state(context):
    client, db, _ = context
    begin = await client.post('/api/v1/integrations/hh/connect')
    assert begin.status_code == 200
    state = parse_qs(urlparse(begin.json()['authorization_url']).query)['state'][0]
    response = await client.get('/api/v1/integrations/hh/callback', params={'error': 'access_denied', 'state': state})
    assert response.status_code == 400
    record = (await db.execute(select(Integration))).scalar_one()
    assert record.status != 'active'
    assert 'oauth_pending' not in record.settings_data
