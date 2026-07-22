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
│   │   ├── contexts/        # React contexts (auth-context.tsx — AuthProvider + useAuth)
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
- Sets `credentials: 'include'` so the session cookie is sent on every request (required for cross-origin dev: client on port 5173, server on port 3000).
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

### Route ordering for auth exemptions

Express matches routes in registration order. Exempt routes must be registered **before** `app.use('/api', authMiddleware)`:

```
GET  /health                      ← registered before any /api middleware
POST /api/auth/login              ← registered under /api/auth BEFORE global auth middleware
POST /api/test/reset (non-prod)   ← registered BEFORE global auth middleware
app.use('/api', authMiddleware)   ← applies to all /api/* registered after this line
app.use('/api', createXxxRouter()) ← protected routes come after
```

This means no explicit path-exclusion logic in the middleware — route order is the mechanism. `cookie-parser` must be registered before auth middleware so `req.cookies` is populated.

### Service factory (dependency injection)

All services follow the same factory pattern with DI:

| Factory | Responsibility |
|---------|---------------|
| `createInvestmentService(db)` | Investment CRUD, archive/unarchive, list enriched with quotes |
| `createOrderService(db)` | Order CRUD, SELL validation, position computation |
| `createCommentService(db)` | Comment CRUD with ownership checks |
| `createWeightedAverageCalculator()` | Pure position computation (BUY/SELL/BONUS/SPLIT) |
| `createAuthService({ db })` | Credential verification (bcrypt), session lifecycle (create/validate/invalidate), rate limiting. Never returns or logs `passwordHash`. |

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

**Exception — `auth-validator.ts`**: returns the raw `z.ZodError` on failure (not `Record<string, string[]>`) so the auth route can forward Zod's structured `issues` array directly to the client:

```ts
{ success: true; data: LoginInput }
| { success: false; errors: z.ZodError }
```

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
| POST | `/api/auth/login` | Authenticate with credentials — no auth required |
| POST | `/api/auth/logout` | Invalidate session + clear cookie — auth required |
| GET | `/api/auth/me` | Return current admin identity — auth required |
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
- Pool: **`forks`** + `fileParallelism: false` — `forks` gives each test file its own OS process, ensuring complete module cache isolation. `vmForks` was previously used but caused intermittent `vi.mock` failures: when integration tests ran before unit tests, the real `yahoo-finance-wrapper` and `investment-service` modules remained cached in the VM context and `vi.mock` stopped intercepting them, producing flaky failures.
- **Service tests** (`investment-service.test.ts`): inject a fake Prisma client built with `vi.fn()`. Mock the Yahoo Finance service module with `vi.mock(...)`. Verify the service calls the right Prisma methods with the right arguments.
- **Route tests** (`investment-routes.test.ts`): use a `FakeInvestmentService` class with `vi.fn()` methods. Mount the router on a minimal Express app with `supertest`. Mock both `createInvestmentService` and `lib/prisma-client.js`.
- **Validator tests** (`investment-validator.test.ts`): call `validateInvestmentInput` directly with raw data. Assert `success`, `data`, or `errors` fields.
- Pattern: fakes are named classes (`FakeInvestmentService`, `makeFakePrisma`) — never anonymous objects.

### Property-based tests — server (`server/src/__tests__/*.property.test.ts`)

- Framework: Vitest + `fast-check` (v4, TypeScript-first).
- Named `<module>.property.test.ts`, placed alongside unit tests in `__tests__/`.
- Each file header documents the property under test, the requirement it validates, and the test label format: `Feature: admin-login, Property N: <title>`.
- Minimum 100 iterations per property (`numRuns: 100` in `fc.assert`).
- Use `fc.pre(condition)` to skip degenerate cases (e.g. two IPs that happen to be equal) instead of filtering outside the generator.
- Each property test file targets exactly the properties listed in `design.md` — no undocumented properties.

### Property-based tests — fast-check (`server/src/__tests__/*.property.test.ts`)

