/**
 * Types shared across the investment domain (v2).
 * Prisma's generated types use Decimal objects — these types use plain
 * strings/numbers that are safe to serialise over JSON.
 *
 * Quantity and averagePrice are no longer stored on the investment row;
 * they are computed at query time from the associated orders.
 * See order.ts for ComputedPosition, EnrichedInvestment, and ArchivedInvestment.
 */

/**
 * Investment as stored in the database (all fields serialised).
 * The v2 schema removes quantity/averagePrice columns and adds archivedAt
 * for soft-delete support.
 */
export interface InvestmentRecord {
  id: string;
  ticker: string;
  /** Investment sector (e.g. "Bancos", "Energia Elétrica"). */
  sector: string | null;
  /** ISO timestamp; null means the investment is active. */
  archivedAt: string | null;
  /** User-defined sell target price as a Decimal string, e.g. "32.50000000". Null when not set. */
  targetSellPrice: string | null;
  /** User-defined buy target price as a Decimal string, e.g. "28.00000000". Null when not set. */
  targetBuyPrice: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Live market data fetched from Yahoo Finance. */
export interface MarketQuote {
  currentPrice: number;
  dailyChangePercent: number;
}

/**
 * Validated input for creating a new investment.
 */
export interface CreateInvestmentInput {
  /** Trimmed, uppercased; 1–10 chars; letters, digits, and dots only. */
  ticker: string;
  /** Must be one of the allowed sectors from INVESTMENT_SECTORS. */
  sector: string;
}

/**
 * Validated input for updating target prices.
 * Each field is optional — send only the fields you want to change.
 * A null value explicitly clears the target.
 */
export interface UpdateTargetPricesInput {
  targetSellPrice?: number | null | undefined;
  targetBuyPrice?: number | null | undefined;
}
