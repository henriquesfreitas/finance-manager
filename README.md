# Finance Investment Manager

A personal investment portfolio tracker for Brazilian and international stocks. CRUD operations with live market data from Yahoo Finance, calculated P&L fields, and color-coded profit/loss indicators.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 8 |
| UI Components | shadcn/ui + Tailwind CSS v4 |
| Data Fetching | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Backend | Express 5 + TypeScript |
| ORM | Prisma 6 |
| Database | PostgreSQL 16 (Docker) |
| Market Data | yahoo-finance2 (no API key required) |
| Unit Testing | Vitest |
| E2E Testing | Playwright |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL)
- [Node.js 24.22.1](https://nodejs.org/) (the repository pins this patched LTS release in `.nvmrc`; Node 22.23.4 or newer also meets the package engine requirement)
- **Windows users**: run all commands in **Command Prompt (cmd)**, not PowerShell. PowerShell may block npm scripts due to execution policy. Open cmd with `Win + R → cmd`.

## Setup

### 1. Clone and install

```cmd
git clone <repo-url>
cd finance-manager

:: Install server dependencies
cd server
npm install

:: Install client dependencies (uses legacy-peer-deps via .npmrc — required for eslint-plugin-react)
cd ..\client
npm install
```

### 2. Configure environment variables

```bash
# From the project root
cp .env.example server/.env
# Edit server/.env if you need non-default DB credentials
```

### 3. Start PostgreSQL

This Compose file is for local development. On the VPS, use `docker-compose.prod.yml` explicitly.

```bash
# From the project root
docker compose -f docker-compose.dev.yml up -d
```

### 4. Run database migrations

```bash
cd server
npx prisma migrate deploy   # apply migrations
npx prisma generate          # generate Prisma client
```

### 5. Start development servers

From the project root, start the API and client together in one terminal:

```cmd
npm run dev
```

The API runs at http://localhost:3000 and the Vite dev server at http://localhost:5173. Press Ctrl+C to stop both.

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Available Scripts

From the project root, `npm test` runs the client and server unit test suites. The server authentication integration test uses PostgreSQL and is kept separate; start the development database with `docker compose -f docker-compose.dev.yml up -d`, then run `npm run test:integration` when you want to include it.

### Server (`server/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Express server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:integration` | Run PostgreSQL-backed authentication integration tests (requires the development database) |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Create and apply a new migration |
| `npm run db:migrate:prod` | Apply existing migrations (production) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Delete all investments (dev/test only) |

### Client (`client/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run lint` | Run ESLint |

> **E2E tests require both the API server and Vite dev server to be running.**

## Project Structure

```
finance-manager/
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/        # UI components (InvestmentTable, modals, dialogs)
│   │   │   └── ui/            # shadcn/ui primitive components
│   │   ├── hooks/             # TanStack Query custom hooks
│   │   ├── lib/               # Pure utility functions (investment-calculator)
│   │   ├── pages/             # Page components (HomePage)
│   │   ├── services/          # API client (fetch wrappers)
│   │   ├── types/             # TypeScript interfaces
│   │   └── __tests__/         # Vitest unit tests
│   └── e2e/                   # Playwright E2E tests
├── server/
│   ├── src/
│   │   ├── lib/               # Prisma singleton, Yahoo Finance wrapper
│   │   ├── routes/            # Express route handlers
│   │   ├── services/          # Business logic (investment, Yahoo Finance)
│   │   ├── types/             # TypeScript interfaces
│   │   ├── validators/        # Zod validation schemas
│   │   └── __tests__/         # Vitest unit tests
│   └── prisma/
│       ├── schema.prisma      # Data model
│       └── migrations/        # Applied DB migrations
├── docker-compose.dev.yml     # PostgreSQL service for local development
├── docker-compose.prod.yml    # Full-stack production services
└── .env.example               # Environment variable template
```

## API Summary

Base URL: `http://localhost:3000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/investments` | List all investments (enriched with live prices) |
| `GET` | `/api/investments/:id` | Get single investment |
| `POST` | `/api/investments` | Create investment |
| `PUT` | `/api/investments/:id` | Update investment |
| `DELETE` | `/api/investments/:id` | Delete investment |

### Request body for POST/PUT

```json
{
  "ticker": "ITUB3",
  "quantity": 100,
  "averagePrice": 28.35
}
```

### Response shape (GET /api/investments)

```json
[
  {
    "id": "uuid",
    "ticker": "ITUB3",
    "quantity": "100",
    "averagePrice": "28.35",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "quote": {
      "currentPrice": 29.50,
      "dailyChangePercent": 1.23
    }
  }
]
```

`quote` is `null` when Yahoo Finance is unavailable.

## Data Model

See [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) for the PostgreSQL tables, columns, relationships, indexes, and enums. It is maintained alongside Prisma schema and migration changes.

## Automated Backup (Production)

The script `scripts/backup-db.sh` runs a PostgreSQL dump, uploads it to Cloudflare R2, and sends an HTML email report via Resend plus an optional Telegram notification — but only when data has actually changed since the last run.

### How it works

- Queries the latest change across `investments`, `orders`, `comments`, `portfolio_comments`, `treasury_products`, `admin_users`, `budgets`, `budget_items`, `bills`, and `bill_month_settlements`
- Compares per-table fingerprints against the last successful backup marker, so inserts, updates, and deletions identify the affected tables
- If nothing changed, exits silently — no dump, no email
- On change: runs `pg_dump | gzip`, uploads via `rclone`, and sends a success summary to Telegram
- The success Telegram report lists changed tables and counts rows added or updated in the last 6 hours; it does not include row contents, and long reports are split into sequential messages
- On any failure (DB down, rclone error, etc): sends failure alert notifications instead
- If Telegram rejects the post-upload success report, the script also emails an error alert through Resend

### Dependencies on the server

```bash
# rclone (for R2 upload)
curl https://rclone.org/install.sh | sudo bash

# curl and python3 are pre-installed on Ubuntu/Oracle Linux
```

### rclone R2 configuration

Create `~/.config/rclone/rclone.conf` on the server:

```ini
[r2]
type = s3
provider = Cloudflare
access_key_id = YOUR_ACCESS_KEY_ID
secret_access_key = YOUR_SECRET_ACCESS_KEY
endpoint = https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
```

Get credentials from the Cloudflare dashboard → R2 → Manage R2 API tokens.

### Required env vars

Add these to the production `.env` (see `.env.production.example`):

```bash
BACKUP_NOTIFY_EMAIL=you@gmail.com
BACKUP_FROM_EMAIL=backup@yourdomain.com   # verified sender in Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx    # send-only key from resend.com
TELEGRAM_BOT_TOKEN=                       # optional; create with @BotFather
TELEGRAM_CHAT_ID=                         # optional; both Telegram values are required together
TELEGRAM_ALLOWED_USER_ID=                 # numeric Telegram account ID allowed to run production updates
```

### Cron job

```bash
crontab -e
# Runs every 6 hours; skips silently if no data changed
0 */6 * * * /opt/finance-manager/scripts/backup-db.sh >> /var/log/finance-backup.log 2>&1
```

### Price Target Alerts (Production)

The script `scripts/check-price-targets.sh` checks active investments using Yahoo Finance quotes for stocks and the saved current value for Treasury products. It sends a Telegram message whenever a sell target is met (`price now >= sell target`) or a buy target is met (`price now <= buy target`). If Telegram delivery fails, it sends the alert by email through Resend instead. Other job errors also trigger a failure email. A digest is sent only when at least one target is reached; it repeats on each scheduled run while a target remains reached.

Ubuntu's standard cron uses the VPS's system timezone to schedule jobs; setting `TZ` in a user's crontab does not change when the job runs ([Ubuntu crontab manual](https://manpages.ubuntu.com/manpages/jammy/man5/crontab.5.html)). Check the VPS timezone with `timedatectl`. On the common UTC-configured VPS, Brasília is currently UTC-3, so add this entry for 11:00 Brasília time. Replace the project path as needed:

```cron
0 14 * * 1,4 cd /opt/finance-manager && /bin/bash scripts/check-price-targets.sh >> /home/ubuntu/finance-target-alerts.log 2>&1
```

Use a log path writable by the crontab owner. A user crontab usually cannot write to `/var/log` unless the log file was created and permissioned for that user. If the VPS system timezone is `America/Sao_Paulo`, use `0 11 * * 1,4` instead. The script defaults to the root `.env` file.

The job logs its start, quote lookup results, reached targets, Resend acceptance, and failures. To diagnose a missed run on the VPS, check:

If the job fails, including when Telegram rejects an alert, it sends a failure report email through Resend.

```bash
timedatectl
crontab -l
tail -n 100 /home/ubuntu/finance-target-alerts.log
sudo journalctl -u cron --since today
```

Run `test -w /home/ubuntu/finance-target-alerts.log` as the crontab owner to confirm the log is writable. A manual run can send an alert if a target is currently reached.

The selected environment file must contain the existing `BACKUP_NOTIFY_EMAIL`, `BACKUP_FROM_EMAIL`, and `RESEND_API_KEY` settings. For Telegram delivery, also set both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. To run a manual check, use `ENV_FILE=.env /bin/bash scripts/check-price-targets.sh` from the project root. The server image must be rebuilt and deployed so it includes `dist/jobs/target-price-alerts.js`.

### Email and Telegram notifications

- **Success Telegram message**: run time, backup file, size, R2 destination, and changed tables with recent added/updated row counts
- **Failure email**: sent if backup processing fails or Telegram rejects the success report
- **Failure Telegram message**: sent if backup processing fails

The `RESEND_API_KEY` is send-only scoped — it cannot read email or access your Google account. Safe to store in `.env`.

### Production test runs

`scripts/deploy.sh` installs an idempotent daily schedule for 03:00 America/Sao_Paulo. It runs the client and server unit test suites in an isolated Docker container; the production database is not connected. Test failures include the last output from the run in Telegram, whether the run was scheduled or started manually. Set both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in the production `.env`.

### Routine production updates

For routine updates on the VPS, run `bash scripts/update-prod.sh` with one of these modes. Pull and deployment modes require the `master` branch and pull `origin/master` with fast-forward only. Local uncommitted changes are allowed; the script continues only if the pull succeeds. Docker builds use the resulting working tree, including any remaining local changes. Restart and test modes skip Git; restart restarts all production Compose services, including Postgres, while test builds and runs the isolated test profile without changing live services:

```bash
bash scripts/update-prod.sh pull          # pull master only; do not change containers
bash scripts/update-prod.sh restart      # restart all production Compose services
bash scripts/update-prod.sh test         # build and run isolated production tests
bash scripts/update-prod.sh frontend      # rebuild and start the client
bash scripts/update-prod.sh backend       # rebuild and start the server
bash scripts/update-prod.sh both          # rebuild and start server and client
bash scripts/update-prod.sh both-migrate  # build both, migrate the database, then start both
```

The migration mode applies Prisma migrations after building the new images and before replacing the running server and client. Use it when deploying database schema or data migrations. `scripts/deploy.sh` remains the full deployment setup script.

### Telegram production updates

The Telegram bot can run these update modes from the existing private notification chat. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` as for the existing notifications, then set `TELEGRAM_ALLOWED_USER_ID` to your numeric Telegram account ID. For a one-to-one private chat, it is normally the same number as `TELEGRAM_CHAT_ID`, but configure it explicitly. Keep the bot token secret. The bot requires both the private chat ID and sender ID to match and silently ignores other users.

Install it on the VPS while logged in as the project account that can run Docker:

```bash
bash scripts/install-telegram-update-bot.sh
sudo systemctl status finance-manager-telegram-update-bot
sudo journalctl -u finance-manager-telegram-update-bot -f
```

The installer checks that the bot has no webhook configured, then installs or updates a systemd service that uses long polling; it does not open an inbound port or remove an existing webhook. It also installs a restricted sudoers rule so the service account can restart and check the status of this bot service only, then restarts the service to load the installed code. On first startup, queued messages from before installation are discarded so an old command cannot start a deployment. If a webhook is configured, migrate or remove it deliberately before installing the poller.

Restart the service after changing Telegram credentials or the allowed user ID:

```bash
sudo systemctl restart finance-manager-telegram-update-bot
```

Send one of these commands in the private chat:

```text
/help
/update pull
/update restart
/update telegram
/update test
/update frontend
/update backend
/update both
/update both-migrate
```

`/update pull` only pulls `origin/master` with fast-forward-only behavior; it does not build or restart containers. `/update restart` restarts all production Compose services, including Postgres, without pulling or building. `/update telegram` restarts the Telegram bot systemd service and reports its status after it comes back up. `/update test` builds and runs the isolated production test profile against the current checkout; it does not pull code or touch live service containers. The bot reports the test image build and test run, then sends a final result. A failure includes the failed step and a short output tail; complete command output remains in the systemd journal. Only one operation can run at a time. If another is active, the bot replies that it is busy.

To run the same tests manually on the VPS, use:

```bash
/bin/bash scripts/test-prod.sh
```

To inspect the schedule and its log, use `crontab -l` and `tail -n 100 prod-tests.log` from the project directory.

---

## Troubleshooting

**"Can't reach database server"** — Make sure Docker is running and `docker compose -f docker-compose.dev.yml up -d` was executed from the project root.

**Yahoo Finance shows N/A** — The yahoo-finance2 package is unofficial and may be rate-limited or blocked. The app degrades gracefully: stored fields still display, calculated fields show N/A.

**Port already in use** — Change `PORT` in `server/.env` (default: 3000) or `VITE_API_BASE_URL` in `client/.env` (default: http://localhost:3000).
