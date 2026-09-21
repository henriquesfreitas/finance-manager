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

interface InvestmentTableProps {
  investments: InvestmentListItem[];
  isLoading: boolean;
  onAddOrder: (investment: InvestmentListItem) => void;
  onArchive: (investment: InvestmentListItem) => void;
  onTickerClick: (id: string, ticker: string, sector: string | null) => void;
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableHeaderRow sort={sort} onSort={handleSort} />
          </TableHeader>
          <TableBody>
            {Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 15 }).map((_, j) => (
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
            <TableHeaderRow sort={sort} onSort={handleSort} />
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={15} className="py-12 text-center text-muted-foreground">
                No investments yet. Click "Add Investment" to get started.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  // Split investments into those with a position (has orders) and watchlist (no orders)
  const invested = sortInvestments(investments.filter((inv) => parseFloat(inv.position.quantity) > 0));
  const watchlist = sortInvestments(investments.filter((inv) => parseFloat(inv.position.quantity) === 0));

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableHeaderRow sort={sort} onSort={handleSort} />
          </TableHeader>
          <TableBody>
            {invested.map((investment) => (
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

      {watchlist.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-lg font-semibold">Watchlist</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableHeaderRow sort={sort} onSort={handleSort} />
              </TableHeader>
              <TableBody>
                {watchlist.map((investment) => (
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
        </>
      )}
    </>
  );
}

interface TableHeaderRowProps {
  sort: SortState;
  onSort: (key: SortKey) => void;
}

interface SortableTableHeadProps {
  label: string;
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
      <SortableTableHead label="Quantity" sortKey="quantity" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="Avg Price" sortKey="averagePrice" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="Current Price" sortKey="currentPrice" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="Target Sell" sortKey="targetSellPrice" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="Target Buy" sortKey="targetBuyPrice" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="Target Buy Qty" sortKey="targetBuyQuantity" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="Daily Change %" sortKey="dailyChangePercent" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="Total Invested" sortKey="totalInvested" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="Current Total" sortKey="currentTotal" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="Profit" sortKey="profit" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="Variation %" sortKey="totalVariation" sort={sort} onSort={onSort} className="text-right" />
      <SortableTableHead label="Portfolio %" sortKey="portfolioWeight" sort={sort} onSort={onSort} className="text-right" />
      <TableHead className="text-right">Actions</TableHead>
    </TableRow>
  );
}

function SortableTableHead({ label, sortKey, sort, onSort, className }: SortableTableHeadProps): React.JSX.Element {
  const isActive = sort.key === sortKey;
  const Icon = !isActive ? ArrowUpDown : sort.direction === 'ascending' ? ArrowUp : ArrowDown;
  const nextDirection = isActive && sort.direction === 'ascending' ? 'descending' : 'ascending';

  return (
    <TableHead className={className} aria-sort={isActive ? sort.direction : 'none'}>
      <button
        type="button"
        className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:underline"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}, ${nextDirection}`}
      >
        {label}
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
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
  portfolioCurrentTotal: number;
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
  const { mutate: saveCurrentValue, isPending: isSavingCurrentValue } = useUpdateCurrentValue();

  const isTreasury = investment.type === 'TREASURY';

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
          className="cursor-pointer underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline text-left"
          onClick={() => onTickerClick(investment.id, investment.ticker, investment.sector)}
          aria-label={`View comments for ${displayLabel}`}
        >
          {displayLabel}
        </button>
      </TableCell>
      <TableCell>
        {investment.sector
          ? <span>{investment.sector}</span>
          : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-right">
        {noOrders
          ? <span className="text-muted-foreground">—</span>
          : formatQuantity(quantity)}
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
        ) : currentPrice !== null ? (
          formatCurrency(currentPrice)
        ) : (
          <span className="text-muted-foreground">N/A</span>
        )}
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
      {/* Daily Change %: only meaningful for STOCK */}
      <TableCell className={`text-right ${!isTreasury && !noOrders && dailyChangePercent !== null ? profitColorClass(dailyChangePercent) : 'text-muted-foreground'}`}>
        {isTreasury || noOrders
          ? '—'
          : dailyChangePercent !== null ? formatPercent(dailyChangePercent) : 'N/A'}
      </TableCell>
      <TableCell className="text-right">
        {noOrders
          ? <span className="text-muted-foreground">—</span>
          : formatCurrency(totalInvested)}
      </TableCell>
      <TableCell className="text-right">
        {noOrders
          ? <span className="text-muted-foreground">—</span>
          : currentTotal !== null
            ? formatCurrency(currentTotal)
            : <span className="text-muted-foreground">N/A</span>}
      </TableCell>
      <TableCell className={`text-right ${noOrders ? 'text-muted-foreground' : profitColorClass(profit)}`}>
        {noOrders
          ? '—'
          : profit !== null
            ? formatCurrency(profit)
            : <span className="text-muted-foreground">N/A</span>}
      </TableCell>
      <TableCell className={`text-right ${noOrders ? 'text-muted-foreground' : profitColorClass(totalVariation)}`}>
        {noOrders
          ? '—'
          : totalVariation !== null
            ? formatPercent(totalVariation)
            : <span className="text-muted-foreground">N/A</span>}
      </TableCell>
      <TableCell className="text-right">
        {noOrders ? (
          <span className="text-muted-foreground">—</span>
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
