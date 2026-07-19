# Requirements Document

## Introduction

Redesign of the investment management system (v2) that shifts from manually entering quantity and average price to an order-based model. Users register tickers of interest, log individual buy/sell orders, and the system computes quantity and weighted average price automatically using the Brazilian "preço médio ponderado" method. The existing hard-delete is replaced with soft-delete (archiving), preserving order history. This is a clean-slate implementation with no data migration from v1.

## Glossary

- **System**: The Finance Investment Manager application (client + server)
- **Investment**: A record representing a tracked ticker, with computed quantity and average price derived from orders
- **Order**: A single buy or sell transaction recorded against an investment, containing type, quantity, price, and date
- **Order_Type**: An enumeration with values BUY or SELL
- **Weighted_Average_Price**: The Brazilian "preço médio ponderado" calculation — total cost of accumulated shares divided by total accumulated quantity, recalculated on each BUY order
- **Archived_Investment**: An investment marked as cancelled/archived via soft-delete, hidden from the main list but preserved with full order history
- **Add_Investment_Form**: The simplified form containing only a ticker field for registering a new ticker of interest
- **Order_Modal**: The dialog opened from an investment row to add orders and view order history
- **Investment_Table**: The main table displaying active (non-archived) investments with computed fields
- **Archive_Section**: A separate UI section displaying archived investments and their preserved order history

## Requirements

### Requirement 1: Simplified Investment Registration

**User Story:** As an investor, I want to register a ticker with only its symbol, so that I can track tickers I'm interested in even before placing orders.

#### Acceptance Criteria

1. WHEN the user submits the Add_Investment_Form with a non-empty ticker (after trimming) that contains only letters, digits, and dots and is at most 10 characters long, THE System SHALL create an Investment record with quantity of zero and average price of zero
2. THE Add_Investment_Form SHALL contain only a ticker text field and a submit button
3. WHEN the user types in the ticker field, THE Add_Investment_Form SHALL convert the input to uppercase in real time
4. IF the user submits a ticker that, after trimming and uppercasing, matches the ticker of an existing Investment record, THEN THE System SHALL prevent the form submission entirely and display an error indicating the ticker is already registered
5. IF the user submits a ticker field that is empty or contains only whitespace, THEN THE System SHALL display a validation error requiring a non-empty ticker

### Requirement 2: Order Creation

**User Story:** As an investor, I want to log buy and sell orders against a registered ticker, so that my portfolio quantities and average prices are calculated automatically.

#### Acceptance Criteria

