/**
 * TypeScript types for investments on the frontend (v2).
 * Mirror the shapes the server returns over the API.
 */

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
  /** Investment sector (e.g. "Bancos", "Energia Elétrica"). Nullable for legacy rows. */
  sector: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Active investment enriched with computed position + live market quote.
 * Returned by GET /api/investments.
 */
export interface InvestmentListItem extends InvestmentRecord {
  position: ComputedPosition;
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
