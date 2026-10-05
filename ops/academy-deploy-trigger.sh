#!/usr/bin/env bash
# Install as /usr/local/sbin/academy-deploy-trigger, root-owned and mode 755.
# The dedicated Actions key uses this forced command in authorized_keys.
set -euo pipefail
if [[ ! ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  echo 'Expected: deploy <40-character main commit SHA>' >&2
  exit 1
fi
revision=${BASH_REMATCH[1]}
exec flock -n /opt/masshtab-academy-release.lock bash -s -- "$revision" <<'DEPLOY'
set -euo pipefail
cd /opt/masshtab-academy
test -z "$(git status --porcelain --untracked-files=no)"
git fetch origin main
test "$(git rev-parse origin/main)" = "$1"
git merge --ff-only "$1"
bash ops/deploy-production.sh "$1"
DEPLOY
