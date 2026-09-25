#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${ENV_FILE:-.env}"

cd "$PROJECT_DIR"
echo "[target-alerts] Launcher started at $(date --iso-8601=seconds) on $(hostname)"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: $PROJECT_DIR/$ENV_FILE" >&2
  exit 1
fi

# Read the existing Resend settings so they can be forwarded only to this job,
# rather than exposing the email API key to the long-running app container.
set -a
source "$ENV_FILE"
set +a

if docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml exec -T \
  -e BACKUP_NOTIFY_EMAIL \
  -e BACKUP_FROM_EMAIL \
  -e RESEND_API_KEY \
  server node dist/jobs/target-price-alerts.js; then
  echo "[target-alerts] Launcher finished successfully at $(date --iso-8601=seconds)"
else
  status=$?
  echo "[target-alerts] Launcher failed with exit code $status at $(date --iso-8601=seconds)" >&2
  exit "$status"
fi
