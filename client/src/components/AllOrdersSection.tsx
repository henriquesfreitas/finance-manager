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
import { calculateSellTotalInvested, calculateSellProfit } from '@/lib/investment-calculator';
import { formatQuantity } from '@/lib/utils';

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
              {orders.map((order: OrderWithTicker) => {
                const isSellWithPm = order.type === 'SELL' && order.averagePriceAtSell !== null;
                const qty = parseFloat(order.quantity);
                const sellPrice = parseFloat(order.price);
                const pm = isSellWithPm ? parseFloat(order.averagePriceAtSell!) : null;
                const totalSold = isSellWithPm ? qty * sellPrice : null;
                const totalInvestedAtSell = calculateSellTotalInvested(qty, pm);
                const profit = totalSold !== null ? calculateSellProfit(totalSold, totalInvestedAtSell) : null;
                const profitColor =
                  profit === null
                    ? 'text-muted-foreground'
                    : profit > 0
                    ? 'text-green-600 dark:text-green-400'
                    : profit < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-foreground';

                return (
                  <React.Fragment key={order.id}>
                    <TableRow>
                      <TableCell className="font-medium">{order.ticker}</TableCell>
                      <TableCell>
                        <span className={`${orderTypeColorClass(order.type)} font-medium`}>
                          {order.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {order.type === 'SPLIT'
                          ? `×${formatQuantity(parseFloat(order.quantity))}`
                          : formatQuantity(parseFloat(order.quantity))}
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
                          : (parseFloat(order.quantity) * parseFloat(order.price)).toFixed(2)}
                      </TableCell>
                    </TableRow>
                    {isSellWithPm && pm !== null && totalSold !== null && (
                      <TableRow className="bg-muted/30 hover:bg-muted/40">
                        <TableCell colSpan={7} className="py-1">
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-2 text-xs text-muted-foreground">
                            <span>
                              PM: <span className="font-medium text-foreground">R$ {pm.toFixed(2)}</span>
                            </span>
                            <span>
                              Investido: <span className="font-medium text-foreground">
                                R$ {totalInvestedAtSell !== null ? totalInvestedAtSell.toFixed(2) : '—'}
                              </span>
                            </span>
                            <span>
                              Vendido: <span className="font-medium text-foreground">R$ {totalSold.toFixed(2)}</span>
                            </span>
                            <span>
                              Lucro:{' '}
                              <span className={`font-semibold ${profitColor}`}>
                                {profit !== null
                                  ? `${profit >= 0 ? '+' : ''}R$ ${profit.toFixed(2)}`
                                  : '—'}
                              </span>
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
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
