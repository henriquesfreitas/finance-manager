# Implementation Plan: Order Management v2

## Overview

Transform the Finance Investment Manager from a manual quantity/average-price model into an order-based system. Users register tickers and log buy/sell orders; the system computes position quantity and weighted average price (preço médio ponderado) on-the-fly. Hard-delete is replaced with soft-delete (archive). This is a clean-slate implementation with fresh database migration and no v1 data migration.

## Tasks

- [x] 1. Database schema and server foundation
  - [x] 1.1 Create v2 Prisma schema with orders table and soft-delete
    - Remove `quantity` and `averagePrice` columns from `investments` model
    - Add `archivedAt DateTime?` column to `investments` model
    - Create `Order` model with id, investmentId (FK), type (OrderType enum), quantity (Decimal 18,8), price (Decimal 18,8), orderDate (Date), createdAt, updatedAt
    - Create `OrderType` enum with BUY and SELL values
    - Set `onDelete: Restrict` on the investment relation
    - Generate fresh migration from empty state
    - _Requirements: 8.1, 8.2, 8.3, 10.1, 10.2, 10.3_

  - [x] 1.2 Create server TypeScript interfaces and types
    - Create `server/src/types/order.ts` with OrderType, CreateOrderInput, OrderRecord, ComputedPosition, EnrichedInvestment, ArchivedInvestment interfaces
    - Update `server/src/types/investment.ts` to remove quantity/averagePrice and add archivedAt
    - _Requirements: 8.1, 10.1_

  - [x] 1.3 Create Zod validators for investment (ticker-only) and orders
    - Rewrite `server/src/validators/investment-validator.ts` with ticker-only schema (trim, 1-10 chars, letters/digits/dots, uppercase transform)
    - Create `server/src/validators/order-validator.ts` with type (BUY|SELL), quantity (positive), price (positive), orderDate (ISO date, not future) schema
    - _Requirements: 1.1, 1.5, 2.2, 2.5, 2.6_

- [x] 2. Core business logic — weighted average calculator
  - [x] 2.1 Implement weighted average calculator as a pure function
    - Create `server/src/services/weighted-average-calculator.ts`
    - Implement `computePosition(orders: OrderEntry[]): PositionState` using preço médio ponderado method
    - BUY: newAvg = (prevQty × prevAvg + orderQty × orderPrice) / (prevQty + orderQty)
    - SELL: reduce quantity, keep average unchanged
    - Zero position: reset average to zero; next BUY sets average to order price
    - Round results to 8 decimal places
    - Export factory function following project DI conventions
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6_

  - [ ]* 2.2 Write property test: Weighted average computation correctness (Property 3)
  - [ ]* 2.3 Write property test: Sell preserves weighted average price (Property 4)
  - [ ]* 2.4 Write property test: Quantity invariant (Property 5)
  - [ ]* 2.5 Write property test: Sell exceeding position is rejected (Property 6)
  - [ ]* 2.6 Write property test: Computation determinism (Property 7)
  - [ ]* 2.7 Write property test: Zero position resets average (Property 8)
  - [ ]* 2.8 Write unit tests for weighted average calculator

- [x] 3. Checkpoint — core calculator verified

- [x] 4. Server services and routes — investments
  - [x] 4.1 Implement investment service (create, listActive, listArchived, archive)
    - _Requirements: 1.1, 1.4, 6.2, 6.3, 7.1, 7.2, 8.5, 10.4_

  - [x] 4.2 Implement investment routes (POST, GET, PATCH archive, removed PUT)
    - _Requirements: 1.1, 6.2, 7.1, 8.5, 10.4, 10.5_

  - [ ]* 4.3 Write unit tests for investment service

- [x] 5. Server services and routes — orders
  - [x] 5.1 Implement order service (createOrder, listOrders)
    - _Requirements: 2.3, 2.4, 3.1, 3.2, 3.3, 5.1_

  - [x] 5.2 Implement order routes
    - _Requirements: 2.3, 3.1, 5.1_

  - [ ]* 5.3 Write property test: Order sort descending by date (Property 9)
  - [ ]* 5.4 Write unit tests for order service

- [ ] 6. Validators property tests
  - [ ]* 6.1 Write property test: Ticker validation round-trip (Property 1)
  - [ ]* 6.2 Write property test: Order numeric validation (Property 2)

- [x] 7. Checkpoint — server complete

- [x] 8. Client types, API client, and hooks
  - [x] 8.1 Create client TypeScript types for v2
  - [x] 8.2 Update investment API client for v2 endpoints
  - [x] 8.3 Create order API client
  - [x] 8.4 Update useInvestments hook for v2
  - [x] 8.5 Create useOrders hook

- [x] 9. Client components — investment registration and table
  - [x] 9.1 Create AddInvestmentForm component (ticker-only)
  - [x] 9.2 Update InvestmentTable for computed columns

- [x] 10. Client components — order modal
  - [x] 10.1 Create OrderModal component

- [x] 11. Client components — archive
  - [x] 11.1 Create ArchiveConfirmDialog component
  - [x] 11.2 Create ArchiveSection component

- [x] 12. Client page integration
  - [x] 12.1 Rewrite HomePage to orchestrate v2 components

- [ ] 13. Active listing excludes archived — property test
  - [ ]* 13.1 Write property test: Active listing excludes archived (Property 10)

- [x] 14. Checkpoint — full feature complete

- [x] 15. Cleanup and final wiring
  - [x] 15.1 Remove deprecated v1 code and update app wiring
  - [ ]* 15.2 Write integration tests for full order lifecycle

- [x] 16. Final checkpoint

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The weighted average calculator is implemented first as it's the core business logic used by both services
- Server is completed before client to ensure API contracts are stable
- No v1 data migration — fresh schema from empty database state

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8"] },
    { "id": 3, "tasks": ["4.1", "5.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "5.2", "5.3", "5.4"] },
    { "id": 5, "tasks": ["6.1", "6.2", "13.1"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3"] },
    { "id": 7, "tasks": ["8.4", "8.5"] },
    { "id": 8, "tasks": ["9.1", "9.2"] },
    { "id": 9, "tasks": ["10.1", "11.1", "11.2"] },
    { "id": 10, "tasks": ["12.1"] },
    { "id": 11, "tasks": ["15.1"] },
    { "id": 12, "tasks": ["15.2"] }
  ]
}
```
