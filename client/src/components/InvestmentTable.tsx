import React from 'react';
import { PlusCircle, Archive } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import type { InvestmentListItem } from '@/types/investment';
import {
  calculateTotalInvested,
  calculateCurrentTotal,
  calculateProfit,
  calculateTotalVariation,
  calculatePortfolioWeight,
  calculatePortfolioWeightByInvested,
} from '@/lib/investment-calculator';
import { EditablePriceCell } from '@/components/EditablePriceCell';
import { useUpdateTargetPrices } from '@/hooks/useInvestments';
import { toast } from 'sonner';

interface InvestmentTableProps {
  investments: InvestmentListItem[];
  isLoading: boolean;
  onAddOrder: (investment: InvestmentListItem) => void;
  onArchive: (investment: InvestmentListItem) => void;
  onTickerClick: (id: string, ticker: string, sector: string | null) => void;
}

/** Formats a number as BRL currency. */
function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formats a number as a percentage with 2 decimal places. */
function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

/** Formats a number as a percentage with 1 decimal place (no sign prefix). */
function formatPortfolioPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Returns Tailwind text-color classes based on sign.
 * Positive → green, negative → red, zero/null → neutral.
 */
function profitColorClass(value: number | null): string {
  if (value === null) return 'text-muted-foreground';
  if (value > 0) return 'text-green-600 dark:text-green-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-foreground';
}

/**
 * Investment portfolio table (v2).
 * Displays computed position from server response, live market data, and derived fields.
 * Shows loading skeleton rows while data is being fetched.
 */
