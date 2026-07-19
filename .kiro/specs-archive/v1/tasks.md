# Tasks — Finance Investment Manager v1

## Task 1: Project Scaffolding & Infrastructure

### Task 1.1: Docker Compose + Postgres
- [ ] Create `docker-compose.yml` at project root with Postgres 16 service
- [ ] Configure volume for data persistence
- [ ] Expose port 5432 on localhost
- [ ] Add `.env.example` with DB connection vars
- [ ] Add `.env` to `.gitignore`
- [ ] Verify: `docker compose up -d` starts Postgres successfully

### Task 1.2: Server Project Setup
- [ ] Initialize `server/` with `npm init`
- [ ] Install dependencies: express, prisma, @prisma/client, yahoo-finance2, zod, cors, dotenv
- [ ] Install dev dependencies: typescript, vitest, @types/express, @types/cors, tsx, eslint, prettier
- [ ] Configure `tsconfig.json` (strict mode)
- [ ] Configure ESLint + Prettier
- [ ] Add npm scripts: `dev`, `build`, `start`, `test`, `lint`
- [ ] Create basic Express server entry point with health check route
- [ ] Verify: `npm run dev` starts server, `GET /health` returns 200

### Task 1.3: Prisma Schema & Migration
- [ ] Run `npx prisma init`
- [ ] Define `Investment` model: id (UUID), ticker (String), quantity (Decimal), averagePrice (Decimal), createdAt, updatedAt
- [ ] Configure Prisma to connect to Docker Postgres
- [ ] Run `npx prisma migrate dev --name init`
- [ ] Verify: migration applied, table exists in DB

### Task 1.4: Client Project Setup
- [ ] Create `client/` with Vite + React + TypeScript template
- [ ] Install dependencies: @tanstack/react-query, react-hook-form, zod, @hookform/resolvers
- [ ] Install shadcn/ui dependencies (tailwindcss, postcss, autoprefixer, class-variance-authority, clsx, tailwind-merge, lucide-react)
- [ ] Initialize shadcn/ui (`npx shadcn-ui@latest init`)
- [ ] Install dev dependencies: vitest, @testing-library/react, @testing-library/jest-dom, jsdom, @playwright/test
- [ ] Configure `tsconfig.json` (strict mode)
- [ ] Configure ESLint + Prettier
- [ ] Add npm scripts: `dev`, `build`, `test`, `test:e2e`, `lint`
- [ ] Verify: `npm run dev` starts Vite dev server with default page

### Task 1.5: Playwright Setup
- [ ] Run `npx playwright install chromium`
- [ ] Create `playwright.config.ts` in `client/`
- [ ] Configure base URL pointing to Vite dev server
- [ ] Configure webServer option to auto-start Vite during test runs
- [ ] Create a smoke test (`e2e/smoke.spec.ts`) that verifies the app loads
- [ ] Verify: `npm run test:e2e` passes

---

## Task 2: Backend — API & Business Logic

### Task 2.1: Project Structure
- [ ] Create folder structure:
  - `server/src/routes/`
  - `server/src/services/`
  - `server/src/validators/`
  - `server/src/lib/` (Prisma client, Yahoo Finance wrapper)
  - `server/src/types/`
  - `server/src/__tests__/`
- [ ] Create Prisma client singleton (`server/src/lib/prisma-client.ts`)
- [ ] Create Express app setup with middleware (cors, json parsing, error handler)

### Task 2.2: Yahoo Finance Service
- [ ] Create `server/src/services/yahoo-finance-quote-service.ts`
- [ ] Implement `fetchQuote(ticker: string)` — appends `.SA`, calls yahoo-finance2, returns `{ currentPrice, dailyChangePercent }` or `null`
- [ ] Implement `fetchQuotes(tickers: string[])` — batch fetch for multiple tickers
- [ ] Add 5-minute in-memory cache (Map with TTL)
- [ ] Handle errors gracefully: network failures, invalid tickers → return null
- [ ] Write unit tests: valid ticker returns data, invalid ticker returns null, cache works, error handling
- [ ] Verify: tests pass

