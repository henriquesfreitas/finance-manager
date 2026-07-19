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
