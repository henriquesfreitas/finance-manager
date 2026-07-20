# Project Rules — Finance Investment Manager

> Living document. Update this file whenever a new pattern, constraint, or architectural decision is introduced.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + Vite | React 19, Vite 8 |
| UI components | shadcn/ui + Tailwind CSS | Tailwind 4 |
| Data fetching | TanStack Query | v5 |
| Forms | React Hook Form + Zod | RHF 7, Zod 4 |
| Backend | Express + TypeScript | Express 5 |
| ORM | Prisma | v6 |
| Database | PostgreSQL (Docker) | v16 |
| Unit tests | Vitest | v4 |
| E2E tests | Playwright | v1.61 |
| Language | TypeScript strict mode (both projects) | TS 5.8 |
| Market data | yahoo-finance2 | v4 |

---

## Project Structure

```
finance-manager/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components (PascalCase .tsx)
│   │   │   └── ui/          # shadcn/ui primitives — do not edit manually
│   │   ├── hooks/           # TanStack Query wrappers (useXxx.ts)
│   │   ├── lib/             # Pure utility/business logic functions
│   │   ├── pages/           # Page-level components (one per route)
│   │   ├── services/        # API client (fetch wrappers)
│   │   ├── types/           # TypeScript interfaces/types
│   │   └── __tests__/       # Vitest unit tests
│   └── e2e/                 # Playwright E2E tests
├── server/
│   └── src/
│       ├── lib/             # Thin wrappers around 3rd-party libs (Prisma, Yahoo)
│       ├── routes/          # Express Router factories
│       ├── services/        # Business logic, DB access via Prisma
│       ├── types/           # Server-side TypeScript interfaces
│       ├── validators/      # Zod schemas + parse helpers
│       └── __tests__/       # Vitest unit tests
├── docker-compose.yml       # Postgres only (dev); extend for full-stack CI
├── package.json             # Root convenience scripts (dev, test, db:*)
└── PROJECT_RULES.md         # This file
```

---

## Frontend Patterns

### Component structure

Components are pure UI. They receive data via props, call handlers passed as props, and render. No `fetch`, no business logic, no Zod schemas inside component files.

```
pages/     → owns state, wires up hooks + handlers, composes components
components/ → receive props, render JSX, emit events up
```

**Example — `HomePage.tsx`** owns all modal state and mutation handlers. `InvestmentTable`, `InvestmentFormModal`, and `DeleteConfirmationDialog` receive exactly what they need and nothing more.

Every component exports a named function (not default export) and returns `React.JSX.Element`. All props interfaces are co-located with the component in the same file.

### shadcn/ui conventions

- Primitives live in `src/components/ui/` — **do not hand-edit these files**. Re-run `npx shadcn@latest add <component>` to update them.
- The `@` alias maps to `src/` — always use it for imports: `import { Button } from '@/components/ui/button'`.
- Components outside `ui/` are project-specific. They import shadcn primitives, never re-implement them.

### TanStack Query usage

- `QueryClient` is created **outside** `App` to avoid recreating on re-renders.
- `staleTime: 1000 * 60 * 5` (5 min) is set globally in `App.tsx` to match the server-side Yahoo Finance cache TTL.
- Every hook file exports one `useQuery` wrapper and one or more `useMutation` wrappers.
- `onSuccess: () => qc.invalidateQueries(...)` is the standard way to keep the list fresh after a mutation — no manual cache writes.
- The query key is a typed `const` exported from the hook file so tests and callers share the same reference:

```ts
export const INVESTMENTS_QUERY_KEY = ['investments'] as const;
```

### React Hook Form + Zod pattern

- Schema defined with `z.object(...)` at the top of the component file.
- `zodResolver(formSchema)` is passed to `useForm`.
- `register('field', { valueAsNumber: true })` is used for numeric inputs — do not convert strings manually.
- Errors are rendered inline beneath each field with `role="alert"` for accessibility.
- `reset(values)` inside a `useEffect` that depends on `[open, investment]` handles both add-mode (blank) and edit-mode (pre-filled) in a single modal:

