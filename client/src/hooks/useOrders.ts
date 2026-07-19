import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  fetchOrders,
  fetchAllOrders,
  createOrder,
  updateOrder,
  type ComputedPosition,
} from '../services/order-api-client';
import type { AddOrderFormData, UpdateOrderFormData, OrderListItem, OrderWithTicker } from '../types/order';

/**
 * Cache key for the active investments list.
 * Must match ACTIVE_INVESTMENTS_QUERY_KEY from useInvestments.ts once 8.4 is complete.
 */
const ACTIVE_INVESTMENTS_QUERY_KEY = ['investments', 'active'] as const;
const ALL_ORDERS_QUERY_KEY = ['orders', 'all'] as const;

/**
 * Fetches all orders for a given investment.
 *
 * staleTime: 0 ensures orders are always re-fetched when the modal opens,
 * so the user always sees the latest order history without stale data.
 * enabled: !!investmentId prevents fetching when no investment is selected.
 */
export function useOrders(investmentId: string): UseQueryResult<OrderListItem[], Error> {
  return useQuery({
    queryKey: ['orders', investmentId],
    queryFn: () => fetchOrders(investmentId),
    staleTime: 0,
    enabled: !!investmentId,
  });
}

/**
 * Fetches all orders across all investments, latest first.
 * Used for the global order history section on the home page.
 */
export function useAllOrders(): UseQueryResult<OrderWithTicker[], Error> {
  return useQuery({
    queryKey: ALL_ORDERS_QUERY_KEY,
    queryFn: fetchAllOrders,
  });
}

/**
 * Creates a new order for the given investment.
 *
 * On success, invalidates both:
 * - the orders list for this investment (so order history refreshes)
 * - the active investments list (so computed position columns in the table update)
 */
export function useCreateOrder(
  investmentId: string,
): UseMutationResult<ComputedPosition, Error, AddOrderFormData> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddOrderFormData) => createOrder(investmentId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders', investmentId] });
      void qc.invalidateQueries({ queryKey: ACTIVE_INVESTMENTS_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ALL_ORDERS_QUERY_KEY });
    },
  });
}

/**
 * Updates an existing order for the given investment.
 *
 * On success, invalidates both:
 * - the orders list for this investment (so order history refreshes)
 * - the active investments list (so computed position columns in the table update)
 */
export function useUpdateOrder(
  investmentId: string,
): UseMutationResult<ComputedPosition, Error, { orderId: string; data: UpdateOrderFormData }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: UpdateOrderFormData }) =>
      updateOrder(investmentId, orderId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders', investmentId] });
      void qc.invalidateQueries({ queryKey: ACTIVE_INVESTMENTS_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ALL_ORDERS_QUERY_KEY });
    },
  });
}
