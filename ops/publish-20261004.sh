#!/bin/sh
set -eu
release=20261004-ui
stage=/srv/academy-release-$release
project=/opt/masshtab-academy
backup=/opt/backups/masshtab-academy/$release
test ! -e "$backup"
umask 077
mkdir -p "$backup"
docker tag masshtab-academy-backend masshtab-academy-backend:rollback-$release
docker tag masshtab-academy-frontend masshtab-academy-frontend:rollback-$release
docker exec masshtab-academy-db-1 pg_dump -U masshtab_user -d masshtab_academy -Fc > "$backup/database.dump"
docker exec -i masshtab-academy-db-1 pg_restore --list < "$backup/database.dump" > "$backup/database.contents"
tar -czf "$backup/uploads.tar.gz" -C /var/lib/docker/volumes/masshtab-academy_uploads_data/_data .
tar -czf "$backup/source.tar.gz" -C "$project" --exclude=.git --exclude=node_modules .
docker exec masshtab-academy-db-1 psql -U masshtab_user -d masshtab_academy -Atc 'select (select count(*) from companies), (select count(*) from users), (select count(*) from employees), (select count(*) from lessons), (select count(*) from lesson_assignments), (select count(*) from tests), (select count(*) from test_attempts)' > "$backup/counts.before"
sha256sum "$backup"/*.gz "$backup/database.dump" > "$backup/SHA256SUMS"
echo "Backup verified: $backup"
cd "$stage"
docker build -f ops/Dockerfile.backend.release -t masshtab-academy-backend:release-$release .
docker build -f ops/Dockerfile.frontend.release -t masshtab-academy-frontend:release-$release .
docker run --rm --entrypoint python masshtab-academy-backend:release-$release -m compileall -q app
# Rollback skips migrations: the new tables are additive and can remain in place.
cp ops/rollback-20261004.yml "$backup/rollback.yml"
tar -cf - backend/app backend/alembic backend/alembic.ini frontend/src frontend/package.json frontend/package-lock.json frontend/Dockerfile.prod frontend/nginx.conf docker-compose.prod.yml ops | tar -xf - -C "$project"
docker tag masshtab-academy-backend:release-$release masshtab-academy-backend
docker tag masshtab-academy-frontend:release-$release masshtab-academy-frontend
cd "$project"
docker compose -p masshtab-academy -f docker-compose.prod.yml --env-file .env.prod up -d --no-build backend frontend
echo 'Release started; verify health and migrations before declaring success.'
