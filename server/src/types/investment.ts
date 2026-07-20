/**
 * Types shared across the investment domain (v2).
 * Prisma's generated types use Decimal objects — these types use plain
 * strings/numbers that are safe to serialise over JSON.
 *
 * Quantity and averagePrice are no longer stored on the investment row;
 * they are computed at query time from the associated orders.
 * See order.ts for ComputedPosition, EnrichedInvestment, and ArchivedInvestment.
 */

/** Discriminates between equity/stock assets and government bonds. */
export type AssetType = 'STOCK' | 'TREASURY';

/**
 * Investment as stored in the database (all fields serialised).
 * The v2 schema removes quantity/averagePrice columns and adds archivedAt
 * for soft-delete support.
 * v3 adds assetType, currentValue, and treasury product relation.
 */
export interface InvestmentRecord {
  id: string;
  ticker: string;
  /** Asset class. Defaults to STOCK for all pre-v3 rows. */
  type: AssetType;
  /** Investment sector (e.g. "Bancos", "Energia Elétrica"). */
  sector: string | null;
  /** ISO timestamp; null means the investment is active. */
  archivedAt: string | null;
  /** User-defined sell target price as a Decimal string, e.g. "32.50000000". Null when not set. */
  targetSellPrice: string | null;
  /** User-defined buy target price as a Decimal string, e.g. "28.00000000". Null when not set. */
  targetBuyPrice: string | null;
  /**
   * Manually-entered current value for non-STOCK assets (e.g. Tesouro Direto).
   * Null when not set — UI shows N/A. Stored as Decimal string, e.g. "30882.59000000".
   */
  currentValue: string | null;
  /** FK to treasury_products; only set when type = TREASURY. */
  treasuryProductId: string | null;
  /** Display name from the treasury product catalog. Null for STOCK investments. */
  treasuryProductName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Live market data fetched from Yahoo Finance. */
export interface MarketQuote {
  currentPrice: number;
  dailyChangePercent: number;
}

/**
 * Validated input for creating a new stock investment.
 */
export interface CreateInvestmentInput {
  /** Trimmed, uppercased; 1–10 chars; letters, digits, dots, and hyphens. */
  ticker: string;
  /** Must be one of the allowed sectors from INVESTMENT_SECTORS. */
  sector: string;
}

/**
 * Validated input for creating a new treasury investment.
 */
export interface CreateTreasuryInvestmentInput {
  /** UUID of the TreasuryProduct row. */
  treasuryProductId: string;
}

/**
 * A treasury product from the catalog table.
 */
export interface TreasuryProductRecord {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

/**
 * Validated input for updating the manual current value of an investment.
 * Used by non-STOCK assets (e.g. Tesouro Direto) that don't have a live quote.
 */
export interface UpdateCurrentValueInput {
  /** Positive number or null to clear. */
  currentValue: number | null;
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