export function InvestmentTable({
  investments,
  isLoading,
  onAddOrder,
  onArchive,
  onTickerClick,
}: InvestmentTableProps): React.JSX.Element {
  // Compute portfolio-level totals once for the weight column.
  // If any position lacks a current price, portfolioCurrentTotal is null (all-or-nothing).
  const portfolioCurrentTotal = investments.reduce<number | null>((acc, inv) => {
    if (acc === null) return null;
    const qty = parseFloat(inv.position.quantity);
    const price = inv.quote?.currentPrice ?? null;
    const current = calculateCurrentTotal(qty, price);
    if (current === null) return null;
    return acc + current;
  }, 0);

  const portfolioTotalInvested = investments.reduce((acc, inv) => {
    const qty = parseFloat(inv.position.quantity);
    const avg = parseFloat(inv.position.averagePrice);
    return acc + calculateTotalInvested(qty, avg);
  }, 0);

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableHeaderRow />
          </TableHeader>
          <TableBody>
            {Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 14 }).map((_, j) => (
                  <TableCell key={j}>
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (investments.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableHeaderRow />
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={14} className="py-12 text-center text-muted-foreground">
                No investments yet. Click "Add Investment" to get started.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableHeaderRow />
        </TableHeader>
        <TableBody>
          {investments.map((investment) => (
            <InvestmentRow
              key={investment.id}
              investment={investment}
              portfolioCurrentTotal={portfolioCurrentTotal}
              portfolioTotalInvested={portfolioTotalInvested}
              onAddOrder={onAddOrder}
              onArchive={onArchive}
              onTickerClick={onTickerClick}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TableHeaderRow(): React.JSX.Element {
  return (
    <TableRow>
      <TableHead>Ticker</TableHead>
      <TableHead>Sector</TableHead>
      <TableHead className="text-right">Quantity</TableHead>
      <TableHead className="text-right">Avg Price</TableHead>
      <TableHead className="text-right">Current Price</TableHead>
      <TableHead className="text-right">Target Sell</TableHead>
      <TableHead className="text-right">Target Buy</TableHead>
      <TableHead className="text-right">Daily Change %</TableHead>
      <TableHead className="text-right">Total Invested</TableHead>
      <TableHead className="text-right">Current Total</TableHead>
      <TableHead className="text-right">Profit</TableHead>
      <TableHead className="text-right">Variation %</TableHead>
      <TableHead className="text-right">Portfolio %</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </TableRow>
  );
}

interface InvestmentRowProps {
  investment: InvestmentListItem;
  portfolioCurrentTotal: number | null;
  portfolioTotalInvested: number;
  onAddOrder: (investment: InvestmentListItem) => void;
  onArchive: (investment: InvestmentListItem) => void;
  onTickerClick: (id: string, ticker: string, sector: string | null) => void;
}

/** Returns true when the investment has no orders (position quantity is "0.00000000"). */
function hasNoOrders(investment: InvestmentListItem): boolean {
  return parseFloat(investment.position.quantity) === 0;
}

function InvestmentRow({ investment, portfolioCurrentTotal, portfolioTotalInvested, onAddOrder, onArchive, onTickerClick }: InvestmentRowProps): React.JSX.Element {
  const { mutate: saveTargetPrices, isPending: isSavingTargets } = useUpdateTargetPrices();

  const quantity = parseFloat(investment.position.quantity);
  const averagePrice = parseFloat(investment.position.averagePrice);
  const currentPrice = investment.quote?.currentPrice ?? null;
  const dailyChangePercent = investment.quote?.dailyChangePercent ?? null;

  // Parse stored target prices (Decimal strings) to numbers for comparison/display
  const targetSellPrice = investment.targetSellPrice !== null
    ? parseFloat(investment.targetSellPrice)
    : null;
  const targetBuyPrice = investment.targetBuyPrice !== null
    ? parseFloat(investment.targetBuyPrice)
    : null;

  // Color coding: sell target turns green when current >= target (time to sell)
  const sellTargetClass =
    currentPrice !== null && targetSellPrice !== null && currentPrice >= targetSellPrice
      ? 'text-green-600 dark:text-green-400'
      : '';

  // Color coding: buy target turns green when current <= target (good entry point)
  const buyTargetClass =
    currentPrice !== null && targetBuyPrice !== null && currentPrice <= targetBuyPrice
      ? 'text-green-600 dark:text-green-400'
      : '';

  // When the investment has no orders, all computed fields are zero (Req 9.4)
  const noOrders = hasNoOrders(investment);

  const totalInvested = noOrders ? 0 : calculateTotalInvested(quantity, averagePrice);

  // Market-dependent fields are null when quote is unavailable (Req 9.6),
  // but still show zero when investment has no orders
  const currentTotal = noOrders ? 0 : calculateCurrentTotal(quantity, currentPrice);
  const profit = noOrders ? 0 : calculateProfit(currentTotal, totalInvested);
  // totalVariation returns null when totalInvested is 0 (avoids division by zero — Req 9.3)
  const totalVariation = noOrders ? 0 : calculateTotalVariation(profit, totalInvested);

  // Portfolio weight: current-value basis (primary), invested basis (tooltip)
  const portfolioWeight = noOrders
    ? null
    : calculatePortfolioWeight(currentTotal, portfolioCurrentTotal);
  const portfolioWeightByInvested = noOrders
    ? null
    : calculatePortfolioWeightByInvested(totalInvested, portfolioTotalInvested);

  const portfolioWeightTooltip =
    portfolioWeightByInvested !== null
      ? `By invested: ${formatPortfolioPercent(portfolioWeightByInvested)}`
      : 'By invested: N/A';

  function handleSellTargetSave(value: number | null): void {
    saveTargetPrices(
      { id: investment.id, targetSellPrice: value },
      {
        onError: () => toast.error(`Failed to save Target Sell for ${investment.ticker}`),
      },
    );
  }

  function handleBuyTargetSave(value: number | null): void {
    saveTargetPrices(
      { id: investment.id, targetBuyPrice: value },
      {
        onError: () => toast.error(`Failed to save Target Buy for ${investment.ticker}`),
      },
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        <button
          className="cursor-pointer underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
          onClick={() => onTickerClick(investment.id, investment.ticker, investment.sector)}
          aria-label={`View comments for ${investment.ticker}`}
        >
          {investment.ticker}
        </button>
      </TableCell>
      <TableCell>
        {investment.sector
          ? <span>{investment.sector}</span>
          : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-right">{quantity.toLocaleString('pt-BR')}</TableCell>
      <TableCell className="text-right">{formatCurrency(averagePrice)}</TableCell>
      <TableCell className="text-right">
        {currentPrice !== null
          ? formatCurrency(currentPrice)
          : <span className="text-muted-foreground">N/A</span>}
      </TableCell>
      <TableCell className={`text-right ${sellTargetClass}`}>
        <EditablePriceCell
          value={targetSellPrice}
          onSave={handleSellTargetSave}
          isPending={isSavingTargets}
          className={sellTargetClass}
          ariaLabel={`Edit Target Sell price for ${investment.ticker}`}
        />
      </TableCell>
      <TableCell className={`text-right ${buyTargetClass}`}>
        <EditablePriceCell
          value={targetBuyPrice}
          onSave={handleBuyTargetSave}
          isPending={isSavingTargets}
          className={buyTargetClass}
          ariaLabel={`Edit Target Buy price for ${investment.ticker}`}
        />
      </TableCell>
      <TableCell className={`text-right ${dailyChangePercent !== null ? profitColorClass(dailyChangePercent) : 'text-muted-foreground'}`}>
        {dailyChangePercent !== null ? formatPercent(dailyChangePercent) : 'N/A'}
      </TableCell>
      <TableCell className="text-right">{formatCurrency(totalInvested)}</TableCell>
      <TableCell className="text-right">
        {currentTotal !== null
          ? formatCurrency(currentTotal)
          : <span className="text-muted-foreground">N/A</span>}
      </TableCell>
      <TableCell className={`text-right ${profitColorClass(profit)}`}>
        {profit !== null
          ? formatCurrency(profit)
          : <span className="text-muted-foreground">N/A</span>}
      </TableCell>
      <TableCell className={`text-right ${profitColorClass(totalVariation)}`}>
        {totalVariation !== null
          ? formatPercent(totalVariation)
          : <span className="text-muted-foreground">N/A</span>}
      </TableCell>
      <TableCell className="text-right">
        {portfolioWeight !== null ? (
          <span
            title={portfolioWeightTooltip}
            className="cursor-help underline decoration-dotted underline-offset-2"
          >
            {formatPortfolioPercent(portfolioWeight)}
          </span>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddOrder(investment)}
            aria-label={`Add order for ${investment.ticker}`}
          >
            <PlusCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onArchive(investment)}
            aria-label={`Archive ${investment.ticker}`}
            className="text-destructive hover:text-destructive"
          >
            <Archive className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
