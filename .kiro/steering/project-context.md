# Finance Investment Manager — Project Context

## Overview

Personal investment portfolio tracker (Brazilian stocks focus). Monorepo with `client/` and `server/`, PostgreSQL in Docker, live market data from Yahoo Finance.

## Tech Stack

- **Client**: React 19, Vite 8, TanStack Query v5, React Hook Form, Zod v4, shadcn/ui, Tailwind CSS v4, Sonner (toasts)
- **Server**: Express 5, Prisma 6, yahoo-finance2 v4, Zod v4, TypeScript strict
- **DB**: PostgreSQL 16 (Docker), UUID primary keys, Decimal(18,8) for numeric fields
- **Testing**: Vitest (unit), Playwright (E2E)
- **Node**: 22+, ESM (`"type": "module"`)

## Architecture & Data Flow

### Server Layers
```
Routes (investment-routes.ts)
  → Services (investment-service.ts) — business logic, DI via factory
    → Prisma Client (lib/prisma-client.ts) — DB access
    → Yahoo Finance Service (services/yahoo-finance-quote-service.ts) — 5min cache
      → Yahoo Finance Wrapper (lib/yahoo-finance-wrapper.ts) — thin 3rd-party isolation
```

### Client Layers
```
Pages (HomePage.tsx) — owns state, orchestrates modals/mutations
  → Components (InvestmentTable, InvestmentFormModal, DeleteConfirmationDialog) — presentational
  → Hooks (useInvestments.ts) — TanStack Query wrappers
    → API Client (services/investment-api-client.ts) — fetch wrappers
  → Lib (investment-calculator.ts) — pure calculation functions
```

## Key Conventions

| Convention | Details |
|-----------|---------|
| File naming | kebab-case (`investment-service.ts`) |
| Components | PascalCase (`InvestmentTable.tsx`) |
| Factories over classes | `createInvestmentService(prisma)`, `createInvestmentRouter()`, `createApp()` |
| DI pattern | Services accept dependencies as factory parameters |
| Validation | Zod schemas returning discriminated-union results (no try/catch) |
| 3rd-party isolation | External libs wrapped in `lib/` — never imported directly in business code |
| Explicit return types | All exported functions have typed returns |
| Path aliases | `@/` → `src/` in client |
| Decimal handling | Prisma stores Decimal(18,8), API serializes as strings, frontend parses to number |
| Error responses | `{ error: string, details?: object }` with proper HTTP status codes |
| Logging | Structured JSON via `console.log(JSON.stringify({...}))` |

## Domain Rules

- **Brazilian tickers**: Append `.SA` for Yahoo Finance when ticker has no dot suffix (e.g., `ITUB3` → `ITUB3.SA`)
- **Graceful degradation**: When Yahoo Finance is down, `quote` is `null`, UI shows "N/A"
- **Calculated fields** (frontend only, never stored):
  - `totalInvested = quantity × averagePrice`
  - `currentTotal = quantity × currentPrice`
  - `profit = currentTotal − totalInvested`
  - `totalVariation = (profit / totalInvested) × 100`
- **Cache TTL**: 5 minutes on both server (quote cache) and client (QueryClient staleTime)

## Database Model

Single table `investments` (mapped via `@@map`):
- `id` (UUID, auto)
- `ticker` (String, uppercased)
- `quantity` (Decimal 18,8)
- `averagePrice` (Decimal 18,8)
- `createdAt` / `updatedAt` (auto)

## API Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Health check |
| GET | `/api/investments` | List all, enriched with quotes |
| GET | `/api/investments/:id` | Single, enriched |
| POST | `/api/investments` | Create (validated) |
| PUT | `/api/investments/:id` | Update (validated) |
| DELETE | `/api/investments/:id` | Delete (204 on success) |
| POST | `/api/test/reset` | Dev/test only — wipes DB |

## Development Commands

```bash
# Start DB
docker compose up -d

# Server (localhost:3000)
cd server && npm run dev

# Client (localhost:5173)
cd client && npm run dev

# Tests
cd server && npm test
cd client && npm test
cd client && npm run test:e2e  # requires server + client running
```

## File Structure Reference

```
client/src/
├── components/          # InvestmentTable, InvestmentFormModal, DeleteConfirmationDialog
│   └── ui/              # shadcn/ui primitives (Button, Dialog, Table, etc.)
├── hooks/               # TanStack Query hooks (useInvestments)
├── lib/                 # Pure functions (investment-calculator, utils)
├── pages/               # HomePage (single page app for now)
├── services/            # API client (investment-api-client)
├── types/               # TypeScript interfaces (investment.ts)
└── __tests__/           # Vitest unit tests

server/src/
├── lib/                 # prisma-client, yahoo-finance-wrapper
├── routes/              # Express route handlers
├── services/            # Business logic (investment-service, yahoo-finance-quote-service)
├── types/               # TypeScript interfaces
├── validators/          # Zod schemas (investment-validator)
└── __tests__/           # Vitest unit tests
```