### Task 2.3: Investment Validation
- [ ] Create `server/src/validators/investment-validator.ts`
- [ ] Define Zod schema for create: `{ ticker: string (non-empty, uppercased), quantity: number (> 0), averagePrice: number (>= 0) }`
- [ ] Define Zod schema for update: same as create (all fields required)
- [ ] Write unit tests: valid input passes, invalid input returns descriptive errors
- [ ] Verify: tests pass

### Task 2.4: Investment Service
- [ ] Create `server/src/services/investment-service.ts`
- [ ] Implement `listInvestments()` — fetch all from DB, enrich with Yahoo Finance quotes
- [ ] Implement `createInvestment(data)` — validate, save to DB
- [ ] Implement `updateInvestment(id, data)` — validate, update in DB
- [ ] Implement `deleteInvestment(id)` — remove from DB
- [ ] Write unit tests with mocked Prisma and mocked Yahoo Finance service
- [ ] Verify: tests pass

### Task 2.5: Investment Routes
- [ ] Create `server/src/routes/investment-routes.ts`
- [ ] `GET /api/investments` → listInvestments
- [ ] `GET /api/investments/:id` → getInvestment (enriched with quote)
- [ ] `POST /api/investments` → createInvestment
- [ ] `PUT /api/investments/:id` → updateInvestment
- [ ] `DELETE /api/investments/:id` → deleteInvestment
- [ ] Error handling: 400 for validation errors, 404 for not found, 500 for server errors
- [ ] Structured JSON error responses: `{ error: string, details?: object }`
- [ ] Write unit tests for route handlers (mocked service)
- [ ] Verify: tests pass, manual test with curl/Postman confirms endpoints work

---

## Task 3: Frontend — UI Components & Logic

### Task 3.1: Project Structure & Shared Utilities
- [ ] Create folder structure:
  - `client/src/components/`
  - `client/src/services/`
  - `client/src/lib/`
  - `client/src/types/`
  - `client/src/__tests__/`
  - `client/e2e/`
- [ ] Create `client/src/types/investment.ts` — TypeScript types for Investment (stored + enriched)
- [ ] Create `client/src/lib/investment-calculator.ts` — pure functions: `calculateTotalInvested`, `calculateCurrentTotal`, `calculateProfit`, `calculateTotalVariation`
- [ ] Write unit tests for all calculator functions (positive, negative, zero, edge cases like division by zero)
- [ ] Verify: tests pass

### Task 3.2: API Client
- [ ] Create `client/src/services/investment-api-client.ts`
- [ ] Implement functions: `fetchInvestments()`, `createInvestment(data)`, `updateInvestment(id, data)`, `deleteInvestment(id)`
- [ ] Configure base URL from environment variable
- [ ] Set up TanStack Query provider in `App.tsx`
- [ ] Create custom hooks: `useInvestments()`, `useCreateInvestment()`, `useUpdateInvestment()`, `useDeleteInvestment()`
- [ ] Verify: hooks compile without error

### Task 3.3: Investment Table Component
- [ ] Install shadcn/ui components: Table, Button, Badge
- [ ] Create `InvestmentTable.tsx` — renders table with all columns
- [ ] Use calculator functions for computed fields
- [ ] Color-code profit/variation: green for positive, red for negative, neutral for zero
- [ ] Show "N/A" when currentPrice is null (API unavailable)
- [ ] Add "Edit" button per row
- [ ] Add "Delete" button per row
- [ ] Loading state while data is being fetched
- [ ] Empty state when no investments exist
- [ ] Verify: component renders correctly with mock data

