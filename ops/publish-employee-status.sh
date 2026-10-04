#!/bin/sh
set -eu
release=20261004-employee-status
project=/opt/masshtab-academy
stage=/srv/academy-release-$release
backup=/opt/backups/masshtab-academy/$release
expected=$(cat "$stage/expected-image")
exec 9>/var/lock/masshtab-academy-employee-status.lock
flock -n 9
test "$(docker inspect masshtab-academy-frontend-1 --format '{{.Image}}')" = "$expected"
umask 077
if [ -e "$backup" ]; then
  test "$(cat "$backup/frontend.before")" = "$expected"
  sha256sum -c "$backup/SHA256SUMS"
else
mkdir -p "$backup"
docker tag "$expected" masshtab-academy-frontend:rollback-$release
tar -czf "$backup/frontend-source.tar.gz" -C "$project" frontend/src
docker inspect masshtab-academy-backend-1 --format '{{.Image}}' > "$backup/backend.before"
printf '%s\n' "$expected" > "$backup/frontend.before"
sha256sum "$backup/frontend-source.tar.gz" > "$backup/SHA256SUMS"
fi
cd "$stage"
docker build -f ops/Dockerfile.employee-status.release --build-arg BASE_IMAGE=masshtab-academy-frontend:rollback-$release -t masshtab-academy-frontend:release-$release .
docker run --rm --network masshtab-academy_default --entrypoint nginx masshtab-academy-frontend:release-$release -t
test "$(docker inspect masshtab-academy-frontend-1 --format '{{.Image}}')" = "$expected"
rollback() {
  docker tag masshtab-academy-frontend:rollback-$release masshtab-academy-frontend
  tar -xzf "$backup/frontend-source.tar.gz" -C "$project"
  cd "$project"
  docker compose -p masshtab-academy -f docker-compose.prod.yml --env-file .env.prod up -d --no-build --no-deps frontend
}
trap 'rollback' HUP INT TERM
tar -cf - frontend/src/pages/EmployeesPage.tsx frontend/src/pages/EmployeeStatusFilters.module.css ops/publish-employee-status.sh ops/Dockerfile.employee-status.release | tar -xf - -C "$project"
docker tag masshtab-academy-frontend:release-$release masshtab-academy-frontend
cd "$project"
if ! docker compose -p masshtab-academy -f docker-compose.prod.yml --env-file .env.prod up -d --no-build --no-deps frontend; then rollback; exit 1; fi
ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl --fail --silent --show-error --max-time 5 http://127.0.0.1/dashboard/employees > "$backup/served-index.html" && cmp -s "$stage/frontend/dist/index.html" "$backup/served-index.html"; then ready=1; break; fi
  sleep 1
done
if [ "$ready" != 1 ]; then rollback; exit 1; fi
docker inspect masshtab-academy-backend-1 --format '{{.Image}}' > "$backup/backend.after"
cmp "$backup/backend.before" "$backup/backend.after"
echo "Published $release. Backup: $backup"
