#!/bin/sh
set -eu
case "$CERTBOT_TOKEN" in *[!a-zA-Z0-9_-]*|'') exit 1;; esac
docker exec masshtab-academy-frontend-1 mkdir -p /usr/share/nginx/html/.well-known/acme-challenge
printf '%s' "$CERTBOT_VALIDATION" | docker exec -i masshtab-academy-frontend-1 sh -c 'cat > "/usr/share/nginx/html/.well-known/acme-challenge/$1"' sh "$CERTBOT_TOKEN"
