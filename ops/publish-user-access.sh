#!/bin/sh
# Release: personal accounts and server-side access checks (migrations 011 + 013).
# Production is at revision 012; the backend entrypoint runs `alembic upgrade head` on start.
# Stage: unpack academy-release-20261004-user-access.tar.gz into $stage before running.
set -eu
release=20261004-user-access
project=/opt/masshtab-academy
stage=/srv/academy-release-$release
backup=/opt/backups/masshtab-academy/$release
backend_container=masshtab-academy-backend-1
frontend_container=masshtab-academy-frontend-1
db() { docker exec masshtab-academy-db-1 psql -U masshtab_user -d masshtab_academy -Atc "$1"; }

exec 9>/opt/masshtab-academy-release.lock
flock -n 9

# Refuse to run against an unexpected schema
test "$(db 'select version_num from alembic_version')" = "012"
test ! -e "$backup"

backend_image=$(docker inspect "$backend_container" --format '{{.Image}}')
frontend_image=$(docker inspect "$frontend_container" --format '{{.Image}}')
umask 077
mkdir -p "$backup"
docker tag "$backend_image" masshtab-academy-backend:rollback-$release
docker tag "$frontend_image" masshtab-academy-frontend:rollback-$release
docker exec masshtab-academy-db-1 pg_dump -U masshtab_user -d masshtab_academy -Fc > "$backup/database.dump"
docker exec -i masshtab-academy-db-1 pg_restore --list < "$backup/database.dump" > "$backup/database.contents"
tar -czf "$backup/source.tar.gz" -C "$project" --exclude=.git --exclude=node_modules .
db 'select (select count(*) from users), (select count(*) from employees), (select count(*) from lesson_assignments), (select count(*) from test_attempts)' > "$backup/counts.before"
sha256sum "$backup"/*.gz "$backup/database.dump" > "$backup/SHA256SUMS"

cd "$stage"
test -f frontend/dist/index.html
docker build -f ops/Dockerfile.backend.release --build-arg BASE_IMAGE=masshtab-academy-backend:rollback-$release -t masshtab-academy-backend:release-$release .
docker build -f ops/Dockerfile.frontend.release --build-arg BASE_IMAGE=masshtab-academy-frontend:rollback-$release -t masshtab-academy-frontend:release-$release .
docker run --rm --entrypoint python masshtab-academy-backend:release-$release -m compileall -q app
docker run --rm --entrypoint alembic masshtab-academy-backend:release-$release heads | grep -q '^013 (head)'
cp ops/rollback-user-access.yml "$backup/rollback.yml"

# Nothing changed on the server until here
test "$(docker inspect "$backend_container" --format '{{.Image}}')" = "$backend_image"
tar -cf - backend/app backend/alembic backend/seed.py backend/scripts backend/.env.example frontend/src ops | tar -xf - -C "$project"
docker tag masshtab-academy-backend:release-$release masshtab-academy-backend
docker tag masshtab-academy-frontend:release-$release masshtab-academy-frontend
cd "$project"
docker compose -p masshtab-academy -f docker-compose.prod.yml --env-file .env.prod up -d --no-build backend frontend

# Entrypoint applies 011 and 013 before gunicorn starts
for attempt in $(seq 1 30); do
  [ "$(db 'select version_num from alembic_version')" = "013" ] && break
  sleep 2
done
test "$(db 'select version_num from alembic_version')" = "013"
test "$(db 'select count(*) from users where activated_at is null')" = "0"
db 'select (select count(*) from users), (select count(*) from employees), (select count(*) from lesson_assignments), (select count(*) from test_attempts)' > "$backup/counts.after"
cmp "$backup/counts.before" "$backup/counts.after"
echo "Release finished: schema 013. Backup: $backup"
echo "Rollback: docker compose -p masshtab-academy -f $project/docker-compose.prod.yml -f $backup/rollback.yml --env-file $project/.env.prod up -d --no-build backend frontend"
