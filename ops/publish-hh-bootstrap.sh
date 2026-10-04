#!/bin/sh
set -eu
stage=/srv/academy-hh-bootstrap
project=/opt/masshtab-academy
backup=/opt/backups/masshtab-academy/hh-bootstrap
mkdir -p "$backup"
test ! -f "$backup/backend.before"
docker inspect masshtab-academy-backend-1 --format '{{.Image}}' > "$backup/backend.before"
docker tag "$(cat "$backup/backend.before")" masshtab-academy-backend:rollback-hh-bootstrap
cp "$project/backend/app/api/v1/integrations.py" "$backup/integrations.py"
printf 'FROM masshtab-academy-backend:rollback-hh-bootstrap\nCOPY hh_connection.py /app/app/api/v1/hh_connection.py\nCOPY integrations.py /app/app/api/v1/integrations.py\n' > "$stage/Dockerfile"
docker build -t masshtab-academy-backend:hh-bootstrap "$stage"
docker run --rm --entrypoint python masshtab-academy-backend:hh-bootstrap -c 'from app.main import app; assert any(r.path == "/api/v1/integrations/hh/callback" for r in app.routes)'
test "$(docker inspect masshtab-academy-backend-1 --format '{{.Image}}')" = "$(cat "$backup/backend.before")"
rollback() {
  docker tag masshtab-academy-backend:rollback-hh-bootstrap masshtab-academy-backend
  cp "$backup/integrations.py" "$project/backend/app/api/v1/integrations.py"
  cd "$project"
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-build --no-deps backend
}
trap rollback HUP INT TERM
cp "$stage/hh_connection.py" "$stage/integrations.py" "$project/backend/app/api/v1/"
docker tag masshtab-academy-backend:hh-bootstrap masshtab-academy-backend
cd "$project"
if ! docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-build --no-deps backend; then rollback; exit 1; fi
ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1/api/v1/integrations/hh/callback > "$backup/callback.html"; then ready=1; break; fi
  sleep 2
done
if [ "$ready" != 1 ]; then rollback; exit 1; fi
docker compose -p academy-tls -f ops/hh-tls.compose.yml up -d
cp ops/academy-cert-renew.service ops/academy-cert-renew.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now academy-cert-renew.timer
echo 'HH bootstrap published'