1. WHEN the user clicks the "Add Order" action on an Investment row, THE System SHALL open the Order_Modal for that investment
2. THE Order_Modal SHALL display a form with fields for Order_Type (BUY or SELL), quantity (positive number greater than zero), unit price (positive number greater than zero), and order date (must not be in the future, defaulting to today's date when the modal is opened)
3. WHEN the user submits an order form where all fields pass validation AND the form is explicitly submitted by the user, THE System SHALL persist a new Order record linked to the Investment and display a success notification
4. THE Order record SHALL store the order type, quantity (Decimal 18,8), unit price (Decimal 18,8), order date, and a non-nullable foreign key reference to the parent Investment
5. IF the user submits an order with quantity of zero or negative, THEN THE System SHALL display a validation error requiring a positive quantity
6. IF the user submits an order with a unit price of zero or negative, THEN THE System SHALL display a validation error requiring a positive unit price

### Requirement 3: Sell Order Validation

**User Story:** As an investor, I want the system to prevent sell orders that exceed my current position, so that I cannot have a negative quantity.

#### Acceptance Criteria

1. IF the user submits a SELL order with quantity exceeding the current computed quantity of the Investment, THEN THE System SHALL reject the order and display an error indicating the sell quantity exceeds the available position
2. WHEN a SELL order is submitted with quantity less than the current computed quantity of the Investment, THE System SHALL accept and persist the order, reducing the computed quantity accordingly
3. WHEN a SELL order is submitted with quantity equal to the current computed quantity of the Investment, THE System SHALL accept and persist the order, resulting in a computed quantity of zero
4. IF the user submits a SELL order with a quantity of zero, THEN THE System SHALL reject the order as invalid input and display a validation error requiring a positive quantity

### Requirement 4: Weighted Average Price Calculation

**User Story:** As an investor, I want my average price computed using the Brazilian weighted average method, so that my portfolio reflects the standard local accounting practice.

#### Acceptance Criteria

1. WHEN a BUY order is added, THE System SHALL recalculate the Weighted_Average_Price as: (previous_quantity × previous_average_price + order_quantity × order_unit_price) / (previous_quantity + order_quantity), rounded to 8 decimal places
2. WHEN a SELL order is added, THE System SHALL reduce the quantity by the sold amount without changing the Weighted_Average_Price
3. IF a SELL order quantity exceeds the current Investment quantity, THEN THE System SHALL reject only the SELL order with an error message indicating that sell quantity exceeds available quantity
4. THE System SHALL compute the Investment quantity as the sum of all BUY order quantities minus the sum of all SELL order quantities
5. IF an Investment has zero remaining quantity, THEN THE System SHALL display quantity as zero and average price as zero
6. WHEN a BUY order is added to an Investment with zero remaining quantity, THE System SHALL set the Weighted_Average_Price to the order_unit_price of that BUY order
7. FOR ALL valid sequences of orders where no SELL exceeds the running quantity at its position in the sequence, computing quantity and average price from orders sequentially then re-computing from scratch SHALL produce results equal within 8 decimal places

### Requirement 5: Order History Display

**User Story:** As an investor, I want to view the full order history for a ticker, so that I can review all my past transactions.

#### Acceptance Criteria

1. WHEN the Order_Modal is opened for an Investment, THE System SHALL display the complete list of orders sorted by date in descending order (most recent first), using order creation timestamp as tiebreaker when multiple orders share the same date
2. THE order history list SHALL display for each order: the order type (BUY or SELL), quantity formatted to 2 decimal places, unit price formatted to 2 decimal places, date formatted as dd/MM/yyyy, and computed total (quantity × price) formatted to 2 decimal places
3. WHILE the Investment has no orders AND the retrieval succeeds, THE Order_Modal SHALL display a message indicating no orders have been recorded
4. IF the System fails to retrieve the order history due to any error condition (network timeout, server error, authentication failure, or other failure), THEN THE System SHALL display an error message indicating the orders could not be loaded and SHALL NOT display a partial or stale list

### Requirement 6: Soft-Delete (Archive) Investment

**User Story:** As an investor, I want to archive an investment instead of permanently deleting it, so that I preserve the order history for future reference.

#### Acceptance Criteria

1. WHEN the user clicks the remove/archive action on an Investment, THE System SHALL display a confirmation dialog indicating the ticker being archived and requesting explicit user confirmation before proceeding
2. WHEN the user confirms the archive action, THE System SHALL mark the Investment as archived by setting an archived timestamp and return a success response; the system targets a 2-second response time but SHALL accept and complete delayed successes without rollback
3. WHEN an Investment is archived successfully AND the operation completes without error, THE System SHALL remove the Investment from the active investments list in the UI and display a success notification confirming the ticker was archived
4. THE System SHALL preserve the archived Investment record and all its associated Order records in the database
5. THE System SHALL NOT permanently delete any Investment record or Order record during the archive operation
6. IF the archive operation fails due to a network error or the Investment not being found, THEN THE System SHALL display an error notification indicating the failure reason and leave the Investment unchanged in the active list

### Requirement 7: Archived Investments Display

**User Story:** As an investor, I want to view my archived investments in a separate section, so that I can review past holdings and their order history.

#### Acceptance Criteria

1. THE System SHALL display the Archive_Section separately from the main Investment_Table
2. THE Archive_Section SHALL list all Archived_Investments with their ticker, final quantity, final average price, and archived date
3. WHEN the user expands an Archived_Investment, THE System SHALL display the full order history for that investment sorted by date in descending order, showing order type, quantity, unit price, date, and computed total
4. THE Investment_Table SHALL display only active (non-archived) investments
5. WHILE there are no Archived_Investments, THE System SHALL display the Archive_Section with a message indicating no investments have been archived; THE System SHALL hide this message immediately when any investment gets archived

### Requirement 8: Orders Database Schema

**User Story:** As a developer, I want a dedicated orders table with proper relationships, so that order data is stored reliably and can be queried efficiently.

#### Acceptance Criteria

1. THE System SHALL store orders in a dedicated `orders` table with UUID primary key, investment foreign key (non-nullable), order type constrained to BUY or SELL, quantity (Decimal 18,8, minimum 0.00000001), price (Decimal 18,8, minimum 0.00000001), orderDate (user-supplied date representing when the order was executed), and timestamps (createdAt auto-set on creation, updatedAt auto-set on modification)
2. THE orders table SHALL have a foreign key constraint referencing the investments table with ON DELETE RESTRICT behavior
3. THE System SHALL store an `archivedAt` nullable timestamp column on the investments table to support soft-delete
4. IF a deletion request is made for an Investment that is referenced by one or more orders, THEN THE System SHALL reject the request and return an error response indicating that the investment cannot be deleted due to existing order references
5. WHEN querying investments, THE System SHALL exclude investments where `archivedAt` is not null from standard listing results unless archived records are explicitly requested

### Requirement 9: Investment Table Computed Columns

**User Story:** As an investor, I want the investment table to show quantity and average price derived from my orders, so that I always see up-to-date portfolio information.

#### Acceptance Criteria

1. THE Investment_Table SHALL display the computed quantity (sum of BUY order quantities minus sum of SELL order quantities) for each Investment; WHEN the computed quantity is zero, THE System SHALL display zero indicating no current position
2. THE Investment_Table SHALL display the computed Weighted_Average_Price for each Investment, as defined in Requirement 4
3. THE Investment_Table SHALL display current price, daily change percentage, total invested (computed quantity × Weighted_Average_Price), current total (computed quantity × current price), profit (current total − total invested), and variation percentage ((profit / total invested) × 100) enriched from market data; IF total invested is zero, THEN THE System SHALL display "N/A" for variation percentage regardless of profit value
4. WHEN an Investment has no orders, THE Investment_Table SHALL display zero for both quantity and average price, and display zero for total invested, current total, profit, and variation percentage
5. WHEN an Order is added to an Investment, THE Investment_Table SHALL recalculate and display updated quantity, Weighted_Average_Price, and all derived columns within 5 seconds without requiring a full page reload
6. IF market data is unavailable for an Investment, THEN THE Investment_Table SHALL display "N/A" for current price, daily change, current total, profit, and variation percentage while still displaying the computed quantity, Weighted_Average_Price, and total invested

### Requirement 10: Clean-Slate Data Model

**User Story:** As a developer, I want to start fresh with the v2 schema without migrating v1 data, so that the implementation is not constrained by legacy data structures.

#### Acceptance Criteria

1. THE System SHALL remove the `quantity` and `averagePrice` columns from the investments table schema, replacing them with values computed at query time from the orders table as defined in Requirement 4
2. THE System SHALL use a fresh database migration that creates the v2 schema from an empty database state without referencing or depending on v1 migration history
3. THE System SHALL NOT require migration, transformation, or seeding of existing v1 investment data in order to function correctly
4. THE System SHALL remove the PUT /api/investments/:id endpoint and the client-side edit investment form, since quantity and average price are now order-derived and the ticker is immutable after creation
5. IF a client sends a PUT request to /api/investments/:id, THEN THE System SHALL respond with an error indicating the endpoint no longer exists
