#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MODE="${1:-}"

usage() {
  cat <<'USAGE'
Usage: bash scripts/update-prod.sh <frontend|backend|both|both-migrate>

Modes:
  frontend     Pull master, then rebuild and start the client.
  backend      Pull master, then rebuild and start the server.
  both         Pull master, then rebuild and start the server and client.
  both-migrate Pull master, build both images, apply Prisma migrations,
               then start the server and client.
USAGE
}

case "$MODE" in
  frontend|backend|both|both-migrate) ;;
  *)
    usage >&2
    exit 2
    ;;
esac

cd "$PROJECT_DIR"

if [[ ! -f .env ]]; then
  echo "ERROR: .env file not found in $PROJECT_DIR." >&2
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "master" ]]; then
  echo "ERROR: Expected the master branch, but found '${CURRENT_BRANCH:-detached HEAD}'." >&2
  exit 1
fi

COMPOSE=(docker compose --env-file .env -f docker-compose.prod.yml)

echo "→ Pulling latest changes from origin/master..."
git pull --ff-only origin master

case "$MODE" in
  frontend)
    echo "→ Rebuilding and starting the client..."
    "${COMPOSE[@]}" up -d --build --no-deps client
    ;;
  backend)
    echo "→ Rebuilding and starting the server..."
    "${COMPOSE[@]}" up -d --build --no-deps server
    ;;
  both)
    echo "→ Rebuilding and starting the server and client..."
    "${COMPOSE[@]}" up -d --build --no-deps server client
    ;;
  both-migrate)
    echo "→ Building the server and client images..."
    "${COMPOSE[@]}" build server client

    echo "→ Applying database migrations..."
    "${COMPOSE[@]}" run --rm --no-deps server npx prisma migrate deploy

    echo "→ Starting the server and client..."
    "${COMPOSE[@]}" up -d --no-deps server client
    ;;
esac

echo "✓ Production update '$MODE' completed successfully."
