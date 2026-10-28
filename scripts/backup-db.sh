#!/bin/bash
set -uo pipefail
# Note: -e (exit on error) is intentionally omitted so failures are captured
# and reported via email rather than silently killing the script.

# ══════════════════════════════════════════════════════════════════════════════
# Finance Manager — Database Backup Script
#
# - Only backs up when data has changed since the last run
# - Uploads the dump to Cloudflare R2 via rclone
# - Always sends an HTML email: success report or failure alert
#
# Dependencies: rclone (with R2 remote named "r2"), curl, python3
#
# Crontab suggestion (runs every 6 hours):
#   0 */6 * * * /opt/finance-manager/scripts/backup-db.sh >> /var/log/finance-backup.log 2>&1
#
# Required env vars (in .env):
#   POSTGRES_USER, POSTGRES_DB
#   BACKUP_NOTIFY_EMAIL   — recipient address (your inbox)
#   BACKUP_FROM_EMAIL     — verified sender in Resend (e.g. backup@yourdomain.com)
#   RESEND_API_KEY        — API key from resend.com (send-only scope)
#   TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID — optional backup alerts via Telegram
# ══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
RETENTION_DAYS=30
R2_REMOTE="r2:general"
LAST_BACKUP_MARKER="$BACKUP_DIR/.last_backup_ts"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RUN_TIME=$(date '+%d/%m/%Y %H:%M')

cd "$PROJECT_DIR"

# ── Load env ──────────────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  echo "✗ .env file not found in $PROJECT_DIR" >&2
  exit 1
fi
set -a
source .env
set +a

mkdir -p "$BACKUP_DIR"

# ── Dependency checks ─────────────────────────────────────────────────────────
if ! command -v rclone &> /dev/null; then
  echo "✗ rclone not found. Run: curl https://rclone.org/install.sh | sudo bash" >&2
  exit 1
fi
if ! command -v curl &> /dev/null; then
  echo "✗ curl not found. Run: sudo apt-get install -y curl" >&2
  exit 1
fi

# ── psql_query <sql> — runs SQL via stdin to avoid shell quote escaping issues ─
psql_query() {
  echo "$1" | docker compose -f docker-compose.prod.yml exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -A
}

psql_query_csv() {
  echo "$1" | docker compose -f docker-compose.prod.yml exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -A -F '|'
}

backup_tables=(investments orders comments portfolio_comments treasury_products admin_users budgets budget_items bills bill_month_settlements)

