# Business Rules — Finance Manager

This document records product behavior and domain invariants. For AI contribution guidance, see [`AGENTS.md`](AGENTS.md). Confirm details in the implementation before changing them; update this document when a business rule changes.

For the database tables, columns, relationships, indexes, and enums, see [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md). Update that reference alongside database schema or migration changes.

## Investments

- An investment is either a `STOCK` or `TREASURY` asset. Stock tickers are stored uppercase and unique. A treasury investment refers to a catalog product; its slug is used as its unique ticker and its sector is `Renda Fixa`.
- Stock sectors must come from the server's `INVESTMENT_SECTORS` list. The client list is for display and must stay aligned with the server list.
- FIIs use the sector labels `FIIs — Tijolo`, `FIIs — Papel`, or `FIIs — Misto`. Classify by the fund's primary strategy; use Misto when property and credit strategies are both material. New stock records cannot use the generic `FIIs` label; it remains available for legacy records and sector edits.
- Treasury products are catalog entries, not hardcoded investment options.
- Active investments can be archived and later restored. Archived investments remain visible in the archive and cannot receive new, edited, or deleted orders. Archived stocks do not fetch live quotes.
- Target buy price, target sell price, intended buy and sell quantities, manual current value, and recommendation are optional user-entered fields. Prices and quantities must be positive when set; they can be cleared. Recommendation is an integer from 1 through 5, or unset.
- A BUY reduces an investment's intended buy quantity by the order quantity, down to zero. Other order types do not consume it.
- A SELL reduces an investment's intended sell quantity by the order quantity, down to zero. Other order types do not consume it.

## Orders and positions

- Order history is the source of truth for position quantity and weighted average price (preço médio). The current position is computed from orders in chronological order, with creation time breaking same-day ties; do not store a second authoritative position.
- `BUY` and `BONUS` both add quantity and apply the order price in the weighted-average formula. `SELL` reduces quantity and keeps the average price. `SPLIT` multiplies quantity by its factor and divides average price by that factor, preserving total cost. Results are rounded to 8 decimal places.
- A position reaching zero resets its average price to zero. A later BUY starts a new average at that order's price.
- A SELL cannot exceed the available quantity at that point in the order history. Creating, editing, or deleting an order must not leave a negative position at any point. Orders on archived investments cannot be changed.
- A SELL records `averagePriceAtSell` as a snapshot of the weighted average at creation. A caller-supplied value may override the computed snapshot; users may edit it later. Older SELL orders may have no snapshot. BUY, BONUS, and SPLIT orders do not use this field.
- A recorded SELL's invested amount is quantity × `averagePriceAtSell`; its realized profit or loss is sale proceeds minus that amount. If the snapshot is absent, these derived values are unavailable.
- `contractedRate` is optional purchase-time information for treasury orders; it is not used to compute the stock-style weighted average.

## Portfolio values

- Invested amount is position quantity × weighted average price.
- Current value is position quantity × current unit price. Stock unit price comes from market quotes; treasury unit price comes from its manually entered current value.
- If a required current price is unavailable, current value, profit/loss, and variation are unavailable rather than treated as zero. Variation is unavailable when invested amount is zero.
- Portfolio weight uses current values when available. If any asset lacks a current value, that asset falls back to its invested amount so the portfolio weight can still be calculated.
- Market quote failure must not make an otherwise valid investment disappear; show the quote-dependent values as unavailable.
- Buy and sell target prices are user-defined thresholds. A sell target is reached when the current price is at or above it; a buy target is reached when the current price is at or below it.

## Comments

- Investment comments belong to one investment and are listed newest first. Portfolio plan comments are shared across users with `INVESTMENTS` permission and are also listed newest first.
- Both comment types contain 1–10000 characters.
- Updating or deleting an investment comment must verify that it belongs to the investment in the request.

## Bills Control

- Bill types are `INTERNET`, `CLEANING`, `CONDOMINIO`, `ENERGY`, `CARD`, `OTHER`, and `RECEIVED`. `OTHER` and `RECEIVED` can store optional detail, with a maximum length of 500 characters. `RECEIVED` records an amount received for equal sharing; its receiver is stored in `paidBy`, responsibility is always split equally, and its amount is excluded from the monthly bill expense total.
- Bills are allocated to a selected `YYYY-MM` month. By default, the stored date is the last calendar day of that month; users may enable a specific date when adding or editing a bill. The form defaults to the previous month through the 10th day of a month, then to the current month.
- New bills default to paid in the form. The monthly bill total includes paid and unpaid expenses, but excludes `RECEIVED` amounts.
- `paidBy` identifies who paid an expense or received a `RECEIVED` amount; it can be unset. `responsibleBy` assigns the entire expense to one person. If responsibility is assigned, a payer is required and must be the other person. With no responsible person, the expense is split equally.
- Settlement includes only paid bills with a payer or receiver. Equal-split expenses are balanced between Henrique and Amanda. A `RECEIVED` amount is balanced in the opposite direction: its receiver owes the other person half. A bill assigned to one person is reimbursed in full by that person to the other payer. Paid bills without a payer or receiver are excluded from settlement. The displayed settlement rounds to the nearest cent.
- Changing, deleting, or changing the paid status of a bill resets that month's recorded settlement-paid status. Moving a bill between months resets both the old and new month's settlement status.
- The UI asks for confirmation before adding a second or later `INTERNET`, `CONDOMINIO`, or `ENERGY` bill in the same month. This is a warning and may be confirmed; it does not prohibit duplicates.

## Access permissions

- `INVESTMENTS` grants access to investment, order, comment, and treasury-product features. `BILLS_CONTROL` grants access to Bills Control.
- `BUDGET` grants access to the Budgets page and limits users to their own budgets. `ADMIN` allows cross-user budget access, and is granted only to the exact `admin_finance` username by the seed and migration.
- A user may have any combination of these permissions. Both the UI and server enforce page access; the server remains authoritative.
- Each budget belongs to the authenticated admin who created it. Users with only `BUDGET` can list, view, and manage items only in their own budgets. Users with `ADMIN` can select users with budgets and view and manage their budget items. Items store signed monetary values and the budget total includes all items regardless of paid status.
