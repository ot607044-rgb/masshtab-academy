#!/bin/sh
set -eu
release=20261004-employee-photo
project=/opt/masshtab-academy
stage=/srv/academy-release-$release
backup=/opt/backups/masshtab-academy/$release
expected_frontend=sha256:54e49604c88e5593522a46ce224c4cecfdf9184fcd61516103aad644fbdbf3f7
expected_backend=sha256:281dc4443c64daa66d0928ef4c35f05c95b31e9512e8137d0a323346ef96427c
check_images() {
  test "$(docker inspect masshtab-academy-frontend-1 --format '{{.Image}}')" = "$expected_frontend"
  test "$(docker inspect masshtab-academy-backend-1 --format '{{.Image}}')" = "$expected_backend"
}
check_images
test ! -e "$backup"
umask 077
mkdir -p "$backup"
docker tag masshtab-academy-backend masshtab-academy-backend:rollback-$release
docker tag masshtab-academy-frontend masshtab-academy-frontend:rollback-$release
docker exec masshtab-academy-db-1 pg_dump -U masshtab_user -d masshtab_academy -Fc > "$backup/database.dump"
docker exec -i masshtab-academy-db-1 pg_restore --list < "$backup/database.dump" > "$backup/database.contents"
tar -czf "$backup/source.tar.gz" -C "$project" --exclude=.git --exclude=node_modules .
tar -czf "$backup/uploads.tar.gz" -C /var/lib/docker/volumes/masshtab-academy_uploads_data/_data .
sha256sum "$backup"/*.gz "$backup/database.dump" > "$backup/SHA256SUMS"
cd "$stage"
docker build -f ops/Dockerfile.employee-photo.rollback -t masshtab-academy-backend:rollback-private-$release .
docker build -f ops/Dockerfile.employee-photo.release -t masshtab-academy-backend:release-$release .
docker build -f ops/Dockerfile.frontend.release --build-arg BASE_IMAGE=masshtab-academy-frontend:rollback-$release -t masshtab-academy-frontend:release-$release .
docker run --rm --entrypoint python masshtab-academy-backend:release-$release -m compileall -q app
cp ops/rollback-employee-photo.yml "$backup/rollback.yml"
check_images
tar -cf - backend/app/core/employee_photos.py backend/app/main.py backend/app/models/employee.py backend/app/schemas/employee.py backend/app/api/v1/employees.py backend/app/api/v1/workspace.py backend/alembic/versions/010_employee_photos.py backend/requirements.txt frontend/src/components/EmployeePhoto.tsx frontend/src/components/EmployeePhoto.module.css frontend/src/pages/EmployeesPage.tsx frontend/src/pages/EmployeeDetailPage.tsx frontend/src/api/employees.ts frontend/src/types/index.ts | tar -xf - -C "$project"
docker tag masshtab-academy-backend:release-$release masshtab-academy-backend
docker tag masshtab-academy-frontend:release-$release masshtab-academy-frontend
cd "$project"
docker compose -p masshtab-academy -f docker-compose.prod.yml --env-file .env.prod up -d --no-build backend frontend
echo "Release started. Backup: $backup"
