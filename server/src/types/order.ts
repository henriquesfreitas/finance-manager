import type { MarketQuote } from './investment.js';

/**
 * Types for the order domain (v2).
 * Orders are the source of truth for investment positions — quantity and
 * weighted average price are computed at query time from order history.
 */

/** Distinguishes a buy from a sell transaction. */
export type OrderType = 'BUY' | 'SELL' | 'BONUS' | 'SPLIT';

/**
 * Validated input for creating a new order.
 * Received from the client after Zod parsing.
 */
export interface CreateOrderInput {
  type: OrderType;
  /** Must be greater than 0 */
  quantity: number;
  /** Unit price, must be greater than 0 */
  price: number;
  /** ISO date string (YYYY-MM-DD), must not be in the future */
  orderDate: string;
}

/**
 * Validated input for updating an existing order.
 * All fields are optional — only supplied fields are changed.
 */
export interface UpdateOrderInput {
  type?: OrderType;
  /** Must be greater than 0 when provided */
  quantity?: number;
  /** Unit price, must be greater than 0 when provided */
  price?: number;
  /** ISO date string (YYYY-MM-DD), must not be in the future when provided */
  orderDate?: string;
}

/**
 * Order as stored in the database, with all fields serialised for JSON.
 * Decimal fields (quantity, price) are represented as strings to avoid
 * floating-point drift.
 */
export interface OrderRecord {
  id: string;
  investmentId: string;
  type: OrderType;
  /** Serialised Decimal(18,8) string, e.g. "100.00000000" */
  quantity: string;
  /** Serialised Decimal(18,8) string, e.g. "28.35000000" */
  price: string;
  /** ISO date string (date only, no time component) */
  orderDate: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * OrderRecord enriched with the ticker symbol for display in global lists.
 */
export interface OrderWithTicker extends OrderRecord {
  ticker: string;
}

/**
 * Computed position derived from a sequence of orders using the Brazilian
 * "preço médio ponderado" (weighted average price) method.
 * Both fields are Decimal strings to preserve precision.
 */
export interface ComputedPosition {
  /** Sum of all BUY quantities minus sum of all SELL quantities */
  quantity: string;
  /** Weighted average unit price; zero when quantity is zero */
  averagePrice: string;
}

/**
 * Investment record as returned by the v2 active-listing endpoint.
 * Extends the base record with a computed position and optional live quote.
 */
export interface EnrichedInvestment {
  id: string;
  ticker: string;
  sector: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Computed from order history at query time — never stored. */
  position: ComputedPosition;
  /** null when Yahoo Finance is unavailable or the ticker is unrecognised. */
  quote: MarketQuote | null;
}

/**
 * Archived investment as returned by the archived-listing endpoint.
 * Includes the final computed position at the time of the query.
 */
export interface ArchivedInvestment {
  id: string;
  ticker: string;
  sector: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Final position computed from all historical orders. */
  position: ComputedPosition;
}