```ts
useEffect(() => {
  if (open) {
    if (isEditing) { reset({ ticker: investment.ticker, ... }); }
    else { reset({ ticker: '', ... }); }
  }
}, [open, isEditing, investment, reset]);
```

---

## Calculator / Business Logic

All calculated fields live as **pure functions** in `client/src/lib/investment-calculator.ts`. Components call these functions with parsed numbers — they never re-implement the math inline.

```ts
// Right
const profit = calculateProfit(currentTotal, totalInvested);

// Wrong — never inline this in a component
const profit = currentTotal !== null ? currentTotal - totalInvested : null;
```

The four functions and their null-propagation contract:

| Function | Returns null when… |
|---|---|
| `calculateTotalInvested(qty, avgPrice)` | never |
| `calculateCurrentTotal(qty, currentPrice)` | `currentPrice` is null |
| `calculateProfit(currentTotal, totalInvested)` | `currentTotal` is null |
| `calculateTotalVariation(profit, totalInvested)` | `profit` is null **or** `totalInvested === 0` |

The division-by-zero guard in `calculateTotalVariation` is intentional — return null rather than `Infinity`.

---

## API Client Pattern

`client/src/services/api-client.ts` exports the shared `request<T>` helper. Domain-specific clients import it:

- `investment-api-client.ts` — investments CRUD + archive
- `order-api-client.ts` — order CRUD per investment + global order list
- `comment-api-client.ts` — comments CRUD per investment

```ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
```

The `request<T>` helper:
- Injects `Content-Type: application/json` on every call.
- Throws an `Error` with the server's `error` message on non-2xx responses.
- Returns `undefined` (cast to `T`) for `204 No Content`.

Functions are named after their intent — not HTTP verbs — so call sites read like English.

**Env var:** set `VITE_API_BASE_URL` in `client/.env`. During development the Vite dev server proxies `/api` to `localhost:3000` (configured in `vite.config.ts`), so the env var is optional locally.

---

## Custom Hooks Pattern

Each domain has its own hook file in `client/src/hooks/`. Hooks are the only layer that imports from `services/`.

| Hook file | Queries | Mutations |
|-----------|---------|-----------|
| `useInvestments.ts` | `useActiveInvestments`, `useArchivedInvestments` | `useCreateInvestment`, `useArchiveInvestment`, `useUnarchiveInvestment` |
| `useOrders.ts` | `useOrders(investmentId)`, `useAllOrders` | `useCreateOrder`, `useUpdateOrder` |
| `useComments.ts` | `useComments(investmentId)` | `useCreateComment`, `useUpdateComment`, `useDeleteComment` |

On mutation success, hooks invalidate the relevant query keys so lists refresh automatically — no manual cache writes.

Pages call `mutateAsync` (not `mutate`) so they can `await` and close the modal only after success.

---

## Server Patterns

### App factory

`server/src/app.ts` exports `createApp()` — a function that builds and returns the Express application **without** binding to a port. `server/src/index.ts` calls it and starts the HTTP server. This allows tests to `import { createApp }` and call routes without an open port.

### Service factory (dependency injection)

All services follow the same factory pattern with DI:

| Factory | Responsibility |
|---------|---------------|
| `createInvestmentService(db)` | Investment CRUD, archive/unarchive, list enriched with quotes |
| `createOrderService(db)` | Order CRUD, SELL validation, position computation |
| `createCommentService(db)` | Comment CRUD with ownership checks |
| `createWeightedAverageCalculator()` | Pure position computation (BUY/SELL/BONUS/SPLIT) |

Tests inject fakes; the real routers inject the singleton from `lib/prisma-client.ts`.

```ts
// Production
const service = createInvestmentService(prisma);

// Test
const service = createInvestmentService(fakePrisma);
```

