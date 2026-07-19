import { request } from './api-client';
import type { AddOrderFormData, UpdateOrderFormData, OrderListItem, OrderWithTicker } from '../types/order';

/**
 * Computed position returned by the server after an order is created.
 * Both fields are Decimal strings (8 decimal places).
 */
export interface ComputedPosition {
  quantity: string;
  averagePrice: string;
}

/**
 * Converts a Date object to "YYYY-MM-DD" using the local timezone.
 * Avoids the UTC off-by-one that occurs with toISOString() when the local
 * timezone is behind UTC (e.g. BRT = UTC-3).
 */
function toLocalDateString(date: Date): string {
  return date.toLocaleDateString('en-CA'); // en-CA formats as YYYY-MM-DD
}

/**
 * Fetches all orders for a given investment, sorted by orderDate DESC
 * with createdAt DESC as a tiebreaker.
 *
 * GET /api/investments/:id/orders
 */
export function fetchOrders(investmentId: string): Promise<OrderListItem[]> {
  return request<OrderListItem[]>(`/api/investments/${investmentId}/orders`);
}

/**
 * Fetches all orders across all investments, latest first.
 * Each order is enriched with its ticker symbol.
 *
 * GET /api/orders
 */
export function fetchAllOrders(): Promise<OrderWithTicker[]> {
  return request<OrderWithTicker[]>('/api/orders');
}

/**
 * Creates a new order for a given investment and returns the updated
 * computed position (server recalculates quantity and weighted average price).
 *
 * `orderDate` is a Date object on the form — it is converted to an ISO date
 * string (YYYY-MM-DD) before being sent in the request body.
 *
 * POST /api/investments/:id/orders
 */
export function createOrder(
  investmentId: string,
  data: AddOrderFormData,
): Promise<ComputedPosition> {
  const body = {
    type: data.type,
    quantity: data.quantity,
    price: data.price,
    // Convert Date → "YYYY-MM-DD" using local timezone to avoid UTC off-by-one
    orderDate: toLocalDateString(data.orderDate),
  };

  return request<ComputedPosition>(`/api/investments/${investmentId}/orders`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Updates an existing order and returns the updated computed position.
 * Only the provided fields are changed (partial update).
 *
 * PUT /api/investments/:id/orders/:orderId
 */
export function updateOrder(
  investmentId: string,
  orderId: string,
  data: UpdateOrderFormData,
): Promise<ComputedPosition> {
  const body: Record<string, unknown> = {
    ...(data.type !== undefined && { type: data.type }),
    ...(data.quantity !== undefined && { quantity: data.quantity }),
    ...(data.price !== undefined && { price: data.price }),
    ...(data.orderDate !== undefined && {
      orderDate: toLocalDateString(data.orderDate),
    }),
  };

  return request<ComputedPosition>(`/api/investments/${investmentId}/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
