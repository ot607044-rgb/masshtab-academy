#!/bin/sh
set -eu
case "$CERTBOT_TOKEN" in *[!a-zA-Z0-9_-]*|'') exit 1;; esac
docker exec masshtab-academy-frontend-1 rm -f "/usr/share/nginx/html/.well-known/acme-challenge/$CERTBOT_TOKEN"
