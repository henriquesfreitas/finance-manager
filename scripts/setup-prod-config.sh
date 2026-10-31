#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found. Copy .env.production.example to .env and configure it first." >&2
  exit 1
fi

for command_name in crontab docker rclone python3; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "ERROR: Required command not found: $command_name" >&2
    exit 1
  fi
done

if ! rclone listremotes | grep -qx 'r2:'; then
  echo "ERROR: Configure an rclone remote named 'r2' before setting up production schedules." >&2
  exit 1
fi

if ! rclone lsd r2:general >/dev/null 2>&1; then
  echo "ERROR: The configured r2 remote cannot access the 'general' bucket used by backup-db.sh." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

required_job_settings=(POSTGRES_USER POSTGRES_DB BACKUP_NOTIFY_EMAIL BACKUP_FROM_EMAIL RESEND_API_KEY)
missing_job_settings=()
for setting in "${required_job_settings[@]}"; do
  if [[ -z "${!setting:-}" ]]; then
    missing_job_settings+=("$setting")
  fi
done

if ((${#missing_job_settings[@]} > 0)); then
  printf 'ERROR: Set these values in .env before installing production schedules: %s\n' \
    "${missing_job_settings[*]}" >&2
  exit 1
fi

required_telegram_settings=(TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID TELEGRAM_ALLOWED_USER_ID)
missing_telegram_settings=()
for setting in "${required_telegram_settings[@]}"; do
  if [[ -z "${!setting:-}" ]]; then
    missing_telegram_settings+=("$setting")
  fi
done

if ((${#missing_telegram_settings[@]} > 0)); then
  printf 'ERROR: Set these values in .env before installing the Telegram update service: %s\n' \
    "${missing_telegram_settings[*]}" >&2
  exit 1
fi

bash "$SCRIPT_DIR/install-prod-test-schedule.sh"
bash "$SCRIPT_DIR/install-telegram-update-bot.sh"

echo "Production host configuration is installed. Verify with: crontab -l"
echo "Telegram service: sudo systemctl status finance-manager-telegram-update-bot"
