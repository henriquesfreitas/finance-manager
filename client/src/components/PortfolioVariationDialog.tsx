import React from 'react';
import { useQueries } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchInvestmentPriceHistory } from '@/services/investment-api-client';
import type { InvestmentListItem } from '@/types/investment';
import {
  buildPortfolioValueSeries,
  calculateHistoricalPortfolioVariation,
  type PortfolioValuePoint,
} from '@/lib/portfolio-variation';

interface PortfolioVariationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investments: InvestmentListItem[];
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function variationClass(value: number): string {
  if (value > 0) return 'text-green-600 dark:text-green-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-foreground';
}

export function PortfolioVariationDialog({
  open,
  onOpenChange,
  investments,
}: PortfolioVariationDialogProps): React.JSX.Element {
  const holdings = investments.filter((investment) => investment.type === 'STOCK'
    && Number(investment.position.quantity) > 0);
  const histories = useQueries({
    queries: holdings.map((investment) => ({
      queryKey: ['investments', investment.id, 'price-history', '1Y'],
      queryFn: () => fetchInvestmentPriceHistory(investment.id, '1Y'),
      enabled: open,
      staleTime: 1000 * 60 * 5,
    })),
  });

  const isLoading = open && histories.some((query) => query.isLoading);
  const availableHoldings = holdings.flatMap((investment, index) => {
    const history = histories[index]?.data;
    const usableHistory = history?.filter((point) => Number.isFinite(point.price)
      && point.price > 0
      && Number.isFinite(Date.parse(point.date)));
    return usableHistory && usableHistory.length >= 2
      ? [{ quantity: Number(investment.position.quantity), history: usableHistory }]
      : [];
  });
  const hasRequestFailures = histories.some((query) => query.isError)
    && availableHoldings.length === 0;
  const series = !isLoading && !hasRequestFailures
    ? buildPortfolioValueSeries(availableHoldings)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Portfolio variation</DialogTitle>
        </DialogHeader>
        {holdings.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No stock holdings to show.</p>
        ) : isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading price history…</p>
        ) : hasRequestFailures ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Could not load portfolio price history.</p>
        ) : series.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No portfolio price history available.</p>
        ) : (
          <VariationContent series={series} includedHoldings={availableHoldings.length} totalHoldings={holdings.length} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function VariationContent({
  series,
  includedHoldings,
  totalHoldings,
}: {
  series: PortfolioValuePoint[];
  includedHoldings: number;
  totalHoldings: number;
}): React.JSX.Element {
  const periods = [
    { label: '7 days', days: 7 },
    { label: '30 days', days: 30 },
    { label: '365 days', days: 365 },
  ];
  const variations = periods.map((period) => ({
    ...period,
    variation: calculateHistoricalPortfolioVariation(series, period.days),
  }));
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) * 0.05 || 1;
  const chartMin = min - span * 0.08;
  const chartMax = max + span * 0.08;
  const width = 700;
  const height = 220;
  const plot = { left: 58, right: width - 12, top: 12, bottom: height - 30 };
  const coordinates = series.map((point, index) => ({
    x: plot.left + (index / Math.max(series.length - 1, 1)) * (plot.right - plot.left),
    y: plot.bottom - ((point.value - chartMin) / (chartMax - chartMin)) * (plot.bottom - plot.top),
  }));
  const line = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const formatDate = (value: string): string => new Date(`${value}T00:00:00.000Z`).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {variations.map(({ label, variation }) => (
          <div key={label} className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">{label}</p>
            {variation ? (
              <>
                <p className={`mt-1 font-semibold tabular-nums ${variationClass(variation.amount)}`}>{formatCurrency(variation.amount)}</p>
                <p className={`text-sm tabular-nums ${variationClass(variation.percent)}`}>{formatPercent(variation.percent)}</p>
              </>
            ) : <p className="mt-1 text-sm text-muted-foreground">N/A</p>}
          </div>
        ))}
      </div>
      <section aria-label="Daily portfolio variation chart">
        <p className="mb-2 text-sm font-medium">Portfolio value over the last 365 days</p>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-56 w-full rounded-lg bg-[#202228] text-white"
          role="img"
          aria-label={`Portfolio value chart from ${formatDate(series[0]!.date)} to ${formatDate(series[series.length - 1]!.date)}`}
        >
          {[0, 1, 2, 3, 4].map((tick) => {
            const value = chartMin + ((chartMax - chartMin) * tick) / 4;
            const y = plot.bottom - (tick / 4) * (plot.bottom - plot.top);
            return (
              <g key={tick}>
                <line x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="white" strokeOpacity="0.12" />
                <text x="4" y={y + 4} fill="#a1a1aa" fontSize="11">{value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</text>
              </g>
            );
          })}
          <path d={line} fill="none" stroke="#78c995" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          <text x={plot.left} y={height - 7} fill="#a1a1aa" fontSize="11">{formatDate(series[0]!.date)}</text>
          <text x={plot.right} y={height - 7} fill="#a1a1aa" fontSize="11" textAnchor="end">{formatDate(series[series.length - 1]!.date)}</text>
        </svg>
      </section>
      <p className="text-xs text-muted-foreground">
        Uses current quantities for {includedHoldings} of {totalHoldings} stock holdings with available history. Treasury holdings are excluded.
      </p>
    </div>
  );
}
