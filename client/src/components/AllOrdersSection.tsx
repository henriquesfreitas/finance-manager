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
import { Button } from '@/components/ui/button';
import { getInitialBillsLanguage } from '@/i18n/bills';

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

function isFiiSector(sector: string | null): boolean {
  return sector === 'FIIs' || sector?.startsWith('FIIs — ') === true;
}

/**
 * Displays a global list of all orders across all investments, latest first.
 * Shows ticker, type, quantity/factor, price, date, and total.
 *
 * @example <AllOrdersSection />
 */
export function AllOrdersSection(): React.JSX.Element {
  const { data: orders, isLoading, isError } = useAllOrders();
  const [showAllOrders, setShowAllOrders] = React.useState(false);
  const [orderFilter, setOrderFilter] = React.useState('all');
  const language = getInitialBillsLanguage();
  const salesYears = [...new Set(
    (orders ?? [])
      .filter((order) => order.type === 'SELL')
      .map((order) => order.orderDate.slice(0, 4)),
  )].sort((a, b) => b.localeCompare(a));
  const filteredOrders = orders?.filter((order) => {
    if (orderFilter === 'all') return true;
    if (order.type !== 'SELL') return false;
    if (orderFilter === 'sales') return true;
    return order.orderDate.slice(0, 4) === orderFilter.slice('year:'.length);
  });
  const fiiSales = filteredOrders?.filter((order) => order.type === 'SELL' && isFiiSector(order.sector)) ?? [];
  const fiiSalesWithAveragePrice = fiiSales.filter((order) => order.averagePriceAtSell !== null);
  const fiiSalesMissingAveragePrice = fiiSales.length - fiiSalesWithAveragePrice.length;
  const fiiTotalSold = fiiSales.reduce(
    (total, order) => total + parseFloat(order.quantity) * parseFloat(order.price),
    0,
  );
  const fiiTotalInvested = fiiSalesWithAveragePrice.reduce(
    (total, order) => total + parseFloat(order.quantity) * parseFloat(order.averagePriceAtSell!),
    0,
  );
  const fiiProfit = fiiSalesMissingAveragePrice === 0 ? fiiTotalSold - fiiTotalInvested : null;
  const visibleOrders = showAllOrders ? filteredOrders : filteredOrders?.slice(0, 15);
  const copy = language === 'pt'
    ? {
        filterLabel: 'Filtrar histórico de ordens',
        allOrders: 'Todas as ordens',
        allSales: 'Todas as vendas',
        salesIn: (year: string) => `Vendas de ${year}`,
        noSales: 'Nenhuma venda registrada neste filtro.',
        fiiSummary: 'Resumo das vendas de FIIs',
        fiiSalesCount: 'Vendas de FIIs',
        fiiSalesDetails: 'Detalhes das vendas de FIIs',
        fiiSaleDate: 'Data',
        fiiSaleProfit: 'Lucro',
        fiiSaleLoss: 'Prejuízo',
        fiiSaleUnavailable: 'Indisponível',
        fiiTotalSold: 'Total vendido',
        fiiTotalInvested: 'Valor investido',
        fiiProfit: 'Lucro realizado',
        fiiProfitUnavailable: (count: number) => `Lucro indisponível: ${count} venda(s) sem preço médio registrado.`,
      }
    : {
        filterLabel: 'Filter order history',
        allOrders: 'All orders',
        allSales: 'All sales',
        salesIn: (year: string) => `Sales in ${year}`,
        noSales: 'No sales recorded for this filter.',
        fiiSummary: 'FII sales summary',
        fiiSalesCount: 'FII sell orders',
        fiiSalesDetails: 'FII sale details',
        fiiSaleDate: 'Date',
        fiiSaleProfit: 'Profit',
        fiiSaleLoss: 'Loss',
        fiiSaleUnavailable: 'Unavailable',
        fiiTotalSold: 'Total sold',
        fiiTotalInvested: 'Amount invested',
        fiiProfit: 'Realized profit',
        fiiProfitUnavailable: (count: number) => `Profit unavailable: ${count} sale(s) have no recorded average price.`,
      };

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Order History</h2>
        <select
          aria-label={copy.filterLabel}
          value={orderFilter}
          onChange={(event) => {
            setOrderFilter(event.target.value);
            setShowAllOrders(false);
          }}
          className="h-9 max-w-[14rem] rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="all">{copy.allOrders}</option>
          <option value="sales">{copy.allSales}</option>
          {salesYears.map((year) => (
            <option key={year} value={`year:${year}`}>{copy.salesIn(year)}</option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="rounded-md border">
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

      {!isLoading && !isError && orders && orders.length > 0 && filteredOrders?.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {copy.noSales}
        </p>
      )}

      {!isLoading && !isError && orders && filteredOrders && filteredOrders.length > 0 && (
        <div className="rounded-md border">
          <Table className="min-w-[480px]">
            <TableHeader>
              <OrdersTableHeaderRow />
            </TableHeader>
            <TableBody>
              {visibleOrders?.map((order: OrderWithTicker) => {
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
          {filteredOrders.length > 15 && (
            <div className="flex justify-center border-t p-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAllOrders((current) => !current)}
              >
                {showAllOrders ? 'Show latest 15 orders' : `Show all ${filteredOrders.length} orders`}
              </Button>
            </div>
          )}
        </div>
      )}

      {!isLoading && !isError && (orderFilter === 'sales' || orderFilter.startsWith('year:')) && fiiSales.length > 0 && (
        <section className="rounded-md border p-4" aria-label={copy.fiiSummary}>
          <h3 className="text-sm font-semibold">{copy.fiiSummary}</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">{copy.fiiSalesCount}</dt>
              <dd className="font-medium">
                <span className="group relative inline-flex">
                  <button
                    type="button"
                    aria-label={copy.fiiSalesDetails}
                    aria-describedby="fii-sales-tooltip"
                    className="cursor-help rounded-sm underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {fiiSales.length}
                  </button>
                  <span
                    id="fii-sales-tooltip"
                    role="tooltip"
                    className="invisible absolute left-0 top-full z-30 w-72 max-w-[calc(100vw-3rem)] pt-2 text-left opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                  >
                    <span className="block max-h-64 overflow-y-auto rounded-xl border border-border/80 bg-popover p-3 text-popover-foreground shadow-xl ring-1 ring-black/5">
                      <span className="mb-2 block text-xs font-semibold">{copy.fiiSalesDetails}</span>
                      <span className="grid gap-2">
                        {fiiSales.map((order) => {
                          const totalSold = parseFloat(order.quantity) * parseFloat(order.price);
                          const invested = calculateSellTotalInvested(
                            parseFloat(order.quantity),
                            order.averagePriceAtSell === null ? null : parseFloat(order.averagePriceAtSell),
                          );
                          const profit = calculateSellProfit(totalSold, invested);
                          const locale = language === 'pt' ? 'pt-BR' : 'en-US';
                          const value = profit === null
                            ? copy.fiiSaleUnavailable
                            : `${profit >= 0 ? '+' : ''}${new Intl.NumberFormat(locale, { style: 'currency', currency: 'BRL' }).format(profit)}`;

                          return (
                            <span key={order.id} className="flex items-start justify-between gap-3 border-t pt-2 text-xs">
                              <span className="min-w-0">
                                <span className="block truncate font-medium">{order.ticker}</span>
                                <span className="text-muted-foreground">
                                  {copy.fiiSaleDate}: {new Date(`${order.orderDate}T12:00:00`).toLocaleDateString(locale)}
                                </span>
                              </span>
                              <span className={`shrink-0 font-semibold ${profit === null ? 'text-muted-foreground' : profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {profit === null ? value : `${profit >= 0 ? copy.fiiSaleProfit : copy.fiiSaleLoss}: ${value}`}
                              </span>
                            </span>
                          );
                        })}
                      </span>
                    </span>
                  </span>
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{copy.fiiTotalSold}</dt>
              <dd className="font-medium">R$ {fiiTotalSold.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{copy.fiiTotalInvested}</dt>
              <dd className="font-medium">
                {fiiProfit === null ? '—' : `R$ ${fiiTotalInvested.toFixed(2)}`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{copy.fiiProfit}</dt>
              <dd className={`font-semibold ${fiiProfit === null ? 'text-muted-foreground' : fiiProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {fiiProfit === null ? '—' : `${fiiProfit >= 0 ? '+' : ''}R$ ${fiiProfit.toFixed(2)}`}
              </dd>
            </div>
          </dl>
          {fiiProfit === null && (
            <p className="mt-3 text-xs text-muted-foreground">
              {copy.fiiProfitUnavailable(fiiSalesMissingAveragePrice)}
            </p>
          )}
        </section>
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
