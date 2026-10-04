#!/bin/sh
set -eu
release=20261004-employee-profile
project=/opt/masshtab-academy
stage=/srv/academy-release-$release
backup=/opt/backups/masshtab-academy/$release
expected_frontend=sha256:ddfa5ff0ff5ed19877da1b44ddc1dc473bac9c3c6c58e9f4787183b729dc33ab
test "$(docker inspect masshtab-academy-frontend-1 --format '{{.Image}}')" = "$expected_frontend"
test ! -e "$backup"
umask 077
mkdir -p "$backup"
docker tag masshtab-academy-backend masshtab-academy-backend:rollback-$release
docker tag masshtab-academy-frontend masshtab-academy-frontend:rollback-$release
docker exec masshtab-academy-db-1 pg_dump -U masshtab_user -d masshtab_academy -Fc > "$backup/database.dump"
docker exec -i masshtab-academy-db-1 pg_restore --list < "$backup/database.dump" > "$backup/database.contents"
tar -czf "$backup/source.tar.gz" -C "$project" --exclude=.git --exclude=node_modules .
tar -czf "$backup/uploads.tar.gz" -C /var/lib/docker/volumes/masshtab-academy_uploads_data/_data .
docker exec masshtab-academy-db-1 psql -U masshtab_user -d masshtab_academy -Atc 'select (select count(*) from employees), (select count(*) from lesson_assignments), (select count(*) from test_attempts), (select count(*) from departments), (select count(*) from positions)' > "$backup/counts.before"
sha256sum "$backup"/*.gz "$backup/database.dump" > "$backup/SHA256SUMS"
cd "$stage"
docker build -f ops/Dockerfile.employee-profile.release -t masshtab-academy-backend:release-$release .
docker build -f ops/Dockerfile.frontend.release --build-arg BASE_IMAGE=masshtab-academy-frontend:rollback-$release -t masshtab-academy-frontend:release-$release .
docker run --rm --entrypoint python masshtab-academy-backend:release-$release -m compileall -q app
cp ops/rollback-employee-profile.yml "$backup/rollback.yml"
test "$(docker inspect masshtab-academy-frontend-1 --format '{{.Image}}')" = "$expected_frontend"
tar -cf - backend/app/api/v1/employees.py backend/app/schemas/employee.py frontend/src/pages/EmployeesPage.tsx frontend/src/pages/EmployeeDetailPage.tsx frontend/src/components/EmployeeEditModal.tsx frontend/src/api/employees.ts frontend/src/types/index.ts frontend/src/styles/global.css ops/Dockerfile.employee-profile.release ops/publish-employee-profile.sh ops/rollback-employee-profile.yml | tar -xf - -C "$project"
docker tag masshtab-academy-backend:release-$release masshtab-academy-backend
docker tag masshtab-academy-frontend:release-$release masshtab-academy-frontend
cd "$project"
docker compose -p masshtab-academy -f docker-compose.prod.yml --env-file .env.prod up -d --no-build backend frontend
echo "Release started. Backup: $backup"