### Yahoo Finance wrapper

`server/src/lib/yahoo-finance-wrapper.ts` is the **only** file that imports `yahoo-finance2`. Everything else imports from the wrapper. This makes the external dependency mockable in one place.

```ts
// Always import from the wrapper, never directly
import { fetchRawQuote } from '../lib/yahoo-finance-wrapper.js';
```

### Quote caching

`yahoo-finance-quote-service.ts` maintains a module-level `Map<string, CacheEntry>` with a 5-minute TTL. Both single (`fetchQuote`) and batch (`fetchQuotes`) APIs are provided. The batch API fires concurrent requests with `Promise.all` and returns a `Map<ticker, quote | null>`.

### Ticker symbol resolution

Brazilian B3 stocks need a `.SA` suffix for Yahoo Finance. The rule is: if the ticker has no `.` in it, append `.SA`.

```ts
resolveYahooSymbol('ITUB3')   // → 'ITUB3.SA'
resolveYahooSymbol('BTC-USD') // → 'BTC-USD'
resolveYahooSymbol('AAPL')    // → 'AAPL.SA'  ← US tickers should use their suffix, e.g. add logic if needed
```

### Zod validation on the server

Each domain has its own validator in `server/src/validators/`:

| Validator | Schemas |
|-----------|---------|
| `investment-validator.ts` | `createInvestmentSchema` (ticker + sector) |
| `order-validator.ts` | `createOrderSchema`, `updateOrderSchema` |
| `comment-validator.ts` | `createCommentSchema`, `updateCommentSchema` |

All validators export a `validateXxxInput(raw: unknown)` function returning a discriminated union:

```ts
{ success: true; data: T }
| { success: false; errors: Record<string, string[]> }
```

Route handlers check `validation.success` and return `400` with `{ error: 'Validation failed', details: validation.errors }` on failure. No `try/catch` is needed at the call site.

### Prisma Decimal serialisation

Prisma returns `Decimal` objects from the DB. Services call `.toString()` on Decimal fields before returning them over JSON. The client types these as `string` (`"100.50000000"`) and `parseFloat`s them before arithmetic.

---

## Domain: Orders (v2 Architecture)

Orders are the **source of truth** for investment positions. Quantity and weighted average price are computed at query time from order history — never stored directly.

### Order Types

| Type | Effect on Position |
|------|-------------------|
| `BUY` | Increases quantity, recalculates weighted average price |
| `SELL` | Decreases quantity, average price unchanged |
| `BONUS` | Same as BUY (e.g. stock bonuses from the company) |
| `SPLIT` | Multiplies quantity by factor, divides average by factor. Total cost unchanged. |

### averagePriceAtSell — PM Snapshot

When a SELL order is created, the service automatically snapshots the current weighted average price (preço médio) into `averagePriceAtSell` (Decimal 18,8, nullable). This enables per-sell profit/loss display without replaying full order history.

- **Auto-populated** by `createOrder` at the computed PM at that moment
- **Caller-override**: if `averagePriceAtSell` is supplied in `CreateOrderInput`, that value takes precedence
- **Editable**: users can update it via the standard `PUT /api/investments/:id/orders/:orderId` endpoint
- **Null** for BUY/BONUS/SPLIT orders and for historical SELL orders created before this field existed

**Calculated fields** (frontend, never stored — in `investment-calculator.ts`):
- `calculateSellTotalInvested(qty, pm)` → `qty × pm` or `null` when pm is null
- `calculateSellProfit(totalSold, totalInvestedAtSell)` → `totalSold − totalInvestedAtSell` or `null`

### Weighted Average Calculator

`server/src/services/weighted-average-calculator.ts` is a pure function module:

```ts
const calculator = createWeightedAverageCalculator();
const position = calculator.computePosition(orders); // → { quantity, averagePrice }
```

