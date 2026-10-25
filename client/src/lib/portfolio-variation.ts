import type { HistoricalPricePoint } from '@/services/investment-api-client';

export interface DailyPortfolioHolding {
  quantity: number;
  currentPrice: number | null;
  dailyChangePercent: number | null;
  history?: readonly HistoricalPricePoint[] | undefined;
}

export interface PortfolioVariation {
  amount: number;
  percent: number;
}

export interface DailyPortfolioVariation extends PortfolioVariation {
  includedHoldings: number;
  totalHoldings: number;
  historicalHoldings: number;
}

export interface HistoricalPortfolioHolding {
  quantity: number;
  history: readonly HistoricalPricePoint[];
}

export interface PortfolioValuePoint {
  date: string;
  value: number;
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Computes the held stocks' daily price change and weights its percent by prior-close value. */
export function calculateDailyPortfolioVariation(
  holdings: readonly DailyPortfolioHolding[],
): DailyPortfolioVariation | null {
  if (holdings.length === 0) return null;

  let currentValue = 0;
  let previousValue = 0;
  let includedHoldings = 0;
  let historicalHoldings = 0;
  for (const holding of holdings) {
    if (!isFinitePositive(holding.quantity)) continue;

    let currentPrice: number | null = null;
    let previousPrice: number | null = null;
    if (holding.currentPrice !== null
      && isFinitePositive(holding.currentPrice)
      && holding.dailyChangePercent !== null
      && Number.isFinite(holding.dailyChangePercent)
      && holding.dailyChangePercent > -100) {
      currentPrice = holding.currentPrice;
      previousPrice = currentPrice / (1 + holding.dailyChangePercent / 100);
    } else if (holding.history) {
      const history = [...holding.history]
        .filter((point) => isFinitePositive(point.price) && Number.isFinite(Date.parse(point.date)))
        .sort((left, right) => Date.parse(left.date) - Date.parse(right.date));
      if (history.length >= 2) {
        previousPrice = history[history.length - 2]!.price;
        currentPrice = history[history.length - 1]!.price;
        historicalHoldings += 1;
      }
    }

    if (currentPrice === null || previousPrice === null || !isFinitePositive(previousPrice)) continue;
    currentValue += holding.quantity * currentPrice;
    previousValue += holding.quantity * previousPrice;
    includedHoldings += 1;
  }

  if (!isFinitePositive(previousValue) || includedHoldings === 0) return null;
  const amount = currentValue - previousValue;
  return {
    amount,
    percent: (amount / previousValue) * 100,
    includedHoldings,
    totalHoldings: holdings.length,
    historicalHoldings,
  };
}

/** Aligns historical stock prices by trading date using each stock's most recent prior close. */
export function buildPortfolioValueSeries(
  holdings: readonly HistoricalPortfolioHolding[],
): PortfolioValuePoint[] {
  if (holdings.length === 0 || holdings.some((holding) => !isFinitePositive(holding.quantity) || holding.history.length === 0)) {
    return [];
  }

  const normalized = holdings.map((holding) => [...holding.history]
    .filter((point) => Number.isFinite(point.price) && point.price > 0 && Number.isFinite(Date.parse(point.date)))
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date)));
  if (normalized.some((history) => history.length === 0)) return [];

  const dateKeys = [...new Set(normalized.flatMap((history) => history.map((point) => point.date.slice(0, 10))))]
    .sort();
  const indices = normalized.map(() => 0);
  const latestPrices: Array<number | null> = normalized.map(() => null);
  const result: PortfolioValuePoint[] = [];

  for (const date of dateKeys) {
    let value = 0;
    normalized.forEach((history, index) => {
      while (indices[index]! < history.length && history[indices[index]!]!.date.slice(0, 10) <= date) {
        latestPrices[index] = history[indices[index]!]!.price;
        indices[index] = indices[index]! + 1;
      }
      const price = latestPrices[index];
      if (price != null) value += holdings[index]!.quantity * price;
    });
    if (latestPrices.every((price) => price !== null)) result.push({ date, value });
  }

  return result;
}

/** Measures end-of-period portfolio value against the last available close on or before its cutoff. */
export function calculateHistoricalPortfolioVariation(
  series: readonly PortfolioValuePoint[],
  days: number,
): PortfolioVariation | null {
  if (series.length < 2 || !Number.isInteger(days) || days <= 0) return null;

  const end = series[series.length - 1]!;
  const cutoff = new Date(`${end.date}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const start = [...series].reverse().find((point) => Date.parse(`${point.date}T00:00:00.000Z`) <= cutoff.getTime());
  if (!start || !isFinitePositive(start.value)) return null;

  const amount = end.value - start.value;
  return { amount, percent: (amount / start.value) * 100 };
}

/** Uses the latest two shared market closes when live quote data is unavailable. */
export function calculateLatestHistoricalPortfolioVariation(
  series: readonly PortfolioValuePoint[],
): PortfolioVariation | null {
  if (series.length < 2) return null;

  const previous = series[series.length - 2]!;
  const latest = series[series.length - 1]!;
  if (!isFinitePositive(previous.value) || !Number.isFinite(latest.value)) return null;

  const amount = latest.value - previous.value;
  return { amount, percent: (amount / previous.value) * 100 };
}