# ── send_email <subject> <html_body> ─────────────────────────────────────────
send_email() {
  local subject="$1"
  local html_body="$2"

  local json_html
  json_html=$(echo "$html_body" | python3 -c "import sys, json; print(json.dumps(sys.stdin.read()))")

  local json_subject
  json_subject=$(echo "$subject" | python3 -c "import sys, json; print(json.dumps(sys.stdin.read().strip()))")

  local http_status
  http_status=$(curl -s -o /tmp/resend_response.json -w "%{http_code}" \
    -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer ${RESEND_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"from\": \"Finance Manager <${BACKUP_FROM_EMAIL}>\",
      \"to\": [\"${BACKUP_NOTIFY_EMAIL}\"],
      \"subject\": ${json_subject},
      \"html\": ${json_html}
    }")

  if [[ "$http_status" == "200" || "$http_status" == "201" ]]; then
    echo "✓ Email sent to ${BACKUP_NOTIFY_EMAIL}"
  else
    echo "⚠ Email notification failed (HTTP ${http_status})." >&2
    echo "  Response: $(cat /tmp/resend_response.json)" >&2
    rm -f /tmp/resend_response.json
    return 1
  fi
  rm -f /tmp/resend_response.json
  return 0
}

# ── send_telegram <message> ─────────────────────────────────────────────────
send_telegram() {
  local message="$1"

  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" && -z "${TELEGRAM_CHAT_ID:-}" ]]; then
    echo "→ Telegram is not configured; skipping Telegram notification."
    return 0
  fi
  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
    echo "⚠ Telegram notification failed: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must both be configured." >&2
    return 1
  fi

  local payload response_file http_status
  payload=$(python3 -c 'import json, sys; print(json.dumps({"chat_id": sys.argv[1], "text": sys.argv[2]}))' \
    "$TELEGRAM_CHAT_ID" "$message")
  response_file=$(mktemp)
  http_status=$(curl -s -o "$response_file" -w "%{http_code}" \
    -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "$payload")

  if [[ "$http_status" == "200" ]]; then
    echo "✓ Telegram message sent."
  else
    echo "⚠ Telegram notification failed (HTTP ${http_status:-unknown})." >&2
  fi
  rm -f "$response_file"
}

send_telegram_report() {
  local message="$1"
  local chunk
  local -a chunks=()

  mapfile -d '' -t chunks < <(python3 -c '
import sys

text = sys.argv[1]
limit = 3800  # Reserve space for the Telegram part label.
lines = text.splitlines() or [""]
chunks = []
current = ""
units = lambda value: len(value.encode("utf-16-le")) // 2
for line in lines:
    while units(line) > limit:
        if current:
            chunks.append(current)
            current = ""
        piece = ""
        remainder = ""
        for character in line:
            if units(piece + character) > limit:
                remainder = line[len(piece):]
                break
            piece += character
        chunks.append(piece)
        line = remainder
    candidate = line if not current else current + "\n" + line
    if units(candidate) > limit:
        chunks.append(current)
        current = line
    else:
        current = candidate
if current or not chunks:
    chunks.append(current)

for index, chunk in enumerate(chunks, start=1):
    sys.stdout.write(f"Part {index}/{len(chunks)}\n{chunk}\0")
' "$message")

  for chunk in "${chunks[@]}"; do
    if ! send_telegram "$chunk"; then
      send_email "[Finance Manager] Backup notification failed - ${RUN_TIME}" \
        '<!DOCTYPE html><html><body><h2>Finance Manager backup notification failed</h2><p>The database backup completed and was uploaded, but Telegram rejected the success report. Check the production backup log for details.</p></body></html>' || true
      return 1
    fi
  done
}

# ── send_failure_email <reason> ───────────────────────────────────────────────
send_failure_email() {
  local reason="$1"
  echo "→ Sending failure alert to ${BACKUP_NOTIFY_EMAIL}..."
  send_telegram "⚠ Finance Manager backup FAILED
Run time: ${RUN_TIME}
Error: ${reason}
Check the backup log on the server for details." || true

  local html
  html=$(cat <<HTMLEOF
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#333;max-width:700px;margin:0 auto;padding:20px;">
  <h2 style="color:#b91c1c;border-bottom:2px solid #b91c1c;padding-bottom:8px;">
    &#x26A0; Finance Manager — Backup Failed
  </h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr>
      <td style="padding:4px 0;color:#666;">Run time</td>
      <td style="padding:4px 0;font-weight:bold;">${RUN_TIME}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;color:#666;">Error</td>
      <td style="padding:4px 0;font-weight:bold;color:#b91c1c;">${reason}</td>
    </tr>
  </table>
  <p style="color:#555;">The backup did not complete. Please check <code>/var/log/finance-backup.log</code> on the server for details.</p>
  <p style="margin-top:24px;font-size:12px;color:#aaa;">Sent automatically by Finance Manager backup script.</p>
</body>
</html>
HTMLEOF
)
  send_email "[Finance Manager] Backup FAILED - ${RUN_TIME}" "$html"
}

# Report unexpected command failures that are not handled explicitly below.
# Disable the trap while sending the alert so a notification failure cannot recurse.
handle_unexpected_error() {
  local exit_code=$?
  local line_number=$1
  trap - ERR
  send_failure_email "Unexpected error at line ${line_number} (exit code ${exit_code}). Check the backup log for details."
  exit "$exit_code"
}
trap 'handle_unexpected_error "$LINENO"' ERR

# ── Check if any user data changed since last backup ─────────────────────────
# Queries are passed via stdin to avoid bash mangling double-quoted column names.
LATEST_CHANGE=$(psql_query '
  SELECT COALESCE(MAX(latest)::text, '"'"'epoch'"'"') || '"'"'|v2|'"'"'
    || (SELECT md5(COALESCE(string_agg(to_jsonb(i)::text, '"'"''"'"' ORDER BY i.id), '"'"''"'"')) FROM investments AS i) || '"'"'|'"'"'
    || (SELECT md5(COALESCE(string_agg(to_jsonb(o)::text, '"'"''"'"' ORDER BY o.id), '"'"''"'"')) FROM orders AS o) || '"'"'|'"'"'
    || (SELECT md5(COALESCE(string_agg(to_jsonb(c)::text, '"'"''"'"' ORDER BY c.id), '"'"''"'"')) FROM comments AS c) || '"'"'|'"'"'
    || (SELECT md5(COALESCE(string_agg(to_jsonb(pc)::text, '"'"''"'"' ORDER BY pc.id), '"'"''"'"')) FROM portfolio_comments AS pc) || '"'"'|'"'"'
    || (SELECT md5(COALESCE(string_agg(to_jsonb(tp)::text, '"'"''"'"' ORDER BY tp.id), '"'"''"'"')) FROM treasury_products AS tp) || '"'"'|'"'"'
    || (SELECT md5(COALESCE(string_agg(to_jsonb(u)::text, '"'"''"'"' ORDER BY u.id), '"'"''"'"')) FROM admin_users AS u) || '"'"'|'"'"'
    || (SELECT md5(COALESCE(string_agg(to_jsonb(b)::text, '"'"''"'"' ORDER BY b.id), '"'"''"'"')) FROM budgets AS b) || '"'"'|'"'"'
    || (SELECT md5(COALESCE(string_agg(to_jsonb(bi)::text, '"'"''"'"' ORDER BY bi.id), '"'"''"'"')) FROM budget_items AS bi) || '"'"'|'"'"'
    || (SELECT md5(COALESCE(string_agg(to_jsonb(b)::text, '"'"''"'"' ORDER BY b.id), '"'"''"'"')) FROM bills AS b) || '"'"'|'"'"'
    || (SELECT md5(COALESCE(string_agg(to_jsonb(s)::text, '"'"''"'"' ORDER BY s.month), '"'"''"'"')) FROM bill_month_settlements AS s)
  FROM (
    SELECT MAX("updatedAt") AS latest FROM investments
    UNION ALL
    SELECT MAX("updatedAt") AS latest FROM orders
    UNION ALL
    SELECT MAX("updatedAt") AS latest FROM comments
    UNION ALL
    SELECT MAX("updatedAt") AS latest FROM portfolio_comments
    UNION ALL
    SELECT MAX("createdAt") AS latest FROM treasury_products
    UNION ALL
    SELECT MAX("updatedAt") AS latest FROM bills
    UNION ALL
    SELECT MAX("updatedAt") AS latest FROM admin_users
    UNION ALL
    SELECT MAX("createdAt") AS latest FROM budgets
    UNION ALL
    SELECT MAX("updatedAt") AS latest FROM budget_items
    UNION ALL
    SELECT MAX("updatedAt") AS latest FROM bill_month_settlements
  ) sub;
' 2>&1) || { send_failure_email "Could not query database: ${LATEST_CHANGE}"; exit 1; }

if [[ -z "$LATEST_CHANGE" ]]; then
  echo "→ Could not determine last data change. Skipping backup."
  exit 0
fi

if [[ -f "$LAST_BACKUP_MARKER" ]]; then
  LAST_BACKUP_TS=$(cat "$LAST_BACKUP_MARKER")

  if [[ "$LATEST_CHANGE" == "$LAST_BACKUP_TS" ]]; then
    echo "→ No data changes since last backup (${LAST_BACKUP_TS}). Skipping."
    exit 0
  fi

  echo "→ Data changed since ${LAST_BACKUP_TS}. Proceeding with backup."
else
  echo "→ No previous backup marker found. Proceeding with first backup."
fi

IFS='|' read -r -a current_snapshot <<< "$LATEST_CHANGE"
CHANGED_TABLES=()
if [[ -f "$LAST_BACKUP_MARKER" ]]; then
  IFS='|' read -r -a previous_snapshot <<< "$LAST_BACKUP_TS"
fi
if [[ ! -f "$LAST_BACKUP_MARKER" || "${current_snapshot[1]:-}" != "v2" || "${previous_snapshot[1]:-}" != "v2" ]]; then
  CHANGED_TABLES=("${backup_tables[@]}")
else
  for index in "${!backup_tables[@]}"; do
    snapshot_index=$((index + 2))
    if [[ "${current_snapshot[$snapshot_index]:-}" != "${previous_snapshot[$snapshot_index]:-}" ]]; then
      CHANGED_TABLES+=("${backup_tables[$index]}")
    fi
  done
fi

# ── Run pg_dump ───────────────────────────────────────────────────────────────
BACKUP_FILE="$BACKUP_DIR/finance_${TIMESTAMP}.sql.gz"
echo "→ Dumping database to $BACKUP_FILE..."

if ! docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "$BACKUP_FILE"; then
  send_failure_email "pg_dump failed. Check that the postgres container is running."
  exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✓ Dump complete: ${BACKUP_SIZE}"

# ── Upload to Cloudflare R2 ───────────────────────────────────────────────────
echo "→ Uploading to R2 ($R2_REMOTE)..."

if ! rclone copy "$BACKUP_FILE" "$R2_REMOTE" --no-check-dest; then
  send_failure_email "rclone upload to ${R2_REMOTE} failed. Local backup retained at $(basename "$BACKUP_FILE")."
  exit 1
fi

echo "✓ Uploaded to ${R2_REMOTE}/$(basename "$BACKUP_FILE")"
echo "$LATEST_CHANGE" > "$LAST_BACKUP_MARKER"

# ── Count recent additions and updates for changed tables ────────────────────
ACTIVITY_COUNTS=$(psql_query_csv '
  SELECT table_name, added, updated FROM (
    SELECT '"'"'investments'"'"' AS table_name,
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '"'"'6 hours'"'"') AS added,
      COUNT(*) FILTER (WHERE "updatedAt" >= NOW() - INTERVAL '"'"'6 hours'"'"' AND "createdAt" < NOW() - INTERVAL '"'"'6 hours'"'"') AS updated
    FROM investments
    UNION ALL SELECT '"'"'orders'"'"', COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '"'"'6 hours'"'"'), COUNT(*) FILTER (WHERE "updatedAt" >= NOW() - INTERVAL '"'"'6 hours'"'"' AND "createdAt" < NOW() - INTERVAL '"'"'6 hours'"'"') FROM orders
    UNION ALL SELECT '"'"'comments'"'"', COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '"'"'6 hours'"'"'), COUNT(*) FILTER (WHERE "updatedAt" >= NOW() - INTERVAL '"'"'6 hours'"'"' AND "createdAt" < NOW() - INTERVAL '"'"'6 hours'"'"') FROM comments
    UNION ALL SELECT '"'"'portfolio_comments'"'"', COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '"'"'6 hours'"'"'), COUNT(*) FILTER (WHERE "updatedAt" >= NOW() - INTERVAL '"'"'6 hours'"'"' AND "createdAt" < NOW() - INTERVAL '"'"'6 hours'"'"') FROM portfolio_comments
    UNION ALL SELECT '"'"'treasury_products'"'"', COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '"'"'6 hours'"'"'), 0 FROM treasury_products
    UNION ALL SELECT '"'"'admin_users'"'"', COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '"'"'6 hours'"'"'), COUNT(*) FILTER (WHERE "updatedAt" >= NOW() - INTERVAL '"'"'6 hours'"'"' AND "createdAt" < NOW() - INTERVAL '"'"'6 hours'"'"') FROM admin_users
    UNION ALL SELECT '"'"'budgets'"'"', COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '"'"'6 hours'"'"'), 0 FROM budgets
    UNION ALL SELECT '"'"'budget_items'"'"', COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '"'"'6 hours'"'"'), COUNT(*) FILTER (WHERE "updatedAt" >= NOW() - INTERVAL '"'"'6 hours'"'"' AND "createdAt" < NOW() - INTERVAL '"'"'6 hours'"'"') FROM budget_items
    UNION ALL SELECT '"'"'bills'"'"', COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '"'"'6 hours'"'"'), COUNT(*) FILTER (WHERE "updatedAt" >= NOW() - INTERVAL '"'"'6 hours'"'"' AND "createdAt" < NOW() - INTERVAL '"'"'6 hours'"'"') FROM bills
    UNION ALL SELECT '"'"'bill_month_settlements'"'"', 0, COUNT(*) FILTER (WHERE "updatedAt" >= NOW() - INTERVAL '"'"'6 hours'"'"') FROM bill_month_settlements
  ) counts
  ORDER BY table_name;
