#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SYSTEM_TIMEZONE="$(timedatectl show -p Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null || echo UTC)"

CURRENT_CRONTAB="$(crontab -l 2>/dev/null || true)"

# Replace only this project's known jobs. This also migrates the older backup
# and price-alert entries that were documented without managed markers.
UPDATED_CRONTAB="$(printf '%s\n' "$CURRENT_CRONTAB" \
  | grep -vE '(^|[[:space:]])# finance-manager-(backup|price-targets|prod-tests|ssl-renewal)([[:space:]]|$)' \
  | grep -vE 'scripts/(backup-db|check-price-targets|test-prod|renew-ssl)\.sh' || true)"

# The previous installer left this timezone directive immediately before its
# managed test entry. Remove that legacy directive only when migrating it.
if grep -qF '# finance-manager-prod-tests' <<<"$CURRENT_CRONTAB"; then
  UPDATED_CRONTAB="$(printf '%s\n' "$UPDATED_CRONTAB" | grep -v '^CRON_TZ=America/Sao_Paulo$' || true)"
fi

{
  printf '%s\n' "$UPDATED_CRONTAB"
  printf '\n# Finance Manager production schedules\n'
  # Preserve the live VPS schedule: backups follow the host timezone (UTC).
  printf 'CRON_TZ=%s\n' "$SYSTEM_TIMEZONE"
  printf "0 */6 * * * cd '%s' && '%s/backup-db.sh' >> '%s/backup.log' 2>&1 # finance-manager-backup\n" \
    "$PROJECT_DIR" "$SCRIPT_DIR" "$PROJECT_DIR"
  printf 'CRON_TZ=America/Sao_Paulo\n'
  printf "0 11 * * 1,4 cd '%s' && '%s/check-price-targets.sh' >> '%s/finance-target-alerts.log' 2>&1 # finance-manager-price-targets\n" \
    "$PROJECT_DIR" "$SCRIPT_DIR" "$PROJECT_DIR"
  printf "0 3 * * * cd '%s' && '%s/test-prod.sh' scheduled >> '%s/prod-tests.log' 2>&1 # finance-manager-prod-tests\n" \
    "$PROJECT_DIR" "$SCRIPT_DIR" "$PROJECT_DIR"
  if compgen -G "$PROJECT_DIR/certbot/conf/renewal/*.conf" >/dev/null; then
    printf "0 4 * * * cd '%s' && '%s/renew-ssl.sh' >> '%s/ssl-renewal.log' 2>&1 # finance-manager-ssl-renewal\n" \
      "$PROJECT_DIR" "$SCRIPT_DIR" "$PROJECT_DIR"
  fi
  printf 'CRON_TZ=%s\n' "$SYSTEM_TIMEZONE"
} | crontab -

echo "Installed backup (every 6 hours in $SYSTEM_TIMEZONE), price-target alerts (11:00 Mon/Thu), and production tests (03:00 daily in America/Sao_Paulo)."
if compgen -G "$PROJECT_DIR/certbot/conf/renewal/*.conf" >/dev/null; then
  echo "Installed daily Let's Encrypt renewal check at 04:00 America/Sao_Paulo."
fi
