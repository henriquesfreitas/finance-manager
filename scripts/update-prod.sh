#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MODE="${1:-}"

usage() {
  cat <<'USAGE'
Usage: bash scripts/update-prod.sh <pull|restart|frontend|backend|both|both-migrate>

Modes:
  pull          Pull master only; do not build or restart containers.
  restart       Restart all production Compose services without pulling or building.
  frontend     Pull master, then rebuild and start the client.
  backend      Pull master, then rebuild and start the server.
  both         Pull master, then rebuild and start the server and client.
  both-migrate Pull master, build both images, apply Prisma migrations,
               then start the server and client.
USAGE
}

case "$MODE" in
  pull|restart|frontend|backend|both|both-migrate) ;;
  *)
    usage >&2
    exit 2
    ;;
esac

cd "$PROJECT_DIR"

if [[ "$MODE" != "pull" && ! -f .env ]]; then
  echo "ERROR: .env file not found in $PROJECT_DIR." >&2
  exit 1
fi

COMPOSE=(docker compose --env-file .env -f docker-compose.prod.yml)

report_step() {
  printf 'BOT_STEP:%s\n' "$1"
}

if [[ "$MODE" == "restart" ]]; then
  report_step restart
  echo "→ Restarting all production Compose services..."
  "${COMPOSE[@]}" restart
  echo "✓ Production Compose services restarted successfully."
  exit 0
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "master" ]]; then
  echo "ERROR: Expected the master branch, but found '${CURRENT_BRANCH:-detached HEAD}'." >&2
  exit 1
fi

report_step pull
echo "→ Pulling latest changes from origin/master..."
git pull --ff-only origin master

if [[ "$MODE" == "pull" ]]; then
  echo "✓ Git pull completed successfully. Containers were not changed."
  exit 0
fi

case "$MODE" in
  frontend)
    report_step build
    echo "→ Building the client image..."
    "${COMPOSE[@]}" build client
    report_step start
    echo "→ Starting the client..."
    "${COMPOSE[@]}" up -d --no-deps client
    ;;
  backend)
    report_step build
    echo "→ Building the server image..."
    "${COMPOSE[@]}" build server
    report_step start
    echo "→ Starting the server..."
    "${COMPOSE[@]}" up -d --no-deps server
    ;;
  both)
    report_step build
    echo "→ Building the server and client images..."
    "${COMPOSE[@]}" build server client
    report_step start
    echo "→ Starting the server and client..."
    "${COMPOSE[@]}" up -d --no-deps server client
    ;;
  both-migrate)
    report_step build
    echo "→ Building the server and client images..."
    "${COMPOSE[@]}" build server client

    report_step migrate
    echo "→ Applying database migrations..."
    "${COMPOSE[@]}" run --rm --no-deps server npx prisma migrate deploy

    report_step start
    echo "→ Starting the server and client..."
    "${COMPOSE[@]}" up -d --no-deps server client
    ;;
esac

echo "✓ Production update '$MODE' completed successfully."
