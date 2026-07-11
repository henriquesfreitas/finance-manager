# Requirements — Finance Investment Manager v1

## Functional Requirements

### FR-01: View Investments
- The system shall display all investments in a table format
- The table shall show columns: Ticker, Quantity, Average Price, Current Price, Daily Change %, Total Invested, Current Total, Profit, Total Variation %, Actions
- Stored fields (user input): Ticker, Quantity, Average Price
- Fetched fields (from Yahoo Finance API, server-side): Current Price, Daily Change %
- Calculated fields (derived on frontend, not stored):
  - Total Invested = quantity × averagePrice
  - Current Total = quantity × currentPrice
  - Profit = currentTotal − totalInvested
  - Total Variation % = (profit / totalInvested) × 100
- Profit and variation shall display in green (positive) or red (negative)
- If Yahoo Finance is unavailable, price fields show "N/A" gracefully

### FR-02: Add Investment
- The system shall provide an "Add Investment" button
- Clicking it shall open a modal form
- Input fields: Ticker, Quantity, Average Price
- All fields required; numeric validation on number fields
- Ticker shall be validated against Yahoo Finance (confirm it exists as a valid symbol)
- On save, the investment shall appear in the table with live prices fetched automatically
- On cancel, no data shall be persisted

### FR-03: Edit Investment
- Each row shall have an "Edit" action
- Clicking it shall open a modal pre-filled with current data
- User can modify any field
- On save, changes shall reflect immediately in the table

### FR-04: Delete Investment
- User shall be able to delete an investment
- A confirmation dialog shall appear before deletion
- On confirm, the row shall be removed immediately

### FR-05: Data Persistence
- Investments (ticker, quantity, averagePrice) shall be stored in PostgreSQL
- Data shall persist across browser sessions / app restarts
- Current price and daily change are NOT stored — fetched live from Yahoo Finance

### FR-06: Live Market Data
- The backend shall fetch current price and daily change % from Yahoo Finance API
- Brazilian tickers shall use the `.SA` suffix when querying Yahoo (e.g., ITUB3 → ITUB3.SA)
- If the API is unavailable, the system shall gracefully degrade (show "N/A")
- Short-term caching (5 min TTL) shall be used to avoid excessive API calls

## Non-Functional Requirements

### NFR-01: Performance
- Table shall load within 1 second for up to 100 investments
- Modal open/close shall feel instant (< 200ms)

### NFR-02: Extensibility
- Backend shall be structured to easily add new models and relations
- Frontend shall use a component architecture that supports new pages/features
- API shall follow REST conventions for easy expansion

### NFR-03: Developer Experience
- Hot reload on both client and server during development
- TypeScript strict mode enabled
- Linting and formatting configured (ESLint + Prettier)
- Database runs in Docker, no local Postgres install needed

### NFR-04: Testing
- Every business logic function shall have unit tests (Vitest)
- Calculated field formulas shall be tested with multiple scenarios (positive, negative, zero, edge cases)
- Validation logic shall be unit tested
- All user flows (add, edit, delete) shall have Playwright E2E tests
- E2E tests shall verify calculated field correctness and color coding

### NFR-05: Data Validation
- All numeric fields shall reject non-numeric input
- Ticker shall be non-empty string, trimmed, uppercased
- Quantity shall be > 0
- Average Price shall be >= 0

## User Stories

### US-01
As a user, I want to see all my investments in a table so I can quickly assess my portfolio performance.

### US-02
As a user, I want to add a new investment through a form so I can track new assets I purchase.

### US-03
As a user, I want to edit an existing investment so I can update prices or correct mistakes.

### US-04
As a user, I want to delete an investment so I can remove assets I no longer hold.

### US-05
As a user, I want to see profit/loss highlighted in color so I can quickly identify winners and losers.

## Acceptance Criteria

| Story | Criteria |
|-------|----------|
| US-01 | Table renders with all columns, calculated fields are correct |
| US-02 | Modal opens, validates input, saves to DB, row appears in table |
| US-03 | Modal pre-fills data, saves changes, table updates |
| US-04 | Confirmation shown, row removed on confirm, no action on cancel |
| US-05 | Positive values green, negative values red, zero is neutral |