### Task 3.4: Add/Edit Modal Component
- [ ] Install shadcn/ui components: Dialog, Input, Label, Form
- [ ] Create `InvestmentFormModal.tsx` — reusable for add and edit
- [ ] React Hook Form + Zod validation (ticker required, quantity > 0, averagePrice >= 0)
- [ ] Ticker field auto-uppercases on input
- [ ] Pre-fill fields when editing
- [ ] Clear form when opening for "add"
- [ ] On save: call create or update mutation, close modal on success
- [ ] On cancel: close modal, discard changes
- [ ] Show loading state during save
- [ ] Show validation errors inline
- [ ] Verify: form validates correctly, submits data

### Task 3.5: Delete Confirmation Dialog
- [ ] Install shadcn/ui component: AlertDialog
- [ ] Create `DeleteConfirmationDialog.tsx`
- [ ] Show ticker name in confirmation message
- [ ] On confirm: call delete mutation, close dialog
- [ ] On cancel: close dialog
- [ ] Verify: dialog works correctly

### Task 3.6: Home Page Assembly
- [ ] Create `client/src/pages/HomePage.tsx`
- [ ] Header with app title ("Finance Investment Manager")
- [ ] "Add Investment" button (top right)
- [ ] Wire up InvestmentTable with real data from `useInvestments()`
- [ ] Wire up modal open/close state
- [ ] Wire up delete dialog state
- [ ] Verify: full page renders with all components connected

---

## Task 4: Integration & E2E Tests

### Task 4.1: Full Stack Integration Test
- [ ] Ensure docker compose, server, and client all start together
- [ ] Create a seed script or test helper to reset DB state
- [ ] Verify: app loads in browser, shows empty state

### Task 4.2: E2E — Add Investment Flow
- [ ] Test: click "Add Investment" → modal opens
- [ ] Test: fill form (ticker: ITUB3, quantity: 100, averagePrice: 28.35) → save
- [ ] Test: new row appears in table with correct stored values
- [ ] Test: current price and daily change show real or "N/A" values
- [ ] Test: calculated fields are correct
- [ ] Verify: test passes

### Task 4.3: E2E — Edit Investment Flow
- [ ] Test: click "Edit" on existing row → modal opens pre-filled
- [ ] Test: modify quantity → save
- [ ] Test: table updates with new calculated values
- [ ] Verify: test passes

### Task 4.4: E2E — Delete Investment Flow
- [ ] Test: click "Delete" on existing row → confirmation dialog appears
- [ ] Test: click "Cancel" → row remains
- [ ] Test: click "Confirm" → row disappears
- [ ] Verify: test passes

### Task 4.5: E2E — Validation
- [ ] Test: submit empty form → validation errors shown
- [ ] Test: submit negative quantity → error
- [ ] Test: submit invalid ticker → appropriate error/feedback
- [ ] Verify: test passes

### Task 4.6: E2E — Color Coding
- [ ] Test: investment with positive profit → green styling on profit and variation
- [ ] Test: investment with negative profit → red styling
- [ ] Test: investment with zero profit → neutral styling
- [ ] Verify: test passes

---

## Task 5: Polish & Documentation

### Task 5.1: Error Handling & Edge Cases
- [ ] Graceful handling when Postgres is down
- [ ] Graceful handling when Yahoo Finance is down (partial data shown)
- [ ] Loading spinners/skeletons while data fetches
- [ ] Toast notifications on successful CRUD operations
- [ ] Verify: all error states handled

### Task 5.2: README
- [ ] Create root `README.md` with:
  - Project description
  - Tech stack
  - Prerequisites (Docker, Node 20+)
  - Setup instructions (single command flow)
  - Available scripts
  - Project structure
  - API documentation summary
- [ ] Verify: following README from scratch reaches a working state

### Task 5.3: Final Audit
- [ ] Run full test suite (unit + E2E)
- [ ] Run linters on both projects
- [ ] Verify all acceptance criteria from requirements.md are met
- [x] Update PROJECT_RULES.md with any new patterns introduced during implementation
- [ ] Confirm docker compose up + npm run dev reaches working app