- Library: `fast-check` v4 (server devDependency).
- Run with: `npm test` (inside `server/`) — picked up by Vitest alongside unit tests.
- File naming: `<module>.property.test.ts`, placed in `__tests__/` alongside unit tests.
- Minimum **100 iterations** per property (`{ numRuns: 100 }`).
- Each test is labelled with `Feature: <spec>, Property N: <title>` in the `describe` block.
- Each `it` block includes a JSDoc comment citing `Feature:` and `Validates: Requirements X.Y`.
- Generator naming convention: `valid<Field>` / `tooShort<Field>` / `tooLong<Field>` defined once at the top of the `describe` block and reused across related properties.
- No mocks — generators produce plain values that are passed directly to the function under test.

| Property test file | Properties covered |
|---|---|
| `auth-validator.property.test.ts` | Property 3 (P3a–P3e) — login input length boundaries |
| `auth-service.property.test.ts` | Properties 1, 2, 5, 11, 12 — token entropy, identical error messages, sliding window session refresh, logout DB deletion, hash non-leakage |
| `auth-middleware.property.test.ts` | Properties 7, 8 — middleware rejects all invalid tokens (wrong length, non-hex, empty); valid token attaches adminId to request |
| `auth-routes.property.test.ts` | Property 6 — Set-Cookie header contains HttpOnly, Secure, SameSite=Strict, Max-Age=604800 for any successful login |
| `client/src/__tests__/auth-api-client.property.test.ts` | Property 10 — all three auth API client functions (login, logout, fetchCurrentAdmin) throw an Error with the server's error message for any 401 response, across arbitrary error message strings |

### Integration tests — server (`server/src/__tests__/auth-integration.test.ts`)

- Framework: Vitest + Supertest + real PrismaClient.
- **Requires a running PostgreSQL instance** (`docker compose up -d`). If the DB is unavailable, `beforeAll` fails — that is the expected signal, not a test bug.
- `beforeAll` upserts a dedicated test admin user with a low bcrypt cost (4) for speed.
- `afterAll` deletes the test user and all its sessions, then disconnects Prisma.
- `afterEach` deletes all sessions for the test admin AND **resets the module-level rate-limiter** by making a successful login. This is necessary because the rate-limiter singleton in `auth-service.ts` is shared across the entire process — without a reset, rate-limit tests that exhaust the counter block subsequent tests on the same loopback IP. A successful login internally calls `rateLimiter.reset(ip)`, clearing the lockout.
- Rate-limit tests rely on the fact that all supertest requests share the loopback IP. Tests run serially (`fileParallelism: false`), so the rate-limiter state is predictable.
- Helper `loginAndGetCookie()` performs a full login and returns the raw Set-Cookie string for use in subsequent authenticated requests.

### E2E tests — Playwright (`client/e2e/`)

- Config in `client/playwright.config.ts`.
- Run with: `npm run test:e2e` (inside `client/`).
- The smoke test (`smoke.spec.ts`) asserts the app loads and renders the heading — first test to run in CI, quick sanity check.

### Testing components that navigate (`LocationService`)

jsdom marks `window.location` as non-configurable and non-deletable after first access. Components that call `window.location.replace()` or read `window.location.pathname/search` must accept an injectable `LocationService` prop so tests can pass a fake without touching the global.

The interface is exported from `client/src/components/RouteGuard.tsx`:

```ts
export interface LocationService {
  getPathname(): string;
  getSearch(): string;
  replace(url: string): void;
}

// Production default — delegates to window.location
export const windowLocationService: LocationService = { ... };
```

Components accept it as an optional prop defaulting to `windowLocationService`:

```ts
export function RouteGuard({ children, locationService = windowLocationService }: RouteGuardProps) { ... }
export function LoginPage({ locationService = windowLocationService }: { locationService?: LocationService } = {}) { ... }
```

Tests create a fake inline:

