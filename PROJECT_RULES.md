# Project Rules — Finance Investment Manager

> Living document. Update this file whenever a new pattern, constraint, or architectural decision is introduced.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18+ with Vite |
| UI | shadcn/ui + Tailwind CSS |
| Data Fetching | TanStack Query |
| Forms | React Hook Form + Zod |
| Backend | Express + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL (Docker) |
| Unit Testing | Vitest |
| E2E Testing | Playwright |
| Language | TypeScript (strict mode, both projects) |

## Project Structure

```
finance-manager/
├── client/              # React + Vite frontend
├── server/             # Express + Prisma backend
├── docker-compose.yml  # Postgres (dev), full stack (CI/staging)
├── PROJECT_RULES.md    # This file
├── .kiro/
│   ├── specs/          # Feature specifications
│   └── steering/       # Agent guidelines
└── doc/                # Reference assets (images, diagrams)
```

## Architecture Rules

1. **Business logic lives in service/utility modules, never in components.**
   - Calculated fields (totalInvested, profit, etc.) → dedicated utility function
   - Validation schemas → shared Zod schemas
   - Components only render UI and call APIs

2. **API follows REST conventions.**
   - Resource-based URLs: `/api/{resource}`
   - Standard verbs: GET, POST, PUT, DELETE
   - Consistent error response format

3. **Database is only accessed through Prisma.**
   - No raw SQL unless explicitly justified
   - Migrations tracked in version control

4. **Frontend and backend are independent projects.**
   - Each has its own package.json, tsconfig, test config
   - No shared code between them (yet — shared types package may come later)

## Data Rules

### Stored Fields (PostgreSQL)
- ticker (string, uppercased)
- quantity (decimal, > 0)
- averagePrice (decimal, >= 0)

### Fetched Fields (Yahoo Finance API, server-side, not stored)
- currentPrice (from `regularMarketPrice`)
- dailyChange (from `regularMarketChangePercent`)
- Ticker format: append `.SA` for B3 stocks (e.g., ITUB3 → ITUB3.SA)
- Fallback: return null if API unavailable, UI shows "N/A"
- Cache: 5 min TTL to avoid excessive calls

### Calculated Fields (frontend only, never stored)
- totalInvested = quantity × averagePrice
- currentTotal = quantity × currentPrice
- profit = currentTotal − totalInvested
- totalVariation = (profit / totalInvested) × 100

## Testing Rules

1. Every business logic function must have unit tests
2. Every bug fix must include a regression test
3. All user flows must have Playwright E2E tests
4. Tests must pass before any task is considered complete
5. Tests run headless, no manual setup required
6. Mock external I/O with named fake classes

## Naming Conventions

- **Files:** kebab-case (e.g., `investment-calculator.ts`)
- **Components:** PascalCase (e.g., `InvestmentTable.tsx`)
- **Functions/variables:** camelCase (e.g., `calculateProfit`)
- **Types/Interfaces:** PascalCase with descriptive names (e.g., `InvestmentFormData`)
- **API routes:** kebab-case plural (e.g., `/api/investments`)
- **DB columns:** camelCase (Prisma convention)

## Patterns in Use

| Pattern | Where | Why |
|---------|-------|-----|
| Repository pattern | server/services | Decouple business logic from Prisma |
| Zod validation | shared boundaries | Type-safe runtime validation |
| TanStack Query | client data layer | Cache management, loading states |
| React Hook Form | client forms | Performant form state |

## Infrastructure Rules

- Postgres runs in Docker always (no local install)
- App code runs locally during development
- Full Docker available for CI/staging
- `docker compose up` must reach a working state from clean

## Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-07-11 | Initial rules created | Project kickoff, v1 spec defined |
| 2026-07-11 | Added Yahoo Finance integration | Live prices instead of manual input for currentPrice/dailyChange |

## Scaling Strategy

When this file grows beyond ~200 lines or the project adds major new domains (auth, charts, etc.), split into scoped conditional steering files under `.kiro/steering/` with `fileMatch` inclusion patterns. Each file covers one domain and is only loaded when the agent touches relevant files. Keep this file as a lightweight index/overview pointing to the detailed docs.
