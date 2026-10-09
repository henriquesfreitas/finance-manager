import YahooFinance from 'yahoo-finance2';
import type { MarketQuote } from '../types/investment.js';

/**
 * Thin wrapper around yahoo-finance2.
 * Isolated here so the rest of the app never imports yahoo-finance2 directly —
 * tests can mock this module instead of the third-party package.
 *
 * yahoo-finance2 v4 changed the API: the default export is now a class.
 * Must instantiate with `new YahooFinance()` before calling methods.
 *
 * @example
 *   const quote = await fetchRawQuote('ITUB3.SA');
 */
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export async function fetchRawQuote(
  symbol: string,
): Promise<Pick<MarketQuote, 'currentPrice' | 'dailyChangePercent'> | null> {
  try {
    const result = await yf.quote(symbol);

    const price = result.regularMarketPrice;
    const change = result.regularMarketChangePercent;

    if (price == null || change == null) return null;

    return { currentPrice: price, dailyChangePercent: change };
  } catch {
    // Any network / invalid-ticker error → return null (graceful degradation)
    return null;
  }
}

export interface HistoricalPricePoint {
  date: string;
  price: number;
}

export type PriceHistoryRange = '1D' | '5D' | '1M' | '6M' | 'YTD' | '1Y' | '5Y' | 'Max';

/** Fetches historical prices at a granularity suited to the selected period. */
export async function fetchRawPriceHistory(
  symbol: string,
  range: PriceHistoryRange = '1Y',
): Promise<HistoricalPricePoint[]> {
  try {
    const now = new Date();
    const period1 = new Date(now);
    const daysByRange: Partial<Record<PriceHistoryRange, number>> = {
      '1D': 1, '5D': 5, '1M': 30, '6M': 182, '1Y': 365, '5Y': 1825,
    };
    if (range === 'YTD') period1.setMonth(0, 1);
    else if (range === 'Max') period1.setFullYear(1970, 0, 1);
    else period1.setDate(period1.getDate() - (daysByRange[range] ?? 365));
    const interval = range === '1D' ? '5m'
      : range === '5D' ? '15m'
        : range === '5Y' ? '1wk'
          : range === 'Max' ? '1mo' : '1d';
    const result = await yf.chart(symbol, {
      period1,
      interval,
    });
    return result.quotes
      .filter((point) => point.close !== null)
      .map((point) => ({ date: point.date.toISOString(), price: point.close! }));
  } catch {
    return [];
  }
}
