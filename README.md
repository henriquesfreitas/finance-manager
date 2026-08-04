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
- [Node.js 22+](https://nodejs.org/)
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

```bash
# From the project root
docker compose up -d
```

### 4. Run database migrations

```bash
cd server
npx prisma migrate deploy   # apply migrations
npx prisma generate          # generate Prisma client
```

### 5. Start development servers

Open two terminals:

```bash
# Terminal 1 — API server (http://localhost:3000)
cd server
npm run dev

# Terminal 2 — Vite dev server (http://localhost:5173)
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Available Scripts

### Server (`server/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Express server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server |
| `npm test` | Run unit tests (Vitest) |
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
├── docker-compose.yml         # PostgreSQL service
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

### Stored in PostgreSQL
- `ticker` — uppercased stock symbol (e.g. `ITUB3`, `VALE3`)
- `quantity` — number of units owned (decimal)
- `averagePrice` — average purchase price (decimal)

### Fetched from Yahoo Finance (not stored)
- `currentPrice` — live market price
- `dailyChangePercent` — daily % change
- Brazilian B3 tickers are queried with `.SA` suffix (e.g. `ITUB3.SA`)

### Calculated on frontend (not stored)
- `totalInvested = quantity × averagePrice`
- `currentTotal = quantity × currentPrice`
- `profit = currentTotal − totalInvested`
- `totalVariation = (profit / totalInvested) × 100`

## Automated Backup (Production)

The script `scripts/backup-db.sh` runs a PostgreSQL dump, uploads it to Cloudflare R2, and sends an HTML email report via Resend — but only when data has actually changed since the last run.

### How it works

- Queries `MAX(updatedAt)` across `investments`, `orders`, `comments`, and `treasury_products`
- Compares against a timestamp marker saved after the last successful backup
- If nothing changed, exits silently — no dump, no email
- On change: runs `pg_dump | gzip`, uploads via `rclone`, sends success email with a summary of the last 7 days of activity
- On any failure (DB down, rclone error, etc): sends a failure alert email instead

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
```

### Cron job

```bash
crontab -e
# Runs every 6 hours; skips silently if no data changed
0 */6 * * * /opt/finance-manager/scripts/backup-db.sh >> /var/log/finance-backup.log 2>&1
```

### Email notifications

- **Success**: subject `✅ Backup YYYYMMDD_HHMMSS — <size>` with investments and orders tables from the last 7 days
- **Failure**: subject `⚠ Backup FAILED` with the error reason and a pointer to the log file

The `RESEND_API_KEY` is send-only scoped — it cannot read email or access your Google account. Safe to store in `.env`.

---

## Troubleshooting

**"Can't reach database server"** — Make sure Docker is running and `docker compose up -d` was executed from the project root.

**Yahoo Finance shows N/A** — The yahoo-finance2 package is unofficial and may be rate-limited or blocked. The app degrades gracefully: stored fields still display, calculated fields show N/A.

**Port already in use** — Change `PORT` in `server/.env` (default: 3000) or `VITE_API_BASE_URL` in `client/.env` (default: http://localhost:3000).
