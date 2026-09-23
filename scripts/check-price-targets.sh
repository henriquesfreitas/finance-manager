#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${ENV_FILE:-.env}"

cd "$PROJECT_DIR"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: $PROJECT_DIR/$ENV_FILE" >&2
  exit 1
fi

# Read the existing Resend settings so they can be forwarded only to this job,
# rather than exposing the email API key to the long-running app container.
set -a
source "$ENV_FILE"
set +a

docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml exec -T \
  -e BACKUP_NOTIFY_EMAIL \
  -e BACKUP_FROM_EMAIL \
  -e RESEND_API_KEY \
  server node dist/jobs/target-price-alerts.js
