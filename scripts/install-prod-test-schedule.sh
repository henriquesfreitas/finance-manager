#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SYSTEM_TIMEZONE="$(timedatectl show -p Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null || echo UTC)"

# The production VPS uses Ubuntu's standard cron package, which schedules this
# user's jobs in the host timezone. Keep the host on UTC and use explicit UTC
# equivalents for the America/Sao_Paulo jobs (UTC-3).
case "$SYSTEM_TIMEZONE" in
  UTC|Etc/UTC) ;;
  *)
    printf 'ERROR: Expected the VPS timezone to be UTC, but found %s. Set it to UTC before installing production schedules.\n' \
      "$SYSTEM_TIMEZONE" >&2
    exit 1
    ;;
esac

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
  # Keep backups on the host's UTC clock.
  printf "0 */6 * * * cd '%s' && '%s/backup-db.sh' >> '%s/backup.log' 2>&1 # finance-manager-backup\n" \
    "$PROJECT_DIR" "$SCRIPT_DIR" "$PROJECT_DIR"
  # America/Sao_Paulo is UTC-3: 11:00 becomes 14:00 UTC.
  printf "0 14 * * 1,4 cd '%s' && '%s/check-price-targets.sh' >> '%s/finance-target-alerts.log' 2>&1 # finance-manager-price-targets\n" \
    "$PROJECT_DIR" "$SCRIPT_DIR" "$PROJECT_DIR"
  # Run through Bash because the tracked script is not executable (mode 100644).
  # America/Sao_Paulo 03:00 becomes 06:00 UTC.
  printf "0 6 * * * cd '%s' && /bin/bash '%s/test-prod.sh' scheduled >> '%s/prod-tests.log' 2>&1 # finance-manager-prod-tests\n" \
    "$PROJECT_DIR" "$SCRIPT_DIR" "$PROJECT_DIR"
  if compgen -G "$PROJECT_DIR/certbot/conf/renewal/*.conf" >/dev/null; then
    # America/Sao_Paulo 04:00 becomes 07:00 UTC.
    printf "0 7 * * * cd '%s' && '%s/renew-ssl.sh' >> '%s/ssl-renewal.log' 2>&1 # finance-manager-ssl-renewal\n" \
      "$PROJECT_DIR" "$SCRIPT_DIR" "$PROJECT_DIR"
  fi
} | crontab -

echo "Installed backup (every 6 hours in UTC), price-target alerts (14:00 Mon/Thu UTC / 11:00 America/Sao_Paulo), and production tests (06:00 UTC / 03:00 America/Sao_Paulo daily)."
if compgen -G "$PROJECT_DIR/certbot/conf/renewal/*.conf" >/dev/null; then
  echo "Installed daily Let's Encrypt renewal check at 07:00 UTC / 04:00 America/Sao_Paulo."
fi
