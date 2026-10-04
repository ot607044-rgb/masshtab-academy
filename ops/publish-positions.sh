#!/bin/sh
set -eu
release=20261004-positions
project=/opt/masshtab-academy
stage=/srv/academy-release-$release
backup=/opt/backups/masshtab-academy/$release
test ! -e "$backup"
umask 077
mkdir -p "$backup"
docker tag masshtab-academy-backend masshtab-academy-backend:rollback-$release
docker tag masshtab-academy-frontend masshtab-academy-frontend:rollback-$release
docker exec masshtab-academy-db-1 pg_dump -U masshtab_user -d masshtab_academy -Fc > "$backup/database.dump"
docker exec -i masshtab-academy-db-1 pg_restore --list < "$backup/database.dump" > "$backup/database.contents"
tar -czf "$backup/source.tar.gz" -C "$project" --exclude=.git --exclude=node_modules .
tar -czf "$backup/uploads.tar.gz" -C /var/lib/docker/volumes/masshtab-academy_uploads_data/_data .
docker exec masshtab-academy-db-1 psql -U masshtab_user -d masshtab_academy -Atc 'select (select count(*) from companies), (select count(*) from positions), (select count(*) from employees), (select count(*) from departments)' > "$backup/counts.before"
sha256sum "$backup"/*.gz "$backup/database.dump" > "$backup/SHA256SUMS"
cd "$stage"
docker build -f ops/Dockerfile.positions.release -t masshtab-academy-backend:release-$release .
docker build -f ops/Dockerfile.frontend.release --build-arg BASE_IMAGE=masshtab-academy-frontend:rollback-$release -t masshtab-academy-frontend:release-$release .
docker run --rm --entrypoint python masshtab-academy-backend:release-$release -m compileall -q app
# The database schema is unchanged, so normal entrypoint is safe on rollback.
cp ops/rollback-positions.yml "$backup/rollback.yml"
tar -cf - backend/app/api/v1/positions.py backend/app/schemas/position.py frontend/src/components/CreateModal.tsx frontend/src/pages/PositionsPage.tsx frontend/src/pages/PageContent.module.css frontend/src/types/index.ts ops/Dockerfile.positions.release ops/publish-positions.sh ops/rollback-positions.yml | tar -xf - -C "$project"
docker tag masshtab-academy-backend:release-$release masshtab-academy-backend
docker tag masshtab-academy-frontend:release-$release masshtab-academy-frontend
cd "$project"
docker compose -p masshtab-academy -f docker-compose.prod.yml --env-file .env.prod up -d --no-build backend frontend
echo "Release started. Backup: $backup"