```ts
const loc = { getPathname: () => '/portfolio', getSearch: () => '', replace: vi.fn() };
render(<RouteGuard locationService={loc}><Child /></RouteGuard>);
expect(loc.replace).toHaveBeenCalledWith('/login?returnTo=%2Fportfolio');
```

Always call `cleanup()` in `afterEach` in component test files — Vitest with `globals: true` does not automatically clean up the jsdom between tests.

### Mock isolation in vmForks (`vi.mock` vs `vi.doMock`)

Vitest `vmForks` + `fileParallelism: false` runs files serially in the same worker. Files that all call `vi.mock('../contexts/auth-context')` share the **same hoisted `vi.fn()` instance** across the serial run. This means:

- Always use `mockImplementation` (not `mockReturnValue`) in `beforeEach` for component tests — `mockImplementation` takes priority over queued return values from sibling files.
- Do NOT call `vi.restoreAllMocks()` globally — use `vi.clearAllMocks()` instead, which clears call history but preserves implementations.
- For property-based tests that need guaranteed module isolation (e.g. they run after a file that tested the real module), use `vi.doMock` + dynamic import inside the `it` body:

```ts
it('property test', async () => {
  vi.resetModules();
  vi.doMock('../contexts/auth-context', () => ({
    useAuth: () => ({ isAuthenticated: false, isLoading: false, ... }),
  }));
  const { RouteGuard } = await import('../components/RouteGuard');
  // ... fc.assert(fc.property(...))
});
```

This ensures the property test gets a fresh module graph that binds to the inline mock, regardless of what sibling files have done to the shared module cache.

- Do NOT call `vi.resetModules()` in `afterEach` — it breaks sibling test files that rely on the `vi.mock` factory registered by the first file loaded.

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
AdminUser (admin_users)
├── id: UUID PK
├── username: String UNIQUE
├── passwordHash: String  (bcrypt, cost factor ≥ 10)
├── createdAt / updatedAt
└── → AdminSession[] (1:N, onDelete: Cascade)