' 2>/dev/null || echo "")

CHANGED_TABLES_REPORT="Tables changed since the previous backup (row counts from the last 6 hours):"
if [[ ${#CHANGED_TABLES[@]} -eq 0 ]]; then
  CHANGED_TABLES_REPORT+=$'\nNo table changes detected.'
else
  declare -A activity_by_table=()
  while IFS='|' read -r table_name added_count updated_count; do
    [[ -n "$table_name" ]] || continue
    activity_by_table["$table_name"]="${added_count} added, ${updated_count} updated"
  done <<< "$ACTIVITY_COUNTS"
  for changed_table in "${CHANGED_TABLES[@]}"; do
    CHANGED_TABLES_REPORT+=$'\n'"${changed_table}: ${activity_by_table[$changed_table]:-counts unavailable}"
  done
fi

# ── Query recent activity for the success email ───────────────────────────────
INVESTMENTS_ROWS=$(psql_query_csv '
  SELECT
    ticker,
    type,
    COALESCE(sector, '"'"'-'"'"') AS sector,
    CASE WHEN "archivedAt" IS NOT NULL THEN '"'"'archived'"'"' ELSE '"'"'active'"'"' END AS status,
    to_char("updatedAt" AT TIME ZONE '"'"'America/Sao_Paulo'"'"', '"'"'DD/MM/YY HH24:MI'"'"') AS updated
  FROM investments
  WHERE "updatedAt" >= NOW() - INTERVAL '"'"'7 days'"'"'
  ORDER BY "updatedAt" DESC
  LIMIT 10;
' 2>/dev/null || echo "")

ORDERS_ROWS=$(psql_query_csv '
  SELECT
    i.ticker,
    o.type,
    TRIM(TO_CHAR(o.quantity::numeric, '"'"'999999990.99'"'"')) AS qty,
    TRIM(TO_CHAR(o.price::numeric, '"'"'FM999999990.00'"'"')) AS price,
    to_char(o."orderDate", '"'"'DD/MM/YY'"'"') AS order_date,
    to_char(o."updatedAt" AT TIME ZONE '"'"'America/Sao_Paulo'"'"', '"'"'DD/MM/YY HH24:MI'"'"') AS updated
  FROM orders o
  JOIN investments i ON i.id = o."investmentId"
  WHERE o."updatedAt" >= NOW() - INTERVAL '"'"'7 days'"'"'
  ORDER BY o."updatedAt" DESC
  LIMIT 10;
' 2>/dev/null || echo "")

# ── Build HTML table rows from pipe-delimited psql output ────────────────────
build_table_rows() {
  local data="$1"
  local colspan="$2"
  local rows=""

  if [[ -z "$data" ]]; then
    echo "<tr><td colspan='${colspan}' style='text-align:center;color:#888;padding:12px;'>No activity in the last 7 days</td></tr>"
    return
  fi

  while IFS='|' read -r -a fields; do
    rows+="<tr>"
    for field in "${fields[@]}"; do
      rows+="<td style='padding:6px 10px;border-bottom:1px solid #eee;'>${field}</td>"
    done
    rows+="</tr>"
  done <<< "$data"

  echo "$rows"
}

INV_ROWS=$(build_table_rows "$INVESTMENTS_ROWS" "5")
ORD_ROWS=$(build_table_rows "$ORDERS_ROWS" "6")

# ── Compose and send success email ───────────────────────────────────────────
echo "→ Sending success email to ${BACKUP_NOTIFY_EMAIL}..."

SUCCESS_HTML=$(cat <<HTMLEOF
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#333;max-width:700px;margin:0 auto;padding:20px;">

  <h2 style="color:#1a1a2e;border-bottom:2px solid #4f46e5;padding-bottom:8px;">
    Finance Manager — Backup Report
  </h2>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr>
      <td style="padding:4px 0;color:#666;">Run time</td>
      <td style="padding:4px 0;font-weight:bold;">${RUN_TIME}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;color:#666;">Backup file</td>
      <td style="padding:4px 0;font-weight:bold;">$(basename "$BACKUP_FILE")</td>
    </tr>
    <tr>
      <td style="padding:4px 0;color:#666;">Size</td>
      <td style="padding:4px 0;font-weight:bold;">${BACKUP_SIZE}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;color:#666;">Stored in</td>
      <td style="padding:4px 0;font-weight:bold;">${R2_REMOTE}</td>
    </tr>
  </table>

  <h3 style="color:#1a1a2e;margin-top:24px;">Investments — last 7 days (max 10)</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="background:#4f46e5;color:white;">
        <th style="padding:8px 10px;text-align:left;">Ticker</th>
        <th style="padding:8px 10px;text-align:left;">Type</th>
        <th style="padding:8px 10px;text-align:left;">Sector</th>
        <th style="padding:8px 10px;text-align:left;">Status</th>
        <th style="padding:8px 10px;text-align:left;">Updated</th>
      </tr>
    </thead>
    <tbody>${INV_ROWS}</tbody>
  </table>

  <h3 style="color:#1a1a2e;margin-top:24px;">Orders — last 7 days (max 10)</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="background:#4f46e5;color:white;">
        <th style="padding:8px 10px;text-align:left;">Ticker</th>
        <th style="padding:8px 10px;text-align:left;">Type</th>
        <th style="padding:8px 10px;text-align:left;">Qty</th>
        <th style="padding:8px 10px;text-align:left;">Price</th>
        <th style="padding:8px 10px;text-align:left;">Order Date</th>
        <th style="padding:8px 10px;text-align:left;">Updated</th>
      </tr>
    </thead>
    <tbody>${ORD_ROWS}</tbody>
  </table>

  <p style="margin-top:24px;font-size:12px;color:#aaa;">
    Sent automatically by Finance Manager backup script.
  </p>

</body>
</html>
HTMLEOF
)

send_email "[Finance Manager] Backup ${TIMESTAMP} - ${BACKUP_SIZE}" "$SUCCESS_HTML" || true
send_telegram_report "✓ Finance Manager backup completed
Run time: ${RUN_TIME}
Backup file: $(basename "$BACKUP_FILE")
Size: ${BACKUP_SIZE}
Stored in: ${R2_REMOTE}
${CHANGED_TABLES_REPORT}" || true

# ── Clean up local backups older than retention window ───────────────────────
echo "→ Cleaning local backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "✓ All done: $(date)"
