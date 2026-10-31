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

## Choose a setup guide

- **Develop locally**: follow [Local Development Setup](docs/LOCAL_SETUP.md) for prerequisites, dependency installation, local environment variables, PostgreSQL, migrations, and starting the app.
- **Deploy to a fresh Ubuntu VPS**: follow [Production VPS Setup](docs/PRODUCTION_VPS_SETUP.md) for server hardening, production secrets, deployment, HTTPS, scheduled jobs, backups, and updates.

The local guide uses `docker-compose.dev.yml`; production uses `docker-compose.prod.yml`. Keep their environment files separate: `server/.env` for local development and the project root `.env` on the VPS.

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

## Troubleshooting

**"Can't reach database server"** — Make sure Docker is running and `docker compose -f docker-compose.dev.yml up -d` was executed from the project root.

**Yahoo Finance shows N/A** — The yahoo-finance2 package is unofficial and may be rate-limited or blocked. The app degrades gracefully: stored fields still display, calculated fields show N/A.

**Port already in use** — Change `PORT` in `server/.env` (default: 3000) or `VITE_API_BASE_URL` in `client/.env` (default: http://localhost:3000).
