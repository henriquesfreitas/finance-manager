#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="finance-manager-telegram-update-bot"
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ "$PROJECT_DIR" =~ [[:space:]] ]]; then
  echo "ERROR: The project path cannot contain whitespace for this systemd service: $PROJECT_DIR" >&2
  exit 1
fi

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  echo "ERROR: .env file not found in $PROJECT_DIR." >&2
  exit 1
fi

if [[ "$EUID" -eq 0 ]]; then
  SERVICE_USER="${SUDO_USER:-}"
  if [[ -z "$SERVICE_USER" || "$SERVICE_USER" == "root" ]]; then
    echo "ERROR: Run this installer as the account that owns the project and can run Docker; use sudo only when prompted." >&2
    exit 1
  fi
else
  SERVICE_USER="$(id -un)"
fi

run_with_privileges() {
  if [[ "$EUID" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

if ! python3 "$PROJECT_DIR/scripts/telegram-update-bot.py" --check-webhook; then
  echo "ERROR: Telegram bot settings are invalid or long polling is unavailable." >&2
  exit 1
fi

UNIT_TEMP="$(mktemp)"
trap 'rm -f "$UNIT_TEMP"' EXIT
cat >"$UNIT_TEMP" <<UNIT
[Unit]
Description=Finance Manager Telegram production update bot
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$PROJECT_DIR
StateDirectory=finance-manager-telegram-update-bot
StateDirectoryMode=0700
ExecStart=/usr/bin/python3 $SCRIPT_DIR/telegram-update-bot.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

run_with_privileges install -m 0644 "$UNIT_TEMP" "$UNIT_PATH"
run_with_privileges systemctl daemon-reload
run_with_privileges systemctl enable --now "$SERVICE_NAME"

echo "Telegram production update bot installed and started."
echo "Check status with: sudo systemctl status $SERVICE_NAME"
echo "Follow logs with: sudo journalctl -u $SERVICE_NAME -f"
