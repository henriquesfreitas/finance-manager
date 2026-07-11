# PRD — Finance Investment Manager v1

## Overview

Personal investment portfolio manager to track stocks, crypto, and other assets. Simple CRUD app with a table view showing portfolio performance.

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | React + Vite | Fast dev, industry standard |
| UI Components | shadcn/ui + Tailwind CSS | Modern, customizable, you own the code |
| Data Fetching | TanStack Query | Caching, refetching, loading states |
| Forms | React Hook Form + Zod | Lightweight, great validation |
| Backend | Express + TypeScript | Most popular Node framework, easy to extend |
| ORM | Prisma | Type-safe, great migrations, scales well |
| Database | PostgreSQL (Docker) | Reliable, feature-rich, runs in container |
| Language | TypeScript (both projects) | Type safety across the stack |
| Market Data | yahoo-finance2 | Free, no API key, supports B3 (.SA tickers) |
| Unit Testing | Vitest | Fast, native ESM/TS support, works great with Vite |
| E2E Testing | Playwright | Industry standard, reliable, cross-browser |

## Architecture

```
finance-manager/
├── client/          # React + Vite
├── server/          # Express + Prisma
├── docker-compose.yml   # Postgres
└── doc/             # Documentation
```

Monorepo structure with two separate projects (client/server) sharing a root `docker-compose.yml`.

## V1 Scope

### Features
- View all investments in a table
- Add new investment via modal form
- Edit existing investment via modal form
- Delete investment (with confirmation)
- Calculated fields auto-update based on input

### Out of Scope (future versions)
- Authentication / multi-user
- Charts and dashboards
- Export/reports
- Categories/tags
- Recurring transactions
- Mobile responsiveness (nice-to-have for v1, not required)

## Data Model

### Investment

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| id | UUID | auto | Primary key |
| ticker | string | user input | Asset ticker (e.g., ITUB3, BTC) |
| quantity | decimal | user input | Number of units owned |
| averagePrice | decimal | user input | Average purchase price |
| createdAt | datetime | auto | Record creation |
| updatedAt | datetime | auto | Last update |

### Stored Fields (user input, persisted in DB)
- Ticker
- Quantity
- Average Price

### Fetched Fields (from Yahoo Finance API via backend, not stored)
- Current Price (`regularMarketPrice`)
- Daily Change % (`regularMarketChangePercent`)

### Calculated Fields (frontend, not stored)

| Field | Formula |
|-------|---------|
| totalInvested | quantity × averagePrice |
| currentTotal | quantity × currentPrice |
| profit | currentTotal − totalInvested |
| totalVariation | (profit / totalInvested) × 100 |

## External API Integration

### Yahoo Finance (via yahoo-finance2 npm package)

- **Package:** `yahoo-finance2`
- **Ticker format:** Brazilian stocks use `.SA` suffix (e.g., `ITUB3.SA`, `VALE3.SA`)
- **Data fetched:** `regularMarketPrice`, `regularMarketChangePercent`
- **Called from:** Backend (server-side) to avoid CORS issues and centralize API logic
- **Endpoint:** `GET /api/investments` returns stored data enriched with live prices
- **Fallback:** If Yahoo Finance is unavailable, return `null` for price fields and show "unavailable" in UI
- **Caching:** Consider short TTL cache (5 min) to avoid hammering Yahoo on every request
- **Note:** yahoo-finance2 is unofficial and free, no API key needed. Suitable for personal use.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/investments | List all investments |
| GET | /api/investments/:id | Get single investment |
| POST | /api/investments | Create investment |
| PUT | /api/investments/:id | Update investment |
| DELETE | /api/investments/:id | Delete investment |

## UI Specification

### Home Page
- Header with app title
- "Add Investment" button (top right)
- Table with columns matching the image reference
- Color coding: green for positive profit/variation, red for negative
- "Edit" button on each row
- Delete option accessible from edit modal or row action

### Add/Edit Modal
- Input fields: Ticker, Quantity, Average Price
- Validation: all fields required, numeric validation for numbers
- Ticker validated against Yahoo Finance on save (verify it exists)
- Save / Cancel buttons

## Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Unit Tests (frontend) | Vitest | Calculated field logic, validation helpers, utility functions |
| Unit Tests (backend) | Vitest | Service layer, validation, business logic |
| E2E Tests | Playwright | Full user flows (CRUD operations, modal interactions, table rendering) |

### Unit Tests
- Every business logic function shall have unit tests
- Calculated field formulas (totalInvested, currentTotal, profit, totalVariation)
- Input validation logic (Zod schemas)
- API route handlers (mocked DB)
- Edge cases: zero values, negative numbers, division by zero

### E2E Tests (Playwright)
- Add investment flow: open modal → fill form → save → verify row appears
- Edit investment flow: click edit → modify fields → save → verify update
- Delete investment flow: click delete → confirm → verify removal
- Validation: submit invalid data → verify error messages
- Calculated fields: verify correct values render after add/edit
- Color coding: verify green/red styling based on profit/loss

## Development Setup

- **Local dev**: React and Node run natively (hot reload)
- **Docker**: Postgres only during development
- **Full Docker**: docker-compose with all services for CI/staging

## Design Principles

- Keep it simple, make it extensible
- TypeScript everywhere for safety
- Clean separation between client and server
- RESTful API design
- Prepared for auth middleware (future)
- Prepared for additional models/relations (future)
- **Tests must pass after every implementation step** — run full test suite after each change to catch regressions immediately
