export type OrderType = 'BUY' | 'SELL' | 'BONUS' | 'SPLIT';

/**
 * A single order record as returned by the API.
 * Numeric fields are serialized as strings (Decimal precision).
 */
export interface OrderListItem {
  id: string;
  type: OrderType;
  /** Decimal string — e.g. "100.00000000" */
  quantity: string;
  /** Decimal string — e.g. "28.50000000" */
  price: string;
  /** ISO date string — "YYYY-MM-DD" */
  orderDate: string;
  /** Contracted rate at purchase time — e.g. "6.50" for IPCA+ 6.5%. Null for stocks or when not recorded. */
  contractedRate: string | null;
  /**
   * Weighted average price (preço médio) snapshot at sell time.
   * Null for BUY/BONUS/SPLIT and for historical SELL orders without a recorded PM.
   */
  averagePriceAtSell: string | null;
  createdAt: string;
}

/**
 * Order record enriched with ticker, returned by the global orders endpoint.
 */
export interface OrderWithTicker extends OrderListItem {
  investmentId: string;
  ticker: string;
}

/**
 * Form data collected when the user submits a new order.
 * `orderDate` is a Date object from the date picker; the API client converts
 * it to an ISO date string before sending (slice(0, 10)).
 */
export interface AddOrderFormData {
  type: OrderType;
  /** Must be > 0 */
  quantity: number;
  /** Unit price, must be > 0 */
  price: number;
  orderDate: Date;
  /** Contracted rate for TREASURY orders (e.g. 6.5 for IPCA+ 6.5%). Optional. */
  contractedRate?: number | null;
}

/**
 * Form data collected when the user edits an existing order.
 * All fields are optional — only changed fields are sent.
 */
export interface UpdateOrderFormData {
  type?: OrderType;
  quantity?: number;
  price?: number;
  orderDate?: Date;
  /** Contracted rate — pass null to clear */
  contractedRate?: number | null;
  /** Pass null to clear the PM snapshot */
  averagePriceAtSell?: number | null;
}
