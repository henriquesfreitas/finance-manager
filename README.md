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

## Production VPS Setup From Scratch

This procedure targets a fresh Ubuntu 24.04 VPS and the current production layout. It recreates the application services, cron jobs, Telegram update service, and Let's Encrypt renewal schedule. It does not recreate database contents or secret credentials; provision those separately as described below.

### 1. Create and secure the VPS

Create an Ubuntu 24.04 instance and allow inbound TCP ports 22, 80, and 443 in the cloud firewall/security list. Do not expose PostgreSQL or the application ports 5432 and 3000. Point the domain's DNS A record to the VPS public IP before requesting a certificate.

Connect as the `ubuntu` account, install Git, clone the repository to `/home/ubuntu/finance-manager`, and run the host setup once:

```bash
sudo apt update
sudo apt install -y git
git clone <repo-url> /home/ubuntu/finance-manager
cd /home/ubuntu/finance-manager
sudo bash scripts/setup-vps.sh
```

`setup-vps.sh` enables UFW, Fail2ban, automatic security updates, Docker, and 2 GB of swap. It also disables SSH password and root login. Keep the current SSH session open while you reconnect and verify key-based access. Log out and back in so the `ubuntu` account receives Docker group access. This is a first-boot script; do not rerun it as routine deployment.

### 2. Configure secrets and external services

Create the production environment file and restrict its permissions:

```bash
cd /home/ubuntu/finance-manager
cp .env.production.example .env
chmod 600 .env
nano .env
```

Set the domain, PostgreSQL credentials, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `AMANDA_PASSWORD`. Choose a strong, unique value for each password. Use `admin_finance` as `ADMIN_USERNAME` only if this account should receive the `ADMIN` permission. The seed script requires Amanda's password the first time it creates her account; later seeds preserve her existing password when that variable is absent.

For notifications and production commands, set `BACKUP_NOTIFY_EMAIL`, `BACKUP_FROM_EMAIL`, and `RESEND_API_KEY` from Resend, then set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `TELEGRAM_ALLOWED_USER_ID`. The allowed user ID is the numeric Telegram account ID permitted to run deployment commands. Keep all secrets out of GitHub.

Install rclone and configure a remote named `r2` with the Cloudflare R2 credentials. The backup script writes to the `general` bucket, so confirm access before deployment:

```bash
curl https://rclone.org/install.sh | sudo bash
rclone config
rclone listremotes
rclone lsd r2:general
```

The rclone credentials live in `~/.config/rclone/rclone.conf`, outside the repository. Keep that file private and restore it from a secure source when replacing a VPS.

### 3. Deploy the application

Build and start the production Compose services, apply database migrations, seed the admin and Amanda users plus treasury products, and install the app's cron schedules:

```bash
cd /home/ubuntu/finance-manager
bash scripts/deploy.sh
```

The first seed uses the credentials in `.env`. Subsequent deployments also run the seed; keep the configured admin credentials current because the admin password is updated from `.env` each time. Amanda's password is updated on later seeds while `AMANDA_PASSWORD` remains set; if it is unset after her first seed, her existing password is preserved.

### 4. Enable HTTPS

With DNS resolving to the VPS and ports 80 and 443 open, run:

```bash
bash scripts/setup-ssl.sh
```

The script requests a Let's Encrypt certificate, writes the HTTPS Nginx config, validates it, and reloads Nginx without stopping PostgreSQL. `setup-ssl.sh` uses `CERTBOT_EMAIL` from `.env`, or prompts if it is blank. It also installs Certbot's webroot mount in Nginx. For an IP-only deployment without a domain, use `scripts/setup-ssl-selfsigned.sh` instead; browsers will show a certificate warning.

### 5. Install production host configuration

Run this as `ubuntu` after deploy and SSL setup:

```bash
bash scripts/setup-prod-config.sh
```

It verifies that the `r2` remote can access `r2:general`, installs or updates the project cron entries, and installs the restricted systemd Telegram update service. Telegram long polling must be available; the installer stops with an error if the bot has a webhook configured, so remove or migrate that webhook deliberately first.

On an existing VPS, pull this version of the repository and run the command once to replace the old project cron rows and add certificate renewal. It keeps unrelated crontab entries.

The backup runs in the VPS host timezone; the other jobs use `America/Sao_Paulo`. The managed entries are safe to reinstall:

