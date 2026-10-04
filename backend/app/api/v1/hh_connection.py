"""Employer OAuth bootstrap. Recruitment sync and messaging are separate stages."""
import asyncio
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from datetime import datetime, timedelta
from html import escape
from urllib.parse import urlencode, urlparse
from urllib.request import Request as URLRequest, build_opener, HTTPRedirectHandler
from uuid import UUID

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_company_admin_or_above, get_effective_company_id
from app.database import get_db
from app.models.company import Company
from app.models.integration import Integration
from app.models.user import User

router = APIRouter(prefix='/hh')
CALLBACK = '/api/v1/integrations/hh/callback'
COOKIE = 'hh_oauth_state'


class RedactOAuthQuery(logging.Filter):
    def filter(self, record):
        if isinstance(record.args, tuple) and len(record.args) >= 3 and isinstance(record.args[2], str) and record.args[2].split('?')[0] == CALLBACK:
            args = list(record.args)
            args[2] = CALLBACK
            record.args = tuple(args)
        return True


logging.getLogger('uvicorn.access').addFilter(RedactOAuthQuery())


def config():
    values = {name: os.getenv('HH_' + name, '') for name in (
        'CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URI', 'USER_AGENT', 'TOKEN_ENCRYPTION_KEY')}
    try:
        parsed = urlparse(values['REDIRECT_URI'])
        ready = all(values.values()) and parsed.scheme == 'https' and bool(parsed.netloc) and parsed.path == CALLBACK and not parsed.query and not parsed.fragment
        Fernet(values['TOKEN_ENCRYPTION_KEY'].encode())
    except (ValueError, TypeError):
        ready = False
    return values, bool(ready)