Key rules:
- BUY/BONUS: `newAvg = (prevQty × prevAvg + orderQty × orderPrice) / totalQty`
- SELL: quantity decreases, average price is preserved
- SPLIT: `qty × factor`, `avg / factor` — total cost stays the same
- Zero position resets average to 0; next BUY sets average to that order's price
- All results rounded to 8 decimal places

### Order Business Rules

- SELL orders cannot exceed the current computed position
- Orders cannot be created/updated on archived investments
- Editing an order triggers full chronological re-validation (no negative positions at any point)
- If an edit would produce an invalid state, the update is rolled back

---

## Domain: Comments

Free-text notes attached to investments. Simple CRUD with ownership validation.

- Max length: 2000 characters
- Min length: 1 character (non-empty)
- Comments belong to one investment; ownership is checked on update/delete
- Sorted by `createdAt DESC` (newest first)

---

## Domain: Archive

Investments can be archived (soft-delete). Archived investments:
- Do not receive live market quotes
- Cannot have new orders or edits to existing orders
- Are displayed in a separate "Archive" section in the UI
- Can be unarchived to restore full functionality

The `archivedAt` field is either `null` (active) or a `DateTime` (archived).

---

## Domain: Treasury Bonds (Tesouro Direto)

Treasury investments are modeled as first-class investments with `type = TREASURY`.

### Key differences from STOCK

| Aspect | STOCK | TREASURY |
|--------|-------|---------|
| Identifier | Ticker (e.g. `ITUB3`) | Product slug (e.g. `TESOURO-IPCA-2026`) |
| Price source | Yahoo Finance live quote | Manual `currentValue` field |
| Daily change % | From Yahoo Finance | Not applicable — shown as `—` |
| Target prices | Optional | Optional |
| Orders | BUY/SELL/BONUS/SPLIT | Same — BUY per purchase, SELL if redeemed early |
| Sector | Any from INVESTMENT_SECTORS | Auto-set to `"Renda Fixa"` |

### Treasury Product Catalog

Products are stored in `treasury_products` table — **not hardcoded**. New products can be added directly in the DB without a code deploy.

- `name`: full display name, e.g. `"Tesouro IPCA+ 2026"`
- `slug`: URL-safe unique ticker, e.g. `"TESOURO-IPCA-2026"`
- Seeded via `prisma/seed.ts` (run with `npm run db:seed`)

### Current Value (Manual Price)

- Stored in `Investment.currentValue` (Decimal, nullable)
- Editable inline in the table (same `EditablePriceCell` used for target prices)
- Used in place of `quote.currentPrice` for all calculations (profit, variation, portfolio weight)
- Null → UI shows "N/A"

### Portfolio Weight — Hybrid Calculation

Since treasury assets have no live quote, portfolio weight uses a hybrid total:
- For each investment: use `currentTotal` if price is available (live quote or manual currentValue), otherwise fall back to `totalInvested`
- This replaces the previous all-or-nothing approach that returned null if any investment lacked a price

---

Each investment has an optional `sector` field from a predefined list (e.g. "Bancos", "Energia Elétrica", "FIIs", "ETFs").

- Server validates against `INVESTMENT_SECTORS` constant in `investment-validator.ts`
- Client has a matching copy in `client/src/lib/investment-sectors.ts` for the dropdown
- **Server is the source of truth** for validation; client copy drives the UI only

---

