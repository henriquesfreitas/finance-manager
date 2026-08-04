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
# ══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
RETENTION_DAYS=30
R2_REMOTE="r2:finance-backups"
LAST_BACKUP_MARKER="$BACKUP_DIR/.last_backup_ts"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RUN_TIME=$(date '+%d/%m/%Y %H:%M')

# Tracks failure reason — empty means success so far
FAILURE_REASON=""

cd "$PROJECT_DIR"

# ── Load env ──────────────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  echo "✗ .env file not found in $PROJECT_DIR" >&2
  # Can't send email without env vars — hard exit is the only option here
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

# ── send_email <subject> <html_body> ─────────────────────────────────────────
# Shared helper — called on both success and failure paths.
send_email() {
  local subject="$1"
  local html_body="$2"

  local json_html
  json_html=$(echo "$html_body" | python3 -c "import sys, json; print(json.dumps(sys.stdin.read()))")

  local http_status
  http_status=$(curl -s -o /tmp/resend_response.json -w "%{http_code}" \
    -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer ${RESEND_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"from\": \"Finance Manager <${BACKUP_FROM_EMAIL}>\",
      \"to\": [\"${BACKUP_NOTIFY_EMAIL}\"],
      \"subject\": $(echo "$subject" | python3 -c "import sys, json; print(json.dumps(sys.stdin.read().strip()))"),
      \"html\": ${json_html}
    }")

  if [[ "$http_status" == "200" || "$http_status" == "201" ]]; then
    echo "✓ Email sent to ${BACKUP_NOTIFY_EMAIL}"
  else
    echo "⚠ Email notification failed (HTTP ${http_status})." >&2
    echo "  Response: $(cat /tmp/resend_response.json)" >&2
  fi
  rm -f /tmp/resend_response.json
}

# ── send_failure_email <reason> ───────────────────────────────────────────────
send_failure_email() {
  local reason="$1"
  echo "→ Sending failure alert to ${BACKUP_NOTIFY_EMAIL}..."

  local html
  html=$(cat <<HTML
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
HTML
)
  send_email "[Finance Manager] ⚠ Backup FAILED — ${RUN_TIME}" "$html"
}

# ── Check if any user data changed since last backup ─────────────────────────
LATEST_CHANGE=$(docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -A -c "
    SELECT COALESCE(MAX(latest), 'epoch'::timestamptz)
    FROM (
      SELECT MAX("updatedAt") AS latest FROM investments
      UNION ALL
      SELECT MAX("updatedAt") AS latest FROM orders
      UNION ALL
      SELECT MAX("updatedAt") AS latest FROM comments
      UNION ALL
      SELECT MAX("createdAt") AS latest FROM treasury_products
    ) sub;
  " 2>&1) || { send_failure_email "Could not query database: ${LATEST_CHANGE}"; exit 1; }

if [[ -z "$LATEST_CHANGE" ]]; then
  echo "→ Could not determine last data change. Skipping backup."
  exit 0
fi

if [[ -f "$LAST_BACKUP_MARKER" ]]; then
  LAST_BACKUP_TS=$(cat "$LAST_BACKUP_MARKER")

  HAS_NEW_DATA=$(docker compose -f docker-compose.prod.yml exec -T postgres \
    psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -A -c "
      SELECT ('${LATEST_CHANGE}'::timestamptz > '${LAST_BACKUP_TS}'::timestamptz);
    " 2>&1) || { send_failure_email "Could not compare timestamps: ${HAS_NEW_DATA}"; exit 1; }

  if [[ "$HAS_NEW_DATA" != "t" ]]; then
    echo "→ No data changes since last backup (${LAST_BACKUP_TS}). Skipping."
    exit 0
  fi

  echo "→ Data changed since ${LAST_BACKUP_TS}. Proceeding with backup."
else
  echo "→ No previous backup marker found. Proceeding with first backup."
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

# ── Query recent activity for the success email ───────────────────────────────
INVESTMENTS_ROWS=$(docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -A -F '|' -c "
    SELECT
      ticker,
      type,
      COALESCE(sector, '-')                    AS sector,
      CASE WHEN "archivedAt" IS NOT NULL THEN 'archived' ELSE 'active' END AS status,
      to_char("updatedAt" AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YY HH24:MI') AS updated
    FROM investments
    WHERE "updatedAt" >= NOW() - INTERVAL '7 days'
    ORDER BY updated_at DESC
    LIMIT 10;
  " 2>/dev/null || echo "")

ORDERS_ROWS=$(docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -A -F '|' -c "
    SELECT
      i.ticker,
      o.type,
      TRIM(TO_CHAR(o.quantity::numeric,    '999999990.99')) AS qty,
      TRIM(TO_CHAR(o.price::numeric,       'FM999999990.00')) AS price,
      to_char(o."orderDate", 'DD/MM/YY')   AS order_date,
      to_char(o."updatedAt" AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YY HH24:MI') AS updated
    FROM orders o
    JOIN investments i ON i.id = o."investmentId"
    WHERE o."updatedAt" >= NOW() - INTERVAL '7 days'
    ORDER BY o.updated_at DESC
    LIMIT 10;
  " 2>/dev/null || echo "")

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

SUCCESS_HTML=$(cat <<HTML
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#333;max-width:700px;margin:0 auto;padding:20px;">

  <h2 style="color:#1a1a2e;border-bottom:2px solid #4f46e5;padding-bottom:8px;">
    &#x2705; Finance Manager — Backup Report
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
HTML
)

send_email "[Finance Manager] ✅ Backup ${TIMESTAMP} — ${BACKUP_SIZE}" "$SUCCESS_HTML"

# ── Clean up local backups older than retention window ───────────────────────
echo "→ Cleaning local backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "✓ All done: $(date)"