AdminSession (admin_sessions)
├── id: UUID PK
├── token: String UNIQUE  (cryptographically random, ≥ 256 bits, indexed)
├── adminId: FK → AdminUser  (onDelete: Cascade)
├── expiresAt: DateTime  (indexed; sliding 7-day window, refreshed on each validated request)
└── createdAt

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
| 2026-07-20 | Admin auth models (task 1.1) | Added AdminUser and AdminSession Prisma models (admin_users, admin_sessions tables). Opaque session token approach: bcrypt passwords, 256-bit random tokens, 7-day sliding expiry, httpOnly cookie delivery. Migration: `add-admin-auth`. |
| 2026-07-20 | Admin credential seeder (task 1.2) | Added `server/prisma/seed-admin.ts` — exports `seedAdmin(prisma)`, reads ADMIN_USERNAME/ADMIN_PASSWORD from env, hashes with bcrypt cost 12, upserts into admin_users. Called from `prisma/seed.ts` after treasury products. Fails fast with a descriptive error when env vars are absent. Added ADMIN_USERNAME, ADMIN_PASSWORD, SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS to `.env.example`. |
| 2026-07-20 | Auth service (task 2.5) | Added `server/src/services/auth-service.ts` — `createAuthService({ db })` factory. `authenticate` verifies bcrypt credentials, generates 256-bit random token (64-char hex), creates session with 7-day sliding expiry. `validateSession` refreshes expiry on each call. `invalidateSession` silently ignores missing sessions. Module-level `rateLimiter` (5 attempts / 15-min window / 15-min lockout). Generic "Invalid credentials" error for any auth failure. `passwordHash` never appears in return values or logs. |
| 2026-07-21 | Auth middleware (task 4.1) | Added `server/src/middleware/auth-middleware.ts` — `createAuthMiddleware({ authService })` factory. Extracts session token from httpOnly cookie (name from `SESSION_COOKIE_NAME` env, default `finance_session`). Returns 401 for missing token, malformed token (non-hex or ≠ 64 chars), or invalid/expired session. Attaches `req.adminId` on success. Includes global Express `Request` type augmentation (`adminId?: string`). 13 unit tests in `auth-middleware.test.ts`. 255 server tests pass. |
| 2026-07-21 | Auth service property tests (task 2.6) | Added `server/src/__tests__/auth-service.property.test.ts` — fast-check properties for token entropy (P1), identical error messages (P2), sliding window refresh (P5), logout DB deletion (P11), and hash non-leakage (P12). Uses `fc.string` with hex alphabet (fast-check v4 API — `hexaString` was removed). 242 server tests pass. |
| 2026-07-21 | Auth routes (task 4.3) | Added `server/src/routes/auth-routes.ts` — `createAuthRouter(authService)` factory. `POST /login`: validates input (400), authenticates, sets httpOnly/Secure/SameSite=Strict cookie (7-day max-age), returns `{ admin: { id, username } }`; 429+Retry-After on rate limit; 401 on bad creds; 500 on unexpected errors. `POST /logout`: auth-guarded, invalidates session, clears cookie (Max-Age=0), returns 204. `GET /me`: auth-guarded, returns `{ admin: { id } }`. Auth middleware applied inline (not globally). 19 unit tests in `auth-routes.test.ts`. 279 server tests pass. |
| 2026-07-21 | Wire auth middleware into app (task 4.5) | Updated `app.ts`: added `cookie-parser`, instantiated `createAuthService`+`createAuthMiddleware`, registered `/api/auth` and `/api/test/reset` BEFORE `app.use('/api', authMiddleware)` so those routes are exempt. All other `/api/*` routers registered after the middleware and are now protected. 280 server tests pass. |
| 2026-07-21 | Auth API client (task 6.1) | Added `client/src/services/auth-api-client.ts` — `authRequest<T>` helper always includes `credentials: 'include'` for httpOnly cookie transmission. Exports `login(username, password)`, `logout()`, `fetchCurrentAdmin()`. Same BASE_URL + error-handling pattern as `investment-api-client.ts`. 16 unit tests in `auth-api-client.test.ts`; 53 client tests pass. |
| 2026-07-21 | Auth API client property test (task 6.4) | Added `client/src/__tests__/auth-api-client.property.test.ts` — Property 10 (Validates: Requirements 4.3). Installed `fast-check` as a client devDependency. 100 iterations each for login, logout, fetchCurrentAdmin: for any arbitrary 401 error message string, the function throws an Error whose message matches the server's `error` field. 3 property tests pass. |
| 2026-07-21 | Auth context (task 6.3) | Added `client/src/contexts/auth-context.tsx` — `AuthProvider` + `useAuth`. State: `isAuthenticated`, `isLoading`, `admin`. On mount calls `fetchCurrentAdmin()` with 5 s timeout (Req 4.5). `login()` propagates errors to caller. `logout()` wraps API call with 10 s timeout; always clears auth state and calls `queryClient.clear()` on success or failure (Req 5.3–5.5). Accepts `queryClient` prop for cache clearing. Added `@testing-library/dom@10` devDependency (peer dep of `@testing-library/react`). 13 unit tests in `auth-context.test.tsx`; 73 client tests pass. |
| 2026-07-21 | Server integration tests (task 10.1) | Added `server/src/__tests__/auth-integration.test.ts` — full-stack integration tests using real PostgreSQL, Supertest, and PrismaClient. Covers: login flow (token + httpOnly cookie + session DB record), invalid credential error parity, validation errors, protected route access (no cookie / malformed token / valid token / sliding-window refresh), logout (204 + Max-Age=0 cookie + DB deletion + post-logout 401), and rate limiting (429 + Retry-After header). `afterEach` resets the module-level rate-limiter via a successful login (calls internal `rateLimiter.reset(ip)`). 300 server tests pass. |
