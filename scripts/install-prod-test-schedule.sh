#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CRON_MARKER="# finance-manager-prod-tests"
CRON_ENTRY="0 3 * * * cd '$PROJECT_DIR' && '$SCRIPT_DIR/test-prod.sh' scheduled >> '$PROJECT_DIR/prod-tests.log' 2>&1 $CRON_MARKER"

CURRENT_CRONTAB="$(crontab -l 2>/dev/null || true)"
UPDATED_CRONTAB="$(printf '%s\n' "$CURRENT_CRONTAB" | grep -vF "$CRON_MARKER" || true)"
UPDATED_CRONTAB="$(printf '%s\n' "$UPDATED_CRONTAB" | grep -v '^CRON_TZ=America/Sao_Paulo$' || true)"
{
  printf '%s\n' "$UPDATED_CRONTAB"
  printf 'CRON_TZ=America/Sao_Paulo\n%s\n' "$CRON_ENTRY"
} | crontab -

echo "Installed daily production tests at 03:00 America/Sao_Paulo."
