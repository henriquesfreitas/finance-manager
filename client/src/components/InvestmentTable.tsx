import React from 'react';
import { PlusCircle, Archive, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
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
import { useUpdateTargetPrices, useUpdateCurrentValue } from '@/hooks/useInvestments';
import { toast } from 'sonner';
import { formatQuantity } from '@/lib/utils';
import { getRecommendationColorClass } from '@/lib/recommendation';
import { useComments } from '@/hooks/useComments';

interface InvestmentTableProps {
  investments: InvestmentListItem[];
  isLoading: boolean;
  pricesLoading?: boolean;
  onAddOrder: (investment: InvestmentListItem) => void;
  onArchive: (investment: InvestmentListItem) => void;
  onTickerClick: (id: string, ticker: string, sector: string | null, recommendation: number | null) => void;
}

type SortKey =
  | 'ticker'
  | 'sector'
  | 'quantity'
  | 'averagePrice'
  | 'currentPrice'
  | 'targetSellPrice'
  | 'targetBuyPrice'
  | 'targetBuyQuantity'
  | 'dailyChangePercent'
  | 'totalInvested'
  | 'currentTotal'
  | 'profit'
  | 'totalVariation'
  | 'portfolioWeight';

type SortDirection = 'ascending' | 'descending';

interface SortState {
  key: SortKey | null;
  direction: SortDirection;
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

/** Keeps quantity cells compact while preserving the full value in the hover title. */
function formatCompactQuantity(value: number): string {
  const formatted = formatQuantity(value);
  return formatted.length > 5 ? `${formatted.slice(0, 5)}…` : formatted;
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
  pricesLoading = false,
  onAddOrder,
  onArchive,
  onTickerClick,
}: InvestmentTableProps): React.JSX.Element {
  const [sort, setSort] = React.useState<SortState>({ key: null, direction: 'ascending' });

  // Compute portfolio-level totals once for the weight column.
  // Hybrid approach: for each investment, use currentTotal if available (has live price
  // or manual currentValue), otherwise fall back to totalInvested.
  // This gives an accurate picture even when some assets have no live price.
  const portfolioCurrentTotal = investments.reduce<number>((acc, inv) => {
    const qty = parseFloat(inv.position.quantity);
    const price = inv.type === 'TREASURY'
      ? (inv.currentValue !== null ? parseFloat(inv.currentValue) : null)
      : (inv.quote?.currentPrice ?? null);
    const avg = parseFloat(inv.position.averagePrice);
    const current = calculateCurrentTotal(qty, price);
    // Fall back to totalInvested when current price is unavailable
    return acc + (current !== null ? current : calculateTotalInvested(qty, avg));
  }, 0);

  const portfolioTotalInvested = investments.reduce((acc, inv) => {
    const qty = parseFloat(inv.position.quantity);
    const avg = parseFloat(inv.position.averagePrice);
    return acc + calculateTotalInvested(qty, avg);
  }, 0);

  function handleSort(key: SortKey): void {
    setSort((currentSort) => ({
      key,
      direction: currentSort.key === key && currentSort.direction === 'ascending'
        ? 'descending'
        : 'ascending',
    }));
  }

  const sortInvestments = (items: InvestmentListItem[]): InvestmentListItem[] => (
    sort.key === null
      ? items
      : [...items].sort((left, right) => compareInvestments(
        left,
        right,
        sort,
        portfolioCurrentTotal,
      ))
  );

  if (isLoading) {
    return (
      <>
      <div className="hidden rounded-md border md:block">
        <Table className="[&_th]:px-0.5 [&_td]:px-0.5">
          <TableHeader>
            <TableHeaderRow sort={sort} onSort={handleSort} />
          </TableHeader>
          <TableBody>
            {Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 16 }).map((_, j) => (
                  <TableCell key={j}>
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-3 md:hidden" aria-label="Loading investments">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm">
            <div className="h-5 w-28 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      </>
    );
  }

  if (investments.length === 0) {
    return (
      <>
      <div className="hidden rounded-md border md:block">
        <Table className="[&_th]:px-0.5 [&_td]:px-0.5">
          <TableHeader>
            <TableHeaderRow sort={sort} onSort={handleSort} />
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={16} className="py-12 text-center text-muted-foreground">
                No investments yet. Click "Add Investment" to get started.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <p className="py-10 text-center text-sm text-muted-foreground md:hidden">No investments yet. Click "Add Investment" to get started.</p>
      </>
    );
  }

  // Split investments into those with a position (has orders) and watchlist (no orders)
  const invested = sortInvestments(investments.filter((inv) => parseFloat(inv.position.quantity) > 0));
  const watchlist = sortInvestments(investments.filter((inv) => parseFloat(inv.position.quantity) === 0));

  return (
    <>
      <div className="hidden rounded-md border md:block">
        <Table className="[&_th]:px-0.5 [&_td]:px-0.5">
          <TableHeader>
            <TableHeaderRow sort={sort} onSort={handleSort} />
          </TableHeader>
          <TableBody>
            {invested.map((investment) => (
              <InvestmentRow
                key={investment.id}
                investment={investment}
                pricesLoading={pricesLoading}
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

      <div className="grid gap-3 md:hidden">
        {invested.map((investment) => (
          <MobileInvestmentCard
            key={investment.id}
            investment={investment}
            pricesLoading={pricesLoading}
            portfolioCurrentTotal={portfolioCurrentTotal}
            portfolioTotalInvested={portfolioTotalInvested}
            onAddOrder={onAddOrder}
            onArchive={onArchive}
            onTickerClick={onTickerClick}
          />
        ))}
      </div>

      <BuyPlanTable investments={investments} pricesLoading={pricesLoading} />

      {watchlist.length > 0 && (
        <section id="watchlist" className="mt-6 scroll-mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Watchlist</h2>
            <a href="#top" className="shrink-0 text-xs font-medium text-primary hover:underline">Back to top ↑</a>
          </div>
          <div className="hidden rounded-md border md:block">
            <Table className="[&_th]:px-0.5 [&_td]:px-0.5">
              <TableHeader>
                <TableHeaderRow sort={sort} onSort={handleSort} />
              </TableHeader>
              <TableBody>
                {watchlist.map((investment) => (
                  <InvestmentRow
                    key={investment.id}
                    investment={investment}
                    pricesLoading={pricesLoading}
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
          <div className="grid gap-3 md:hidden">
            {watchlist.map((investment) => (
              <MobileInvestmentCard
                key={investment.id}
                investment={investment}
                pricesLoading={pricesLoading}
                portfolioCurrentTotal={portfolioCurrentTotal}
                portfolioTotalInvested={portfolioTotalInvested}
                onAddOrder={onAddOrder}
                onArchive={onArchive}
                onTickerClick={onTickerClick}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** Read-only summary of intended purchases, based on editable target buy quantities. */
function BuyPlanTable({ investments, pricesLoading = false }: { investments: InvestmentListItem[]; pricesLoading?: boolean }): React.JSX.Element | null {
  const plannedBuys = investments
    .filter((investment) => investment.targetBuyQuantity !== null
      && Number.isFinite(Number(investment.targetBuyQuantity))
      && Number(investment.targetBuyQuantity) > 0)
    .map((investment) => {
      const currentPrice = investment.type === 'TREASURY'
        ? (investment.currentValue !== null ? parseFloat(investment.currentValue) : null)
        : (investment.quote?.currentPrice ?? null);
      const buyQuantity = Number(investment.targetBuyQuantity);

      return {
        investment,
        currentPrice,
        buyQuantity,
        buyValue: currentPrice !== null ? currentPrice * buyQuantity : null,
      };
    });

  if (plannedBuys.length === 0) return null;

  const hasMissingPrice = plannedBuys.some((buy) => buy.buyValue === null);
  const plannedPricesLoading = pricesLoading && plannedBuys.some(({ investment }) => investment.type === 'STOCK');
  const combinedValue = plannedBuys.reduce((total, buy) => total + (buy.buyValue ?? 0), 0);

  return (
    <section id="planned-buys" className="mt-6 scroll-mt-4" aria-labelledby="buy-plan-heading">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="buy-plan-heading" className="text-lg font-semibold">Planned Buys</h2>
        <a href="#top" className="shrink-0 text-xs font-medium text-primary hover:underline">Back to top ↑</a>
      </div>
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table className="min-w-[640px] [&_th]:px-2 [&_td]:px-2">
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead className="text-right">Price Now</TableHead>
              <TableHead className="text-right">Var %</TableHead>
              <TableHead className="text-right">Sell</TableHead>
              <TableHead className="text-right">Buy</TableHead>
              <TableHead className="text-right">Buy Qty</TableHead>
              <TableHead className="text-right">Total (Buy Qty × Price Now)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plannedBuys.map(({ investment, currentPrice, buyQuantity, buyValue }) => (
              <TableRow key={investment.id}>
                <TableCell className="font-medium">
                  {investment.type === 'TREASURY' && investment.treasuryProductName
                    ? investment.treasuryProductName
                    : investment.ticker}
                </TableCell>
                <TableCell className="text-right">
                  {plannedPricesLoading && investment.type === 'STOCK'
                    ? <span className="animate-pulse text-muted-foreground">Loading…</span>
                    : currentPrice !== null ? formatCurrency(currentPrice) : <span className="text-muted-foreground">N/A</span>}
                </TableCell>
                <TableCell className={`text-right ${investment.type === 'STOCK' && investment.quote ? profitColorClass(investment.quote.dailyChangePercent) : 'text-muted-foreground'}`}>
                  {investment.type === 'STOCK' && investment.quote
                    ? formatPercent(investment.quote.dailyChangePercent)
                    : '—'}
                </TableCell>
                <TableCell className="text-right">
                  {investment.targetSellPrice !== null
                    ? formatCurrency(parseFloat(investment.targetSellPrice))
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  {investment.targetBuyPrice !== null
                    ? formatCurrency(parseFloat(investment.targetBuyPrice))
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right">{formatQuantity(buyQuantity)}</TableCell>
                <TableCell className="text-right">
                  {plannedPricesLoading && investment.type === 'STOCK'
                    ? <span className="animate-pulse text-muted-foreground">Loading…</span>
                    : buyValue !== null ? formatCurrency(buyValue) : <span className="text-muted-foreground">N/A</span>}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={6} className="text-right font-semibold">
                Combined total{hasMissingPrice ? ' (partial)' : ''}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {plannedPricesLoading ? <span className="animate-pulse text-muted-foreground">Loading…</span> : formatCurrency(combinedValue)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-3 md:hidden">
        {plannedBuys.map(({ investment, currentPrice, buyQuantity, buyValue }) => (
          <article key={investment.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="break-words font-semibold">
              {investment.type === 'TREASURY' && investment.treasuryProductName
                ? investment.treasuryProductName
                : investment.ticker}
            </h3>
            {investment.sector && <p className="mt-0.5 text-xs text-muted-foreground">{investment.sector}</p>}
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 border-t pt-3">
              <MobileMetric label="Price now" value={plannedPricesLoading && investment.type === 'STOCK' ? 'Loading…' : currentPrice !== null ? formatCurrency(currentPrice) : 'N/A'} />
              <MobileMetric
                label="Daily variation"
                value={investment.type === 'STOCK' && investment.quote ? formatPercent(investment.quote.dailyChangePercent) : '—'}
                valueClassName={investment.type === 'STOCK' && investment.quote ? profitColorClass(investment.quote.dailyChangePercent) : ''}
              />
              <MobileMetric label="Target sell" value={investment.targetSellPrice !== null ? formatCurrency(Number(investment.targetSellPrice)) : '—'} />
              <MobileMetric label="Target buy" value={investment.targetBuyPrice !== null ? formatCurrency(Number(investment.targetBuyPrice)) : '—'} />
              <MobileMetric label="Buy quantity" value={formatQuantity(buyQuantity)} />
              <MobileMetric label="Estimated total" value={plannedPricesLoading && investment.type === 'STOCK' ? 'Loading…' : buyValue !== null ? formatCurrency(buyValue) : 'N/A'} />
            </div>
          </article>
        ))}
        <div className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3 text-sm font-semibold">
          <span>Combined total{hasMissingPrice ? ' (partial)' : ''}</span>
          <span className="tabular-nums">{plannedPricesLoading ? 'Loading…' : formatCurrency(combinedValue)}</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Information only. Edit planned buy quantities in the investment details above.</p>
    </section>
  );
}

interface TableHeaderRowProps {
  sort: SortState;
  onSort: (key: SortKey) => void;
}

interface SortableTableHeadProps {
  label: string;
  title?: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  className?: string;
}

function TableHeaderRow({ sort, onSort }: TableHeaderRowProps): React.JSX.Element {
  return (
    <TableRow>
      <SortableTableHead label="Ticker" sortKey="ticker" sort={sort} onSort={onSort} />
      <SortableTableHead label="Sector" sortKey="sector" sort={sort} onSort={onSort} />
      <SortableTableHead label="Qty" sortKey="quantity" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="Avg Price" sortKey="averagePrice" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="Price Now" sortKey="currentPrice" sort={sort} onSort={onSort} className="max-w-20 text-right whitespace-normal" />
      <SortableTableHead label="Var %" sortKey="dailyChangePercent" sort={sort} onSort={onSort} className="max-w-20 text-right whitespace-normal" />
      <SortableTableHead label="Sell" title="Target Sell" sortKey="targetSellPrice" sort={sort} onSort={onSort} className="max-w-20 text-right whitespace-normal" />
      <SortableTableHead label="Buy" title="Target Buy" sortKey="targetBuyPrice" sort={sort} onSort={onSort} className="max-w-20 text-right whitespace-normal" />
      <SortableTableHead label="Buy Qty" title="Target Buy Qty" sortKey="targetBuyQuantity" sort={sort} onSort={onSort} className="max-w-20 text-right whitespace-normal" />
      <SortableTableHead label="Total Invested" sortKey="totalInvested" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="Current Total" sortKey="currentTotal" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="Profit" sortKey="profit" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="Var %" title="Variation %" sortKey="totalVariation" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="%" title="Portfolio %" sortKey="portfolioWeight" sort={sort} onSort={onSort} className="text-right" />
      <TableHead className="text-right" title="Last comment or update">Comment Date</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </TableRow>
  );
}

function SortableTableHead({ label, title, sortKey, sort, onSort, className }: SortableTableHeadProps): React.JSX.Element {
  const isActive = sort.key === sortKey;
  const Icon = !isActive ? ArrowUpDown : sort.direction === 'ascending' ? ArrowUp : ArrowDown;
  const nextDirection = isActive && sort.direction === 'ascending' ? 'descending' : 'ascending';
  const accessibleLabel = title ?? label;

  return (
    <TableHead className={className} aria-sort={isActive ? sort.direction : 'none'}>
      <button
        type="button"
        className="inline-flex max-w-full cursor-pointer items-center gap-0.5 hover:text-foreground focus-visible:outline-none focus-visible:underline"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${accessibleLabel}, ${nextDirection}`}
        title={title}
      >
        <span className="max-w-full whitespace-normal text-center leading-tight">{label}</span>
        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      </button>
    </TableHead>
  );
}

function compareInvestments(
  left: InvestmentListItem,
  right: InvestmentListItem,
  sort: SortState,
  portfolioCurrentTotal: number,
): number {
  if (sort.key === null) return 0;

  const leftValue = getSortValue(left, sort.key, portfolioCurrentTotal);
  const rightValue = getSortValue(right, sort.key, portfolioCurrentTotal);

  if (leftValue === null) return rightValue === null ? 0 : 1;
  if (rightValue === null) return -1;

  let comparison: number;
  if (typeof leftValue === 'string' && typeof rightValue === 'string') {
    comparison = leftValue.localeCompare(rightValue, 'pt-BR', { sensitivity: 'base' });
  } else if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    comparison = leftValue - rightValue;
  } else {
    comparison = String(leftValue).localeCompare(String(rightValue), 'pt-BR', { sensitivity: 'base' });
  }

  return sort.direction === 'ascending' ? comparison : -comparison;
}

function getSortValue(
  investment: InvestmentListItem,
  sortKey: SortKey,
  portfolioCurrentTotal: number,
): number | string | null {
  const quantity = parseFloat(investment.position.quantity);
  const noOrders = quantity === 0;
  const averagePrice = parseFloat(investment.position.averagePrice);
  const currentPrice = investment.type === 'TREASURY'
    ? (investment.currentValue !== null ? parseFloat(investment.currentValue) : null)
    : (investment.quote?.currentPrice ?? null);
  const totalInvested = noOrders ? null : calculateTotalInvested(quantity, averagePrice);
  const currentTotal = noOrders ? null : calculateCurrentTotal(quantity, currentPrice);
  const profit = totalInvested === null ? null : calculateProfit(currentTotal, totalInvested);
  const totalVariation = totalInvested === null ? null : calculateTotalVariation(profit, totalInvested);
  const positionValue = currentTotal ?? totalInvested;
  const portfolioWeight = positionValue === null
    ? null
    : calculatePortfolioWeight(positionValue, portfolioCurrentTotal);

  switch (sortKey) {
    case 'ticker':
      return investment.type === 'TREASURY' && investment.treasuryProductName
        ? investment.treasuryProductName
        : investment.ticker;
    case 'sector': return investment.sector;
    case 'quantity': return noOrders ? null : quantity;
    case 'averagePrice': return noOrders || investment.type === 'TREASURY' ? null : averagePrice;
    case 'currentPrice': return currentPrice;
    case 'targetSellPrice': return investment.targetSellPrice === null ? null : parseFloat(investment.targetSellPrice);
    case 'targetBuyPrice': return investment.targetBuyPrice === null ? null : parseFloat(investment.targetBuyPrice);
    case 'targetBuyQuantity': return investment.targetBuyQuantity == null ? null : parseFloat(investment.targetBuyQuantity);
    case 'dailyChangePercent': return noOrders || investment.type === 'TREASURY' ? null : investment.quote?.dailyChangePercent ?? null;
    case 'totalInvested': return totalInvested;
    case 'currentTotal': return currentTotal;
    case 'profit': return profit;
    case 'totalVariation': return totalVariation;
    case 'portfolioWeight': return portfolioWeight;
  }
}

interface InvestmentRowProps {
  investment: InvestmentListItem;
  pricesLoading?: boolean;
  portfolioCurrentTotal: number;
  portfolioTotalInvested: number;
  onAddOrder: (investment: InvestmentListItem) => void;
  onArchive: (investment: InvestmentListItem) => void;
  onTickerClick: (id: string, ticker: string, sector: string | null, recommendation: number | null) => void;
}

/** Returns true when the investment has no orders (position quantity is "0.00000000"). */
function hasNoOrders(investment: InvestmentListItem): boolean {
  return parseFloat(investment.position.quantity) === 0;
}

function InvestmentRow({ investment, pricesLoading = false, portfolioCurrentTotal, portfolioTotalInvested, onAddOrder, onArchive, onTickerClick }: InvestmentRowProps): React.JSX.Element {
  const { mutate: saveTargetPrices, isPending: isSavingTargets } = useUpdateTargetPrices();
  const { mutate: saveCurrentValue, isPending: isSavingCurrentValue } = useUpdateCurrentValue();

  const isTreasury = investment.type === 'TREASURY';
  const quoteIsLoading = pricesLoading && !isTreasury;

  const quantity = parseFloat(investment.position.quantity);
  const averagePrice = parseFloat(investment.position.averagePrice);

  // For TREASURY: use manually-entered currentValue as the current price.
  // For STOCK: use live Yahoo Finance quote.
  const currentPrice = isTreasury
    ? (investment.currentValue !== null ? parseFloat(investment.currentValue) : null)
    : (investment.quote?.currentPrice ?? null);

  const dailyChangePercent = investment.quote?.dailyChangePercent ?? null;

  // Parse stored target prices (Decimal strings) to numbers for comparison/display
  const targetSellPrice = investment.targetSellPrice !== null
    ? parseFloat(investment.targetSellPrice)
    : null;
  const targetBuyPrice = investment.targetBuyPrice !== null
    ? parseFloat(investment.targetBuyPrice)
    : null;
  const targetBuyQuantity = investment.targetBuyQuantity != null
    ? parseFloat(investment.targetBuyQuantity)
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

  // Market-dependent fields are null when price is unavailable
  const currentTotal = noOrders ? 0 : calculateCurrentTotal(quantity, currentPrice);
  const profit = noOrders ? 0 : calculateProfit(currentTotal, totalInvested);
  const totalVariation = noOrders ? 0 : calculateTotalVariation(profit, totalInvested);

  // Portfolio weight: hybrid basis — use currentTotal if available, else totalInvested.
  // This matches the portfolioCurrentTotal calculation at the table level, ensuring
  // every investment contributes to its share even without a live/manual price.
  const positionValueForWeight = noOrders
    ? 0
    : (currentTotal !== null ? currentTotal : totalInvested);

  const portfolioWeight = noOrders
    ? null
    : calculatePortfolioWeight(positionValueForWeight, portfolioCurrentTotal);
  const portfolioWeightByInvested = noOrders
    ? null
    : calculatePortfolioWeightByInvested(totalInvested, portfolioTotalInvested);

  const portfolioWeightTooltip =
    portfolioWeightByInvested !== null
      ? `By invested: ${formatPortfolioPercent(portfolioWeightByInvested)}`
      : 'By invested: N/A';

  // Display label: treasury uses the full product name; stocks use the ticker
  const displayLabel = isTreasury && investment.treasuryProductName
    ? investment.treasuryProductName
    : investment.ticker;

  function handleSellTargetSave(value: number | null): void {
    saveTargetPrices(
      { id: investment.id, targetSellPrice: value },
      { onError: () => toast.error(`Failed to save Target Sell for ${displayLabel}`) },
    );
  }

  function handleBuyTargetSave(value: number | null): void {
    saveTargetPrices(
      { id: investment.id, targetBuyPrice: value },
      { onError: () => toast.error(`Failed to save Target Buy for ${displayLabel}`) },
    );
  }

  function handleBuyQuantitySave(value: number | null): void {
    saveTargetPrices(
      { id: investment.id, targetBuyQuantity: value },
      { onError: () => toast.error(`Failed to save Target Buy Quantity for ${displayLabel}`) },
    );
  }

  function handleCurrentValueSave(value: number | null): void {
    saveCurrentValue(
      { id: investment.id, currentValue: value },
      { onError: () => toast.error(`Failed to save Current Value for ${displayLabel}`) },
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        <button
          onClick={() => onTickerClick(investment.id, investment.ticker, investment.sector, investment.recommendation)}
          aria-label={`View comments for ${displayLabel}`}
          className={`cursor-pointer underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline text-left ${getRecommendationColorClass(investment.recommendation)}`}
        >
          {displayLabel}
        </button>
      </TableCell>
      <TableCell>
        {investment.sector
          ? <span
              className="inline-block max-w-24 truncate align-bottom"
              title={investment.sector}
            >{investment.sector}</span>
          : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-right">
        {noOrders
          ? <span className="text-muted-foreground">—</span>
          : <span title={formatQuantity(quantity)}>{formatCompactQuantity(quantity)}</span>}
      </TableCell>
      <TableCell className="text-right">
        {noOrders
          ? <span className="text-muted-foreground">—</span>
          : isTreasury
          ? <span className="text-muted-foreground">—</span>
          : formatCurrency(averagePrice)}
      </TableCell>
      {/* Current Price: editable for TREASURY, read-only live quote for STOCK */}
      <TableCell className="text-right">
        {isTreasury ? (
          <EditablePriceCell
            value={investment.currentValue !== null ? parseFloat(investment.currentValue) : null}
            onSave={handleCurrentValueSave}
            isPending={isSavingCurrentValue}
            ariaLabel={`Edit Current Value for ${displayLabel}`}
          />
        ) : quoteIsLoading ? (
          <span className="animate-pulse text-muted-foreground">Loading…</span>
        ) : currentPrice !== null ? (
          formatCurrency(currentPrice)
        ) : (
          <span className="text-muted-foreground">N/A</span>
        )}
      </TableCell>
      {/* Daily Change %: only meaningful for STOCK */}
      <TableCell className={`text-right ${!isTreasury && !noOrders && dailyChangePercent !== null ? profitColorClass(dailyChangePercent) : 'text-muted-foreground'}`}>
        {isTreasury || noOrders
          ? '—'
          : quoteIsLoading
            ? <span className="animate-pulse text-muted-foreground">Loading…</span>
            : dailyChangePercent !== null ? formatPercent(dailyChangePercent) : 'N/A'}
      </TableCell>
      <TableCell className={`text-right ${sellTargetClass}`}>
        <EditablePriceCell
          value={targetSellPrice}
          onSave={handleSellTargetSave}
          isPending={isSavingTargets}
          className={sellTargetClass}
          ariaLabel={`Edit Target Sell price for ${displayLabel}`}
        />
      </TableCell>
      <TableCell className={`text-right ${buyTargetClass}`}>
        <EditablePriceCell
          value={targetBuyPrice}
          onSave={handleBuyTargetSave}
          isPending={isSavingTargets}
          className={buyTargetClass}
          ariaLabel={`Edit Target Buy price for ${displayLabel}`}
        />
      </TableCell>
      <TableCell className="text-right">
        <EditablePriceCell
          value={targetBuyQuantity}
          onSave={handleBuyQuantitySave}
          isPending={isSavingTargets}
          formatValue={formatQuantity}
          step="0.00000001"
          title="Click to set intended buy quantity"
          ariaLabel={`Edit Target Buy Quantity for ${displayLabel}`}
        />
      </TableCell>
      <TableCell className="text-right">
        {noOrders
          ? <span className="text-muted-foreground">—</span>
          : formatCurrency(totalInvested)}
      </TableCell>
      <TableCell className="text-right">
        {noOrders
          ? <span className="text-muted-foreground">—</span>
          : quoteIsLoading
            ? <span className="animate-pulse text-muted-foreground">Loading…</span>
            : currentTotal !== null
            ? formatCurrency(currentTotal)
            : <span className="text-muted-foreground">N/A</span>}
      </TableCell>
      <TableCell className={`text-right ${noOrders ? 'text-muted-foreground' : profitColorClass(profit)}`}>
        {noOrders
          ? '—'
          : quoteIsLoading
            ? <span className="animate-pulse text-muted-foreground">Loading…</span>
            : profit !== null
            ? formatCurrency(profit)
            : <span className="text-muted-foreground">N/A</span>}
      </TableCell>
      <TableCell className={`text-right ${noOrders ? 'text-muted-foreground' : profitColorClass(totalVariation)}`}>
        {noOrders
          ? '—'
          : quoteIsLoading
            ? <span className="animate-pulse text-muted-foreground">Loading…</span>
            : totalVariation !== null
            ? formatPercent(totalVariation)
            : <span className="text-muted-foreground">N/A</span>}
      </TableCell>
      <TableCell className="text-right">
        {noOrders ? (
          <span className="text-muted-foreground">—</span>
        ) : quoteIsLoading ? (
          <span className="animate-pulse text-muted-foreground">Loading…</span>
        ) : portfolioWeight !== null ? (
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
        <LatestCommentDate investmentId={investment.id} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => onAddOrder(investment)}
            aria-label={`Add order for ${displayLabel}`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-destructive hover:text-destructive"
            onClick={() => onArchive(investment)}
            aria-label={`Archive ${displayLabel}`}
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function MobileInvestmentCard({ investment, pricesLoading = false, portfolioCurrentTotal, onAddOrder, onArchive, onTickerClick }: InvestmentRowProps): React.JSX.Element {
  const { mutate: saveTargetPrices, isPending: isSavingTargets } = useUpdateTargetPrices();
  const { mutate: saveCurrentValue, isPending: isSavingCurrentValue } = useUpdateCurrentValue();
  const isTreasury = investment.type === 'TREASURY';
  const quoteIsLoading = pricesLoading && !isTreasury;
  const noOrders = hasNoOrders(investment);
  const quantity = parseFloat(investment.position.quantity);
  const averagePrice = parseFloat(investment.position.averagePrice);
  const currentPrice = isTreasury
    ? (investment.currentValue !== null ? parseFloat(investment.currentValue) : null)
    : (investment.quote?.currentPrice ?? null);
  const totalInvested = noOrders ? 0 : calculateTotalInvested(quantity, averagePrice);
  const currentTotal = noOrders ? 0 : calculateCurrentTotal(quantity, currentPrice);
  const profit = noOrders ? 0 : calculateProfit(currentTotal, totalInvested);
  const totalVariation = noOrders ? 0 : calculateTotalVariation(profit, totalInvested);
  const displayLabel = isTreasury && investment.treasuryProductName
    ? investment.treasuryProductName
    : investment.ticker;

  function saveTarget(field: 'targetSellPrice' | 'targetBuyPrice' | 'targetBuyQuantity', value: number | null): void {
    saveTargetPrices({ id: investment.id, [field]: value }, {
      onError: () => toast.error(`Failed to save ${field} for ${displayLabel}`),
    });
  }

  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={() => onTickerClick(investment.id, investment.ticker, investment.sector, investment.recommendation)}
              aria-label={`View comments for ${displayLabel}`}
              className={`max-w-full break-words text-left text-base font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline ${getRecommendationColorClass(investment.recommendation)}`}
            >
              {displayLabel}
            </button>
            <span
              title="Daily variation"
              className={`shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-semibold tabular-nums ${investment.type === 'STOCK' && investment.quote ? profitColorClass(investment.quote.dailyChangePercent) : 'text-muted-foreground'}`}
            >
              {quoteIsLoading
                ? 'Loading…'
                : investment.type === 'STOCK' && investment.quote
                  ? formatPercent(investment.quote.dailyChangePercent)
                  : '—'}
            </span>
          </div>
          {investment.sector && <p className="mt-0.5 text-xs text-muted-foreground">{investment.sector}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="outline" size="sm" className="h-9 px-2.5" onClick={() => onAddOrder(investment)} aria-label={`Add order for ${displayLabel}`}>
            <PlusCircle className="mr-1.5 h-4 w-4" /> Order
          </Button>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive hover:text-destructive" onClick={() => onArchive(investment)} aria-label={`Archive ${displayLabel}`}>
            <Archive className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t pt-3">
        <MobileMetric label="Quantity" value={noOrders ? '—' : formatQuantity(quantity)} />
        <MobileMetric label="Price now" value={quoteIsLoading ? 'Loading…' : currentPrice === null ? 'N/A' : formatCurrency(currentPrice)} />
        <MobileMetric label="Position value" value={noOrders ? '—' : quoteIsLoading ? 'Loading…' : currentTotal !== null ? formatCurrency(currentTotal) : 'N/A'} />
        <MobileMetric
          label="Profit"
          value={noOrders ? '—' : quoteIsLoading ? 'Loading…' : profit !== null ? formatCurrency(profit) : 'N/A'}
          valueClassName={noOrders || quoteIsLoading ? '' : profitColorClass(profit)}
        />
      </div>

      <details className="mt-3 border-t pt-2 text-sm">
        <summary className="cursor-pointer py-1 font-medium text-primary">More details and targets</summary>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-3">
          <MobileMetric label="Average price" value={noOrders || isTreasury ? '—' : formatCurrency(averagePrice)} />
          <MobileMetric label="Variation" value={noOrders ? '—' : quoteIsLoading ? 'Loading…' : totalVariation !== null ? formatPercent(totalVariation) : 'N/A'} valueClassName={noOrders || quoteIsLoading ? '' : profitColorClass(totalVariation)} />
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Target sell</span>
            <EditablePriceCell
              value={investment.targetSellPrice !== null ? Number(investment.targetSellPrice) : null}
              onSave={(value) => saveTarget('targetSellPrice', value)}
              isPending={isSavingTargets}
              ariaLabel={`Edit Target Sell price for ${displayLabel}`}
            />
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Target buy</span>
            <EditablePriceCell
              value={investment.targetBuyPrice !== null ? Number(investment.targetBuyPrice) : null}
              onSave={(value) => saveTarget('targetBuyPrice', value)}
              isPending={isSavingTargets}
              ariaLabel={`Edit Target Buy price for ${displayLabel}`}
            />
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Target buy quantity</span>
            <EditablePriceCell
              value={investment.targetBuyQuantity !== null ? Number(investment.targetBuyQuantity) : null}
              onSave={(value) => saveTarget('targetBuyQuantity', value)}
              isPending={isSavingTargets}
              formatValue={formatQuantity}
              step="0.00000001"
              ariaLabel={`Edit Target Buy Quantity for ${displayLabel}`}
            />
          </div>
          {isTreasury && (
            <div className="grid gap-1">
              <span className="text-xs text-muted-foreground">Current value</span>
              <EditablePriceCell
                value={investment.currentValue !== null ? Number(investment.currentValue) : null}
                onSave={(value) => saveCurrentValue({ id: investment.id, currentValue: value }, { onError: () => toast.error(`Failed to save Current Value for ${displayLabel}`) })}
                isPending={isSavingCurrentValue}
                ariaLabel={`Edit Current Value for ${displayLabel}`}
              />
            </div>
          )}
          <div className="col-span-2 flex items-center justify-between border-t pt-2">
            <span className="text-xs text-muted-foreground">Portfolio weight</span>
            <span>{noOrders ? '—' : quoteIsLoading ? 'Loading…' : formatPortfolioPercent(calculatePortfolioWeight(currentTotal ?? totalInvested, portfolioCurrentTotal) ?? 0)}</span>
          </div>
          <div className="col-span-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Last comment</span>
            <LatestCommentDate investmentId={investment.id} />
          </div>
        </div>
      </details>
    </article>
  );
}

function MobileMetric({ label, value, valueClassName = '' }: { label: string; value: string; valueClassName?: string }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 truncate font-semibold tabular-nums ${valueClassName}`} title={value}>{value}</div>
    </div>
  );
}

function LatestCommentDate({ investmentId }: { investmentId: string }): React.JSX.Element {
  const { data: comments, isLoading, isError } = useComments(investmentId);
  if (isLoading) return <span className="text-muted-foreground">…</span>;
  if (isError) return <span className="text-muted-foreground" title="Could not load comments">—</span>;
  if (!comments?.length) return <span className="text-muted-foreground">—</span>;

  const latestTimestamp = Math.max(...comments.flatMap((comment) => [
    new Date(comment.createdAt).getTime(),
    new Date(comment.updatedAt).getTime(),
  ]));
  const latestDate = new Date(latestTimestamp);
  return (
    <span title={latestDate.toLocaleString('pt-BR')}>
      {latestDate.toLocaleDateString('pt-BR')}
    </span>
  );
}
