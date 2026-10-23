#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${ENV_FILE:-.env}"
RUN_SOURCE="${1:-manual}"

cd "$PROJECT_DIR"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: $PROJECT_DIR/$ENV_FILE" >&2
  exit 2
fi

set -a
source "$ENV_FILE"
set +a

OUTPUT_FILE="$(mktemp)"
trap 'rm -f "$OUTPUT_FILE"' EXIT

echo "[prod-tests] Starting $RUN_SOURCE production test run at $(date --iso-8601=seconds)"

notify_failure() {
  local status="$1"
  cat "$OUTPUT_FILE" >&2
  echo "[prod-tests] Tests failed during $CURRENT_STEP with exit code $status." >&2

  if [[ "$RUN_SOURCE" == "telegram" ]]; then
    echo "[prod-tests] Telegram failure details will be sent by the update bot." >&2
    return "$status"
  fi

  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
    echo "[prod-tests] Telegram notification skipped: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be configured." >&2
    return "$status"
  fi

  ERROR_TAIL="$(tail -c 2800 "$OUTPUT_FILE")"
  RUN_AT="$(date --iso-8601=seconds)"
  export RUN_SOURCE RUN_AT STATUS="$status" ERROR_TAIL
  if python3 - <<'PY'
import json
import os
import urllib.error
import urllib.request

token = os.environ["TELEGRAM_BOT_TOKEN"]
chat_id = os.environ["TELEGRAM_CHAT_ID"]
message = (
    f"Finance Manager production tests FAILED ({os.environ['RUN_SOURCE']})\n"
    f"Time: {os.environ['RUN_AT']}\n"
    f"Exit code: {os.environ['STATUS']}\n\n"
    f"Last test output:\n{os.environ['ERROR_TAIL']}"
)
request = urllib.request.Request(
    f"https://api.telegram.org/bot{token}/sendMessage",
    data=json.dumps({"chat_id": chat_id, "text": message}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(request, timeout=15) as response:
        result = json.loads(response.read())
    if not result.get("ok"):
        raise RuntimeError("Telegram rejected the notification")
except (urllib.error.URLError, TimeoutError, ValueError, RuntimeError):
    print("[prod-tests] Telegram notification failed; check Telegram configuration and connectivity.", file=__import__("sys").stderr)
    raise SystemExit(1)
print("[prod-tests] Failure details sent to Telegram.")
PY
  then
    return "$status"
  fi
  return 1
}

run_test_step() {
  local step="$1"
  shift
  CURRENT_STEP="$step"
  echo "BOT_STEP:$step"
  if "$@" >"$OUTPUT_FILE" 2>&1; then
    cat "$OUTPUT_FILE"
    : >"$OUTPUT_FILE"
  else
    local status=$?
    notify_failure "$status"
    exit $?
  fi
}

run_test_step test_build docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml --profile test build test-runner
run_test_step test_run docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml --profile test run --no-build --rm test-runner
echo "[prod-tests] Tests passed."
