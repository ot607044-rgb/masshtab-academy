#!/usr/bin/env bash
# Called under the release lock by academy-deploy-trigger.
set -euo pipefail
cd /opt/masshtab-academy
revision=${1:?Expected the GitHub commit SHA}
test "$(git rev-parse HEAD)" = "$revision"
test -z "$(git status --porcelain --untracked-files=no)"
compose=(docker compose -p masshtab-academy -f docker-compose.prod.yml --env-file .env.prod)
"${compose[@]}" config --quiet
release="$(date -u +%Y%m%dT%H%M%SZ)-${revision:0:12}"
backup="/opt/backups/masshtab-academy/$release"
umask 077
mkdir -p "$backup"
trap 'echo "Deployment failed; backup: $backup. Database rollback is manual to protect newer data." >&2' ERR

# Snapshot before migrations; never remove volumes or reset tracked source.
"${compose[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup/database.dump"
"${compose[@]}" exec -T db pg_restore --list < "$backup/database.dump" > "$backup/database.contents"
tar -czf "$backup/source.tar.gz" --exclude=.git --exclude=node_modules --exclude=frontend/dist .
docker run --rm -v masshtab-academy_uploads_data:/uploads:ro -v "$backup":/backup alpine:3.22 tar -czf /backup/uploads.tar.gz -C /uploads .
for service in backend frontend; do
  image=$(docker inspect "masshtab-academy-$service-1" --format '{{.Image}}')
  docker tag "$image" "masshtab-academy-$service:rollback-$release"
done
printf '%s\n' "$revision" > "$backup/target-commit"
"${compose[@]}" build backend frontend

# Entrypoint applies all Alembic migrations before starting the API.
"${compose[@]}" up -d --no-build
ready=false
for attempt in $(seq 1 45); do
  if "${compose[@]}" exec -T backend python -c 'from urllib.request import urlopen; assert urlopen("http://127.0.0.1:8000/health", timeout=5).status == 200' >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done
test "$ready" = true
"${compose[@]}" exec -T backend alembic current
"${compose[@]}" exec -T backend python - < ops/verify-production.py
# Nginx resolves container IPs on reload; retain the separate HTTPS service.
"${compose[@]}" exec -T frontend nginx -t
"${compose[@]}" exec -T frontend nginx -s reload
if docker inspect academy-tls-tls-1 >/dev/null 2>&1; then
  docker exec academy-tls-tls-1 nginx -t
  docker exec academy-tls-tls-1 nginx -s reload
fi
curl --fail --silent --show-error --retry 5 --retry-delay 2 --retry-all-errors --max-time 15 http://127.0.0.1/login > /dev/null
curl --fail --silent --show-error --retry 5 --retry-delay 2 --retry-all-errors --max-time 15 https://31.129.108.20/api/v1/integrations/hh/callback > /dev/null
printf '%s\n' "$revision" > /opt/masshtab-academy-deployed-commit
echo "Verified production commit $revision; backup $backup"
