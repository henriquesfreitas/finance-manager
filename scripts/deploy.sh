#!/bin/bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════════════════════
# Finance Manager — Production Deployment Script
# Run this on your VPS after git pull
# ══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "══════════════════════════════════════════════════════════════"
echo "  Finance Manager — Deploy"
echo "══════════════════════════════════════════════════════════════"

# Check .env exists
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.production.example to .env and fill in values."
  exit 1
fi

# Source env to get DOMAIN variable
set -a
source .env
set +a

if [ -z "${DOMAIN:-}" ]; then
  echo "ERROR: DOMAIN not set in .env"
  exit 1
fi

echo ""
echo "→ Domain: $DOMAIN"
echo "→ Building and starting containers..."
echo ""

# Build and deploy
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# Wait for postgres to be healthy
echo ""
echo "→ Waiting for database..."
sleep 5

# Run migrations
echo "→ Running database migrations..."
docker compose -f docker-compose.prod.yml exec server npx prisma migrate deploy

# Seed admin user (idempotent — skips if exists)
echo "→ Seeding admin user..."
docker compose -f docker-compose.prod.yml exec server npx tsx prisma/seed.ts || true

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  ✓ Deployment complete!"
echo "  → App: https://$DOMAIN"
echo "  → Health: https://$DOMAIN/health"
echo "══════════════════════════════════════════════════════════════"