## API Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Health check |
| PATCH | `/api/investments/:id/target-prices` | Update target sell/buy prices (nullable Decimal) |
| GET | `/api/investments` | List active investments (enriched with quotes + position) |
| GET | `/api/investments/archived` | List archived investments (with final position) |
| POST | `/api/investments` | Create investment — `type: "STOCK"` (ticker + sector) or `type: "TREASURY"` (treasuryProductId) |
| PATCH | `/api/investments/:id/archive` | Archive an investment |
| PATCH | `/api/investments/:id/unarchive` | Unarchive an investment |
| PUT | `/api/investments/:id` | Deprecated — returns 405 |
| DELETE | `/api/investments/:id` | Delete investment (204) |
| PATCH | `/api/investments/:id/current-value` | Update manually-entered current value (TREASURY assets, nullable) |
| GET | `/api/investments/:id/orders` | List orders for an investment |
| POST | `/api/investments/:id/orders` | Create order, returns computed position |
| PUT | `/api/investments/:id/orders/:orderId` | Update order, returns computed position |
| GET | `/api/orders` | List all orders across all investments (with ticker) |
| GET | `/api/investments/:id/comments` | List comments for an investment |
| POST | `/api/investments/:id/comments` | Create comment |
| PUT | `/api/investments/:id/comments/:commentId` | Update comment |
| DELETE | `/api/investments/:id/comments/:commentId` | Delete comment |
| GET | `/api/treasury-products` | List all treasury product catalog entries |
| POST | `/api/test/reset` | Dev/test only — wipes DB |

### Error response shape

All validation errors: `{ error: 'Validation failed', details: { fieldName: ['message'] } }`  
All not-found errors: `{ error: 'Investment with id "<id>" not found' }`  
All unexpected errors: caught by the global Express error handler, logged as JSON, returned as `{ error: '<message>' }` with status 500.

---

## Testing Conventions

### Unit tests — frontend (`client/src/__tests__/`)

