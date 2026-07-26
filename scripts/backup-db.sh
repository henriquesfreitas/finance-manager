#!/bin/bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════════════════════
# Finance Manager — Database Backup Script
# Recommend adding to crontab: 0 3 * * * /path/to/backup-db.sh
# ══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
RETENTION_DAYS=30

cd "$PROJECT_DIR"

# Load env
set -a
source .env
set +a

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate timestamped filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/finance_${TIMESTAMP}.sql.gz"

echo "→ Backing up database to $BACKUP_FILE..."

docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "$BACKUP_FILE"

# Delete old backups
echo "→ Cleaning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "✓ Backup complete: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