| Job | Schedule |
|---|---|
| Database backup | Every 6 hours (host timezone, UTC on the current VPS) |
| Price target alerts | 11:00 Monday and Thursday |
| Isolated production tests | 03:00 daily |
| Let's Encrypt renewal and Nginx reload | 04:00 daily, only when a certificate renewal config exists |

The installer preserves unrelated crontab entries and writes job logs in the project directory. `deploy.sh` also reapplies the cron schedule entries, so they remain present after a full deployment.

### 6. Verify the installation

```bash
docker compose -f docker-compose.prod.yml ps
curl -fsS https://YOUR_DOMAIN/health
crontab -l
sudo systemctl status finance-manager-telegram-update-bot
sudo journalctl -u finance-manager-telegram-update-bot -n 50 --no-pager
```

The PostgreSQL data is stored in the Docker volume `postgres_data`; replacing the VPS does not restore it. Restore the database from an R2 backup separately before pointing users to the new instance. Preserve or securely reprovision `.env`, the rclone config, `certbot/conf`, and any self-signed files under `nginx/ssl`. The production Nginx config may also contain host-specific edits, so compare it before replacing it during recovery.

### Production configuration inventory

The current VPS uses a user crontab for backups, price alerts, and daily isolated tests; a systemd unit named `finance-manager-telegram-update-bot`; Docker Compose services for PostgreSQL, the API, frontend, and Nginx; rclone remote `r2`; and Let's Encrypt files under `certbot/conf`. The setup scripts recreate the cron entries, Telegram service, and HTTPS/Nginx configuration. Configure the `r2` remote from its external credentials; provision or restore the VPS firewall and provider-side network rules, environment secrets, certificates, and database contents separately.

## Automated Backup (Production)

The script `scripts/backup-db.sh` runs a PostgreSQL dump and uploads it to Cloudflare R2 only when data has changed since the last successful backup. It sends a success summary to Telegram; processing failures are reported by email and Telegram.

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

Run `bash scripts/install-prod-test-schedule.sh` to install or refresh all managed production cron jobs. `bash scripts/setup-prod-config.sh` also reinstalls the schedule when it installs the Telegram update service.

### Price Target Alerts (Production)

The script `scripts/check-price-targets.sh` checks active investments using Yahoo Finance quotes for stocks and the saved current value for Treasury products. It sends a Telegram message whenever a sell target is met (`price now >= sell target`) or a buy target is met (`price now <= buy target`). If Telegram delivery fails, it sends the alert by email through Resend instead. Other job errors also trigger a failure email. A digest is sent only when at least one target is reached; it repeats on each scheduled run while a target remains reached.

The managed schedule runs the check at 11:00 Monday and Thursday in `America/Sao_Paulo`, independent of the VPS system timezone. The installer writes logs under the project directory, which is writable by the `ubuntu` crontab owner. The script defaults to the root `.env` file.

The job logs its start, quote lookup results, reached targets, Resend acceptance, and failures. To diagnose a missed run on the VPS, check:

If the job fails, including when Telegram rejects an alert, it sends a failure report email through Resend.

```bash
timedatectl
crontab -l
tail -n 100 /home/ubuntu/finance-manager/finance-target-alerts.log
sudo journalctl -u cron --since today
```

The schedule writes to `finance-target-alerts.log` in the project directory. A manual run can send an alert if a target is currently reached.

The selected environment file must contain the existing `BACKUP_NOTIFY_EMAIL`, `BACKUP_FROM_EMAIL`, and `RESEND_API_KEY` settings. For Telegram delivery, also set both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. To run a manual check, use `ENV_FILE=.env /bin/bash scripts/check-price-targets.sh` from the project root. The server image must be rebuilt and deployed so it includes `dist/jobs/target-price-alerts.js`.

### Email and Telegram notifications

- **Success Telegram message**: run time, backup file, size, R2 destination, and changed tables with recent added/updated row counts
- **Failure email**: sent if backup processing fails or Telegram rejects the success report
- **Failure Telegram message**: sent if backup processing fails

The `RESEND_API_KEY` is send-only scoped — it cannot read email or access your Google account. Safe to store in `.env`.

### Production test runs

`scripts/deploy.sh` installs the managed schedules, including an idempotent daily production-test schedule for 03:00 America/Sao_Paulo. It runs the client and server unit test suites in an isolated Docker container; the production database is not connected. Test failures include the last output from the run in Telegram, whether the run was scheduled or started manually. Set both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in the production `.env`.

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
