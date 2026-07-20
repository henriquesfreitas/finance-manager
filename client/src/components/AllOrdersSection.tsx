import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAllOrders } from '@/hooks/useOrders';
import type { OrderWithTicker } from '@/types/order';

/** Returns Tailwind text-color class based on order type. */
function orderTypeColorClass(type: string): string {
  if (type === 'BUY') return 'text-green-600';
  if (type === 'SELL') return 'text-red-600';
  if (type === 'BONUS') return 'text-blue-600';
  return 'text-purple-600'; // SPLIT
}

/** Formats an "YYYY-MM-DD" string as dd/MM/yyyy (pt-BR). */
function formatOrderDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR');
}

/** Computes the order total from decimal string fields. */
function computeTotal(quantity: string, price: string): string {
  return (parseFloat(quantity) * parseFloat(price)).toFixed(2);
}

/**
 * Displays a global list of all orders across all investments, latest first.
 * Shows ticker, type, quantity/factor, price, date, and total.
 *
 * @example <AllOrdersSection />
 */
export function AllOrdersSection(): React.JSX.Element {
  const { data: orders, isLoading, isError } = useAllOrders();

  return (
    <div className="grid gap-3">
      <h2 className="text-lg font-semibold tracking-tight">Order History</h2>

      {isLoading && (
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[480px]">
            <TableHeader>
              <OrdersTableHeaderRow />
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {isError && (
        <p className="py-4 text-center text-sm text-destructive">
          Unable to load order history.
        </p>
      )}

      {!isLoading && !isError && orders && orders.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No orders recorded yet.
        </p>
      )}

      {!isLoading && !isError && orders && orders.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[480px]">
            <TableHeader>
              <OrdersTableHeaderRow />
            </TableHeader>
            <TableBody>
              {orders.map((order: OrderWithTicker) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.ticker}</TableCell>
                  <TableCell>
                    <span className={`${orderTypeColorClass(order.type)} font-medium`}>
                      {order.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {order.type === 'SPLIT'
                      ? `×${parseFloat(order.quantity).toFixed(2)}`
                      : parseFloat(order.quantity).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {order.type === 'SPLIT'
                      ? '—'
                      : parseFloat(order.price).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {order.contractedRate
                      ? `${parseFloat(order.contractedRate).toFixed(2)}%`
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatOrderDate(order.orderDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    {order.type === 'SPLIT'
                      ? '—'
                      : computeTotal(order.quantity, order.price)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function OrdersTableHeaderRow(): React.JSX.Element {
  return (
    <TableRow>
      <TableHead>Ticker</TableHead>
      <TableHead>Type</TableHead>
      <TableHead className="text-right">Quantity</TableHead>
      <TableHead className="text-right">Price (R$)</TableHead>
      <TableHead className="text-right">Rate (%)</TableHead>
      <TableHead className="text-right">Date</TableHead>
      <TableHead className="text-right">Total (R$)</TableHead>
    </TableRow>
  );
}
