import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useArchivedInvestments } from '@/hooks/useInvestments';
import { useOrders } from '@/hooks/useOrders';
import type { ArchivedInvestmentItem } from '@/types/investment';
import type { OrderListItem, OrderType } from '@/types/order';
import { formatQuantity } from '@/lib/utils';

/** Formats a number as BRL currency. */
function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formats an ISO date string as dd/MM/yyyy. */
function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('pt-BR');
}

/**
 * Archive section displaying all archived investments with their final position.
 * Each row is expandable to show the full order history for that investment.
 * Fetches data internally — no props required beyond the component mount.
 *
 * @example <ArchiveSection onTickerClick={handleTickerClick} />
 */
export function ArchiveSection({
  onTickerClick,
}: {
  onTickerClick: (id: string, ticker: string, sector: string | null) => void;
}): React.JSX.Element {
  const { data: investments = [], isLoading } = useArchivedInvestments();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string): void {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (isLoading) {
    return <ArchiveSectionSkeleton />;
  }

  return (
    <section aria-label="Archived investments">
      <h2 className="mb-3 text-lg font-semibold text-foreground">Archived Investments</h2>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Ticker</TableHead>
              <TableHead className="text-right">Final Quantity</TableHead>
              <TableHead className="text-right">Final Avg Price</TableHead>
              <TableHead className="text-right">Archived Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {investments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  No archived investments
                </TableCell>
              </TableRow>
            ) : (
              investments.map((investment) => (
                <ArchivedInvestmentRows
                  key={investment.id}
                  investment={investment}
                  isExpanded={expandedIds.has(investment.id)}
                  onToggle={() => toggleExpanded(investment.id)}
                  onTickerClick={onTickerClick}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

interface ArchivedInvestmentRowsProps {
  investment: ArchivedInvestmentItem;
  isExpanded: boolean;
  onToggle: () => void;
  onTickerClick: (id: string, ticker: string, sector: string | null) => void;
}

/**
 * Renders the summary row for one archived investment plus, when expanded,
 * a sub-row containing the full order history table.
 */
function ArchivedInvestmentRows({
  investment,
  isExpanded,
  onToggle,
  onTickerClick,
}: ArchivedInvestmentRowsProps): React.JSX.Element {
  const quantity = formatQuantity(parseFloat(investment.position.quantity));
  const averagePrice = parseFloat(investment.position.averagePrice);
  const archivedDate = formatDate(investment.archivedAt);

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell className="w-8 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            aria-label={isExpanded ? `Collapse ${investment.ticker}` : `Expand ${investment.ticker}`}
            onClick={(e) => {
              // Prevent double-firing since the row itself also calls onToggle
              e.stopPropagation();
              onToggle();
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell className="font-medium">
          <button
            className="cursor-pointer underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
            onClick={(e) => { e.stopPropagation(); onTickerClick(investment.id, investment.ticker, investment.sector); }}
            aria-label={`View comments for ${investment.ticker}`}
          >
            {investment.ticker}
          </button>
        </TableCell>
        <TableCell className="text-right">{quantity}</TableCell>
        <TableCell className="text-right">{formatCurrency(averagePrice)}</TableCell>
        <TableCell className="text-right">{archivedDate}</TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/30 p-0">
            <OrderHistorySubRow investmentId={investment.id} ticker={investment.ticker} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

interface OrderHistorySubRowProps {
  investmentId: string;
  ticker: string;
}

/** Loads and displays the order history for one archived investment. */
function OrderHistorySubRow({ investmentId, ticker }: OrderHistorySubRowProps): React.JSX.Element {
  const { data: orders, isLoading, isError } = useOrders(investmentId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading order history…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-4 text-center text-sm text-destructive">
        Could not load order history for {ticker}.
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No orders recorded for {ticker}.
      </div>
    );
  }

  return (
    <div className="px-8 py-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Order History — {ticker}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 text-xs">Type</TableHead>
            <TableHead className="h-8 text-right text-xs">Quantity</TableHead>
            <TableHead className="h-8 text-right text-xs">Price</TableHead>
            <TableHead className="h-8 text-right text-xs">Date</TableHead>
            <TableHead className="h-8 text-right text-xs">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface OrderRowProps {
  order: OrderListItem;
}

/** Renders a single order row inside the expanded order history sub-table. */
function OrderRow({ order }: OrderRowProps): React.JSX.Element {
  const quantity = formatQuantity(parseFloat(order.quantity));
  const price = parseFloat(order.price);
  const total = parseFloat(order.quantity) * price;

  return (
    <TableRow>
      <TableCell className="py-2">
        <OrderTypeBadge type={order.type} />
      </TableCell>
      <TableCell className="py-2 text-right">{quantity}</TableCell>
      <TableCell className="py-2 text-right">{formatCurrency(price)}</TableCell>
      <TableCell className="py-2 text-right">{formatDate(order.orderDate)}</TableCell>
      <TableCell className="py-2 text-right">{formatCurrency(total)}</TableCell>
    </TableRow>
  );
}

interface OrderTypeBadgeProps {
  type: OrderType;
}

/** Badge styled green for BUY, red for SELL. */
function OrderTypeBadge({ type }: OrderTypeBadgeProps): React.JSX.Element {
  if (type === 'BUY') {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">
        BUY
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      SELL
    </Badge>
  );
}

/** Loading skeleton shown while archived investments are being fetched. */
function ArchiveSectionSkeleton(): React.JSX.Element {
  return (
    <section aria-label="Archived investments">
      <h2 className="mb-3 text-lg font-semibold text-foreground">Archived Investments</h2>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Ticker</TableHead>
              <TableHead className="text-right">Final Quantity</TableHead>
              <TableHead className="text-right">Final Avg Price</TableHead>
              <TableHead className="text-right">Archived Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 2 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 5 }).map((_, j) => (
                  <TableCell key={j}>
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
