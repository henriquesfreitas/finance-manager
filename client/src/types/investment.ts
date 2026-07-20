/**
 * TypeScript types for investments on the frontend (v3).
 * Mirror the shapes the server returns over the API.
 */

/** Discriminates between equity/stock assets and government bonds. */
export type AssetType = 'STOCK' | 'TREASURY';

/** Live market data from Yahoo Finance, null when unavailable. */
export interface MarketQuote {
  currentPrice: number;
  dailyChangePercent: number;
}

/** Computed position derived from order history (never stored). */
export interface ComputedPosition {
  /** Decimal string, e.g. "100.50000000" */
  quantity: string;
  /** Decimal string, e.g. "28.35000000" */
  averagePrice: string;
}

/**
 * Raw investment record as returned by POST /api/investments
 * and PATCH /api/investments/:id/archive.
 */
export interface InvestmentRecord {
  id: string;
  ticker: string;
  /** Asset class. STOCK for equities, TREASURY for Tesouro Direto. */
  type: AssetType;
  /** Investment sector (e.g. "Bancos", "Energia Elétrica"). Nullable for legacy rows. */
  sector: string | null;
  archivedAt: string | null;
  /** User-defined sell target price as a Decimal string. Null when not set. */
  targetSellPrice: string | null;
  /** User-defined buy target price as a Decimal string. Null when not set. */
  targetBuyPrice: string | null;
  /**
   * Manually-entered current value for TREASURY assets (e.g. "30882.59000000").
   * Null when not set — UI shows N/A.
   */
  currentValue: string | null;
  /** FK to treasury_products; only set when type = TREASURY. */
  treasuryProductId: string | null;
  /** Full display name from the treasury product catalog. Null for STOCK investments. */
  treasuryProductName: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Active investment enriched with computed position + live market quote.
 * Returned by GET /api/investments.
 */
export interface InvestmentListItem extends InvestmentRecord {
  position: ComputedPosition;
  /** null for TREASURY assets or when Yahoo Finance is unavailable. */
  quote: MarketQuote | null;
}

/**
 * Archived investment with its final computed position.
 * archivedAt is guaranteed non-null.
 * Returned by GET /api/investments/archived.
 */
export interface ArchivedInvestmentItem extends InvestmentRecord {
  archivedAt: string; // non-null for archived items
  position: ComputedPosition;
}

/** Calculated fields derived on the frontend — never stored. */
export interface CalculatedFields {
  totalInvested: number;
  currentTotal: number | null;
  profit: number | null;
  totalVariation: number | null;
}

/**
 * Treasury product from the catalog, used to populate the add-investment dropdown.
 * Returned by GET /api/treasury-products.
 */
export interface TreasuryProduct {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}
