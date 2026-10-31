#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

if ! compgen -G "$PROJECT_DIR/certbot/conf/renewal/*.conf" >/dev/null; then
  echo "No Let's Encrypt renewal configuration found; skipping."
  exit 0
fi

docker run --rm \
  -v "$PROJECT_DIR/certbot/www:/var/www/certbot" \
  -v "$PROJECT_DIR/certbot/conf:/etc/letsencrypt" \
  certbot/certbot renew --webroot --webroot-path=/var/www/certbot --quiet

# Nginx reads certificate files at startup, so reload it after Certbot checks
# for renewal to make a newly issued certificate available without downtime.
docker compose --env-file .env -f docker-compose.prod.yml exec -T nginx nginx -s reload
