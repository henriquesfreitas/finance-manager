import { fetchRawQuote } from '../lib/yahoo-finance-wrapper.js';
import type { MarketQuote } from '../types/investment.js';

/** Cached entry: value + expiry timestamp (ms). */
interface CacheEntry {
  value: MarketQuote | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Module-level cache — lives for the process lifetime.
// Using a plain Map is sufficient for a single-process dev/prod setup.
const quoteCache = new Map<string, CacheEntry>();

/**
 * Returns the Yahoo Finance ticker symbol for a given user-provided ticker.
 * Rule: if the ticker has no dot suffix, append ".SA" (Brazilian B3 stocks).
 * Tickers that already carry a suffix (e.g. "BTC-USD", "AAPL") are used as-is.
 *
 * @example resolveYahooSymbol('ITUB3')  → 'ITUB3.SA'
 * @example resolveYahooSymbol('BTC-USD') → 'BTC-USD'
 */
export function resolveYahooSymbol(ticker: string): string {
  return ticker.includes('.') ? ticker : `${ticker}.SA`;
}

/**
 * Fetches a single quote with 5-minute in-memory cache.
 * Returns null on network failure or invalid ticker.
 *
 * @example
 *   const quote = await fetchQuote('ITUB3');
 *   // { currentPrice: 29.50, dailyChangePercent: 1.2 } | null
 */
export async function fetchQuote(ticker: string): Promise<MarketQuote | null> {
  const symbol = resolveYahooSymbol(ticker);
  const cached = quoteCache.get(symbol);

  if (cached !== undefined && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  const quote = await fetchRawQuote(symbol);
  quoteCache.set(symbol, { value: quote, expiresAt: Date.now() + CACHE_TTL_MS });
  return quote;
}

/**
 * Batch-fetches quotes for multiple tickers concurrently.
 * Individual failures don't affect other tickers — each returns null independently.
 *
 * @example
 *   const quotes = await fetchQuotes(['ITUB3', 'VALE3']);
 *   // Map { 'ITUB3' => { currentPrice: 29.5, ... }, 'VALE3' => null }
 */
export async function fetchQuotes(tickers: string[]): Promise<Map<string, MarketQuote | null>> {
  const results = await Promise.all(
    tickers.map(async (ticker) => {
      const quote = await fetchQuote(ticker);
      return [ticker, quote] as const;
    }),
  );
  return new Map(results);
}

/** Exposed for testing: clears the in-memory cache. */
export function clearQuoteCache(): void {
  quoteCache.clear();
}