- Framework: Vitest + jsdom (`@testing-library/jest-dom` imported in `setup.ts`).
- Run with: `npm test` (inside `client/`) — maps to `vitest run`.
- Pool: `vmForks` + `fileParallelism: false` — required on Windows/Node 22 to avoid a Vitest v4 worker crash (vitest#8861 — `forks` pool crashes when Vite 8 is hoisted from `client/` into the module resolution path).
- Test file naming: `<module-name>.test.ts`, placed in `__tests__/`.
- Calculator tests use `toBeCloseTo` for floating-point comparisons.
- No mocks for pure functions — pass plain numbers, assert plain numbers.

### Unit tests — server (`server/src/__tests__/`)

- Framework: Vitest.
- Run with: `npm test` (inside `server/`).
- Pool: `vmForks` + `fileParallelism: false` — same reason as client (vitest#8861). The server also pins `"vite": "^6.3.5"` as a devDependency to prevent Vite 8 (the client dep) from being hoisted and breaking the Vitest worker.
- **Service tests** (`investment-service.test.ts`): inject a fake Prisma client built with `vi.fn()`. Mock the Yahoo Finance service module with `vi.mock(...)`. Verify the service calls the right Prisma methods with the right arguments.
- **Route tests** (`investment-routes.test.ts`): use a `FakeInvestmentService` class with `vi.fn()` methods. Mount the router on a minimal Express app with `supertest`. Mock both `createInvestmentService` and `lib/prisma-client.js`.
- **Validator tests** (`investment-validator.test.ts`): call `validateInvestmentInput` directly with raw data. Assert `success`, `data`, or `errors` fields.
- Pattern: fakes are named classes (`FakeInvestmentService`, `makeFakePrisma`) — never anonymous objects.

### E2E tests — Playwright (`client/e2e/`)

- Config in `client/playwright.config.ts`.
- Run with: `npm run test:e2e` (inside `client/`).
- The smoke test (`smoke.spec.ts`) asserts the app loads and renders the heading — first test to run in CI, quick sanity check.

### Root convenience commands

```bash
npm run test:server   # runs server unit tests
npm run test:client   # runs client unit tests
npm run test:e2e      # runs Playwright E2E tests
```

---

## TypeScript Conventions

Both projects use `strict: true`. The client `tsconfig.app.json` also enables:

```json
"noUncheckedIndexedAccess": true,
"noImplicitOverride": true,
"noImplicitReturns": true,
"exactOptionalPropertyTypes": true
```

Rules that follow from this:
- No `any`. If you're fighting the type system, create a proper interface.
- Array indexing (`arr[0]`) returns `T | undefined` — always narrow before use.
- All functions must have explicit return types (public APIs) or at minimum must not rely on implicit `any`.
- `Decimal` from Prisma is not serialisable — always call `.toString()` before returning over the wire.

---

## Styling

- Tailwind 4 via the `@tailwindcss/vite` plugin — no `tailwind.config.js` needed.
- shadcn/ui tokens (`text-foreground`, `text-muted-foreground`, `text-destructive`, etc.) are used for semantic colors — never raw hex values.

### Color coding for profit / loss

This is a hard rule enforced in `InvestmentTable.tsx`. Use the `profitColorClass` helper:

```ts
function profitColorClass(value: number | null): string {
  if (value === null) return 'text-muted-foreground';
  if (value > 0)  return 'text-green-600 dark:text-green-400';
  if (value < 0)  return 'text-red-600 dark:text-red-400';
  return 'text-foreground'; // zero → neutral
}
```

- Positive (profit/variation > 0) → **green** (`text-green-600 / text-green-400`)
- Negative (profit/variation < 0) → **red** (`text-red-600 / text-red-400`)
- Zero → neutral foreground
- Unavailable (null) → muted foreground

Apply this class to the `<TableCell>` element, not to a child span.

### "N/A" fallback pattern

When live price data is unavailable, render a muted span inside the cell:

```tsx
{currentPrice !== null
  ? formatCurrency(currentPrice)
  : <span className="text-muted-foreground">N/A</span>}
```

---

## Data Flow Summary

```
User input
  → React Hook Form (validates with Zod)
    → api-client.ts (shared request helper)
      → Express route (validates with Zod again)
        → service (business logic + Prisma)
          → PostgreSQL
        → weighted-average-calculator.ts (pure position computation)
        → yahoo-finance-quote-service.ts (5min cache → yahoo-finance-wrapper.ts)
          → Yahoo Finance API
      ← { EnrichedInvestment | ComputedPosition | OrderRecord | CommentRecord }
    ← JSON response
  ← TanStack Query (caches, triggers re-render)
    → investment-calculator.ts (pure UI-side calculations)
      → InvestmentTable renders calculated fields
```

### Database Model (Prisma)

```
TreasuryProduct (treasury_products)
├── id: UUID PK
├── name: String UNIQUE  ("Tesouro IPCA+ 2026")
├── slug: String UNIQUE  ("TESOURO-IPCA-2026" — used as Investment.ticker)
└── createdAt

Investment (investments)
├── id: UUID PK
├── ticker: String UNIQUE
├── type: AssetType  (STOCK | TREASURY, default STOCK)
├── sector: String? (nullable for migration compat, required by app Zod schema)
├── archivedAt: DateTime?
├── targetSellPrice: Decimal(18,8)? (nullable — user-defined sell target)
├── targetBuyPrice: Decimal(18,8)? (nullable — user-defined buy target)
├── currentValue: Decimal(18,8)? (nullable — manually-entered price for TREASURY assets)
├── treasuryProductId: UUID? FK → TreasuryProduct (null for STOCK)
├── createdAt / updatedAt
├── → Order[] (1:N, onDelete: Restrict)
└── → Comment[] (1:N, onDelete: Restrict)

Order (orders)
├── id: UUID PK
├── investmentId: FK → Investment
├── type: BUY | SELL | BONUS | SPLIT
├── quantity: Decimal(18,8)
├── price: Decimal(18,8)
├── orderDate: Date
├── contractedRate: Decimal(5,2)? (treasury only)
├── averagePriceAtSell: Decimal(18,8)? (auto-populated on SELL create; editable; null for BUY/BONUS/SPLIT)
└── createdAt / updatedAt

Comment (comments)
├── id: UUID PK
├── investmentId: FK → Investment
├── content: String
└── createdAt / updatedAt
```

---

## Infrastructure

- **Postgres** always runs in Docker: `docker compose up -d`.
- **Server and client run locally** during development for hot reload.
- Default ports: client `5173`, server `3000`, Postgres `5432`.
- The Vite dev server proxies `/api` → `localhost:3000` so the client never needs CORS config locally.
- `DATABASE_URL` is set in `server/.env`. See `.env.example` at the root for the full variable list.

### DB commands (run from root)

```bash
npm run db:migrate   # prisma migrate dev (creates migration + applies it)
npm run db:studio    # opens Prisma Studio in browser
```

---

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Files (non-component) | kebab-case | `investment-calculator.ts` |
| Component files | PascalCase | `InvestmentTable.tsx` |
| Functions | camelCase | `calculateProfit` |
| Types / Interfaces | PascalCase, descriptive | `EnrichedInvestment`, `InvestmentFormData` |
| Hook files | `use` prefix, camelCase | `useInvestments.ts` |
| Test files | `<module>.test.ts` | `investment-calculator.test.ts` |
| Env vars (client) | `VITE_` prefix, SCREAMING_SNAKE | `VITE_API_BASE_URL` |
| API routes | kebab-case plural | `/api/investments` |
| DB table | snake_case plural (Prisma `@@map`) | `investments` |

---

## Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-07-11 | Initial rules created | Project kickoff, v1 spec defined |
| 2026-07-11 | Added Yahoo Finance integration | Live prices for currentPrice/dailyChange |
| 2026-07-11 | Full rewrite based on implemented code | Document actual patterns, not just intentions |
| 2026-07-11 | Task 4 complete | 21 Playwright E2E tests (smoke, add, edit, delete, validation, color coding) |
| 2026-07-11 | Added test-only reset endpoint | `POST /api/test/reset` — gated by `NODE_ENV !== 'production'` |
| 2026-07-11 | Task 5 complete | Toast notifications (sonner), server-down error banner, README |
| 2026-07-12 | V2 architecture | Orders as source of truth, weighted average calculator, computed positions |
| 2026-07-16 | Added BONUS and SPLIT order types | Stock bonuses and splits support |
| 2026-07-17 | Comments system | Free-text notes on investments |
| 2026-07-19 | Sectors | Optional sector classification for investments |
| 2026-07-19 | Updated PROJECT_RULES.md | Documented orders, comments, archive, sectors, weighted average calculator, updated API endpoints |
| 2026-07-20 | Target prices | Added targetSellPrice/targetBuyPrice to investments table. Inline editable cells in InvestmentTable with color coding (green when current price hits target). PATCH /api/investments/:id/target-prices endpoint. EditablePriceCell reusable component. |
| 2026-07-20 | Fix test infrastructure | Root cause: Vite 8 (client dep) hoisted into server node_modules broke Vitest v4 workers. Fix: pin vite ^6 in server devDependencies; switch both vitest configs to pool: vmForks + fileParallelism: false (vitest#8861). All 143 server + 29 client tests now pass. |
| 2026-07-20 | Multi-asset support (v3) | Added AssetType enum (STOCK/TREASURY), TreasuryProduct catalog table, currentValue field. New endpoints: PATCH /api/investments/:id/current-value, GET /api/treasury-products. AddInvestmentForm now has type selector. InvestmentTable shows product name for treasury rows with editable currentValue cell. Portfolio % uses hybrid calculation. 166 server + 29 client tests pass. |
| 2026-07-20 | SELL PM snapshot (averagePriceAtSell) | Added averagePriceAtSell field to orders table. Auto-populated from weighted average on SELL create. Editable via existing update endpoint. Order history table shows PM, Investido, Vendido, Lucro sub-row for SELL orders with PM recorded. New calculator functions: calculateSellTotalInvested, calculateSellProfit. 173 server + 37 client tests pass. |
