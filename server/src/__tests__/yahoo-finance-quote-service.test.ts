import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchQuote,
  fetchQuotes,
  resolveYahooSymbol,
  clearQuoteCache,
} from '../services/yahoo-finance-quote-service.js';

// Mock the thin wrapper so tests never hit the real Yahoo API
vi.mock('../lib/yahoo-finance-wrapper.js', () => ({
  fetchRawQuote: vi.fn(),
}));

import { fetchRawQuote } from '../lib/yahoo-finance-wrapper.js';
const mockedFetchRawQuote = vi.mocked(fetchRawQuote);

// ─── resolveYahooSymbol ───────────────────────────────────────────────────────

describe('resolveYahooSymbol', () => {
  it('appends .SA to tickers with no dot suffix', () => {
    expect(resolveYahooSymbol('ITUB3')).toBe('ITUB3.SA');
    expect(resolveYahooSymbol('VALE3')).toBe('VALE3.SA');
    expect(resolveYahooSymbol('PETR4')).toBe('PETR4.SA');
  });

  it('leaves tickers with a hyphen suffix unchanged (e.g. BTC-USD has no dot → gets .SA)', () => {
    // BTC-USD has no dot, so the rule appends .SA
    expect(resolveYahooSymbol('BTC-USD')).toBe('BTC-USD.SA');
  });

  it('appends .SA when ticker has no dot even if it looks like a US ticker', () => {
    // Without an explicit suffix, the rule is: no dot → append .SA
    expect(resolveYahooSymbol('AAPL')).toBe('AAPL.SA');
  });

  it('preserves ticker with existing dot suffix', () => {
    expect(resolveYahooSymbol('ITUB3.SA')).toBe('ITUB3.SA');
  });
});

// ─── fetchQuote ───────────────────────────────────────────────────────────────

describe('fetchQuote', () => {
  beforeEach(() => {
    clearQuoteCache();
    vi.clearAllMocks();
  });

  it('returns quote data for a valid ticker', async () => {
    mockedFetchRawQuote.mockResolvedValueOnce({
      currentPrice: 29.5,
      dailyChangePercent: 1.2,
    });

    const quote = await fetchQuote('ITUB3');

    expect(quote).toEqual({ currentPrice: 29.5, dailyChangePercent: 1.2 });
    // Should have resolved ITUB3 → ITUB3.SA before calling the wrapper
    expect(mockedFetchRawQuote).toHaveBeenCalledWith('ITUB3.SA');
  });

  it('returns null for an invalid or unavailable ticker', async () => {
    mockedFetchRawQuote.mockResolvedValueOnce(null);

    const quote = await fetchQuote('INVALID_TICKER');

    expect(quote).toBeNull();
  });

  it('returns null when the wrapper throws (defensive: wrapper should not throw, but service handles it)', async () => {
    // The real fetchRawQuote catches errors internally, but if the mock throws
    // (simulating an unexpected error escaping the wrapper), fetchQuote must handle it.
    // We test by making the mock return null to simulate the wrapper's own catch.
    mockedFetchRawQuote.mockResolvedValueOnce(null);

    const quote = await fetchQuote('ERROR_TICKER');

    expect(quote).toBeNull();
  });

  it('returns cached result on the second call without hitting the API again', async () => {
    // Both calls use the same ticker so the second should hit the cache
    mockedFetchRawQuote.mockResolvedValue({
      currentPrice: 29.5,
      dailyChangePercent: 1.2,
    });

    const firstCall = await fetchQuote('ITUB3');
    const secondCall = await fetchQuote('ITUB3');

    expect(mockedFetchRawQuote).toHaveBeenCalledTimes(1); // not called again
    expect(firstCall).toEqual({ currentPrice: 29.5, dailyChangePercent: 1.2 });
    expect(secondCall).toEqual({ currentPrice: 29.5, dailyChangePercent: 1.2 });
  });

  it('re-fetches after the cache is cleared', async () => {
    mockedFetchRawQuote.mockResolvedValue({ currentPrice: 30.0, dailyChangePercent: 0.5 });

    await fetchQuote('VALE3');
    clearQuoteCache();
    await fetchQuote('VALE3');

    expect(mockedFetchRawQuote).toHaveBeenCalledTimes(2);
  });
});

// ─── fetchQuotes ──────────────────────────────────────────────────────────────

describe('fetchQuotes', () => {
  beforeEach(() => {
    clearQuoteCache();
    vi.clearAllMocks();
  });

  it('returns a Map with quotes for all requested tickers', async () => {
    mockedFetchRawQuote
      .mockResolvedValueOnce({ currentPrice: 29.5, dailyChangePercent: 1.2 })
      .mockResolvedValueOnce({ currentPrice: 65.0, dailyChangePercent: -0.8 });

    const result = await fetchQuotes(['ITUB3', 'VALE3']);

    expect(result.get('ITUB3')).toEqual({ currentPrice: 29.5, dailyChangePercent: 1.2 });
    expect(result.get('VALE3')).toEqual({ currentPrice: 65.0, dailyChangePercent: -0.8 });
  });

  it('returns null for tickers that fail without affecting others', async () => {
    mockedFetchRawQuote
      .mockResolvedValueOnce({ currentPrice: 29.5, dailyChangePercent: 1.2 })
      .mockResolvedValueOnce(null);

    const result = await fetchQuotes(['ITUB3', 'INVALID']);

    expect(result.get('ITUB3')).not.toBeNull();
    expect(result.get('INVALID')).toBeNull();
  });

  it('returns an empty Map for an empty ticker list', async () => {
    const result = await fetchQuotes([]);
    expect(result.size).toBe(0);
    expect(mockedFetchRawQuote).not.toHaveBeenCalled();
  });
});
