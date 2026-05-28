#!/bin/sh
set -e

echo "⏳ Ждём базу данных..."
# Простая пауза — healthcheck в compose уже гарантирует готовность БД,
# но на всякий случай даём ещё 2 секунды
sleep 2

echo "📦 Применяем миграции Alembic..."
alembic upgrade head

echo "🚀 Запускаем приложение..."
# Количество воркеров: 2 для VPS 1-2 ГБ RAM, 4 для 4+ ГБ
WORKERS=${GUNICORN_WORKERS:-2}

exec gunicorn app.main:app \
    -k uvicorn.workers.UvicornWorker \
    -w "$WORKERS" \
    --bind 0.0.0.0:8000 \
    --timeout 120 \
    --access-logfile -