def page(title, message, status=200):
    response = HTMLResponse(f'''<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>{escape(title)} — Академия Масштаба</title>
<style>body{{margin:0;background:#f5f6fa;color:#202635;font:17px/1.6 system-ui,sans-serif}}main{{max-width:620px;margin:12vh auto;padding:36px;background:white;border-radius:20px}}h1{{font-size:28px}}a{{color:#4f46e5}}small{{color:#657084}}</style></head>
<body><main><small>АКАДЕМИЯ МАСШТАБА · HH.RU</small><h1>{escape(title)}</h1><p>{escape(message)}</p>
<p><a href="/dashboard/settings?tab=integrations">Перейти к настройкам интеграции</a></p></main></body></html>''', status_code=status)
    response.headers.update({'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"})
    response.delete_cookie(COOKIE, path=CALLBACK, secure=True, httponly=True, samesite='lax')
    return response


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


async def exchange_code(code, values):
    # Fixed HTTPS hosts; do not forward credentials through redirects or log responses.
    def exchange():
        opener = build_opener(NoRedirect())
        body = urlencode({'grant_type': 'authorization_code', 'code': code,
                          'client_id': values['CLIENT_ID'], 'client_secret': values['CLIENT_SECRET'],
                          'redirect_uri': values['REDIRECT_URI']}).encode()
        headers = {'HH-User-Agent': values['USER_AGENT'], 'User-Agent': values['USER_AGENT']}
        request = URLRequest('https://api.hh.ru/token', data=body, headers={**headers, 'Content-Type': 'application/x-www-form-urlencoded'})
        with opener.open(request, timeout=15) as response:
            token = json.load(response)
        request = URLRequest('https://api.hh.ru/me', headers={**headers, 'Authorization': 'Bearer ' + token['access_token']})
        with opener.open(request, timeout=15) as response:
            account = json.load(response)
        return token, account
    return await asyncio.to_thread(exchange)


@router.get('/status')
async def connection_status(user=Depends(get_company_admin_or_above)):
    values, ready = config()
    return {'configured': ready, 'redirect_uri': values['REDIRECT_URI'],
            'message': 'Можно подключить аккаунт работодателя' if ready else 'Ожидается регистрация приложения hh.ru и настройка ключей на сервере'}


@router.post('/connect')
async def connect(user=Depends(get_company_admin_or_above), company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    values, ready = config()
    if not ready:
        raise HTTPException(503, 'Сначала зарегистрируйте приложение hh.ru и настройте ключи на сервере')
    if user.company_id != company_id:
        raise HTTPException(403, 'Подключение выполняет администратор самой компании')
    # Serialize starts within a company, including the first connection.
    await db.execute(select(Company).where(Company.id == company_id).with_for_update())
    record = (await db.execute(select(Integration).where(Integration.company_id == company_id, Integration.provider == 'hh.ru').order_by(Integration.created_at).with_for_update())).scalars().first()
    if record is None:
        record = Integration(company_id=company_id, provider='hh.ru', status='inactive')
        db.add(record)
        await db.flush()
    nonce = secrets.token_urlsafe(32)
    state = str(record.id) + '.' + nonce
    record.settings_data = {**(record.settings_data or {}), 'oauth_pending': {
        'digest': hashlib.sha256(state.encode()).hexdigest(), 'expires': time.time() + 600,
        'user_id': str(user.id), 'company_id': str(company_id)}}
    await db.commit()
    response = JSONResponse({'authorization_url': 'https://hh.ru/oauth/authorize?' + urlencode({
        'response_type': 'code', 'client_id': values['CLIENT_ID'], 'redirect_uri': values['REDIRECT_URI'], 'state': state})})
    response.headers['Cache-Control'] = 'no-store'
    response.set_cookie(COOKIE, state, max_age=600, path=CALLBACK, secure=True, httponly=True, samesite='lax')
    return response


@router.get('/callback', response_class=HTMLResponse)
async def callback(request: Request, db: AsyncSession = Depends(get_db)):
    params = request.query_params
    if not params:
        return page('Подключение hh.ru', 'Адрес возврата из hh.ru готов. Аккаунт ещё не подключён. Подключение запускается из настроек «Академии» после регистрации приложения и настройки ключей.')
    state = params.get('state', '')
    cookie = request.cookies.get(COOKIE, '')
    invalid = lambda: page('Подключение не завершено', 'Запрос недействителен или устарел. Начните подключение заново из настроек «Академии».', 400)
    if not state or len(state) > 200 or not cookie or not hmac.compare_digest(state, cookie):
        return invalid()
    try:
        record_id = UUID(state.split('.')[0])
    except ValueError:
        return invalid()
    record = (await db.execute(select(Integration).where(Integration.id == record_id, Integration.provider == 'hh.ru').with_for_update())).scalar_one_or_none()
    pending = (record.settings_data or {}).get('oauth_pending', {}) if record else {}
    if not pending or pending.get('expires', 0) < time.time() or not hmac.compare_digest(pending.get('digest', ''), hashlib.sha256(state.encode()).hexdigest()) or pending.get('company_id') != str(record.company_id):
        return invalid()
    actor = await db.get(User, UUID(pending['user_id']))
    # Support impersonation cannot establish a durable employer connection.
    if not actor or not actor.is_active or actor.role not in ('company_admin', 'super_admin') or actor.company_id != record.company_id:
        return invalid()
    record.settings_data = {key: value for key, value in (record.settings_data or {}).items() if key != 'oauth_pending'}
    record.settings_data['oauth_consumed'] = pending['digest']
    await db.commit()  # Consume before contacting hh.ru, including denial/error.
    if params.get('error'):
        return page('Доступ не предоставлен', 'hh.ru не разрешил подключение. Вы можете повторить его из настроек.', 400)
    code = params.get('code', '')
    if not code or len(code) > 4096:
        return invalid()
    values, ready = config()
    if not ready:
        return page('Приложение ещё не настроено', 'Для подключения необходимо добавить ключи приложения hh.ru на сервер.', 503)
    try:
        token, account = await exchange_code(code, values)
        employer = account.get('employer') or {}
        if not account.get('is_employer') or not employer.get('id'):
            return page('Нужен аккаунт работодателя', 'Войдите в hh.ru под аккаунтом работодателя и повторите подключение.', 400)
        if record.settings_data.get('employer_id') not in (None, str(employer['id'])):
            return page('Другой работодатель', 'К этой компании уже привязан другой работодатель hh.ru.', 409)
        expires = int(token['expires_in'])
        if expires <= 0 or not token.get('access_token') or not token.get('refresh_token'):
            raise ValueError('Invalid token response')
        cipher = Fernet(values['TOKEN_ENCRYPTION_KEY'].encode())
        access = 'fernet:' + cipher.encrypt(token['access_token'].encode()).decode()
        refresh = 'fernet:' + cipher.encrypt(token['refresh_token'].encode()).decode()
    except Exception:
        return page('Не удалось завершить подключение', 'Не удалось подтвердить аккаунт в hh.ru. Повторите подключение из настроек. Если ошибка сохраняется, проверьте настройки приложения.', 502)
    # Lock again after network IO and do not overwrite a newer connection attempt.
    await db.refresh(record, with_for_update=True)
    if record.settings_data.get('oauth_pending') or record.settings_data.get('oauth_consumed') != pending['digest']:
        return page('Начато новое подключение', 'Завершите последнее подключение, открытое из настроек.', 409)
    record.access_token, record.refresh_token = access, refresh
    record.expires_at = datetime.utcnow() + timedelta(seconds=expires)
    record.status = 'active'
    record.settings_data = {**record.settings_data, 'employer_id': str(employer['id']), 'employer_name': employer.get('name', ''), 'token_format': 'fernet-v1'}
    await db.commit()
    return page('Аккаунт hh.ru подключён', 'Авторизация работодателя завершена. Загрузка кандидатов и работа с сообщениями будут доступны после настройки следующих этапов интеграции.')
