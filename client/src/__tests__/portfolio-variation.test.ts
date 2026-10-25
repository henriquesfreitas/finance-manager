import { describe, expect, it } from 'vitest';
import {
  buildPortfolioValueSeries,
  calculateDailyPortfolioVariation,
  calculateHistoricalPortfolioVariation,
  calculateLatestHistoricalPortfolioVariation,
} from '@/lib/portfolio-variation';

describe('calculateDailyPortfolioVariation', () => {
  it('weights the daily percent by the previous-close portfolio value', () => {
    const variation = calculateDailyPortfolioVariation([
      { quantity: 10, currentPrice: 110, dailyChangePercent: 10 },
      { quantity: 5, currentPrice: 50, dailyChangePercent: -5 },
    ]);

    expect(variation?.amount).toBeCloseTo(100 + (250 - 250 / 0.95));
    expect(variation?.percent).toBeCloseTo((variation!.amount / (1000 + 250 / 0.95)) * 100);
  });

  it('returns a zero variation at break-even', () => {
    expect(calculateDailyPortfolioVariation([
      { quantity: 2, currentPrice: 25, dailyChangePercent: 0 },
    ])).toMatchObject({ amount: 0, percent: 0, includedHoldings: 1, totalHoldings: 1 });
  });

  it('returns a negative amount and percent for a daily loss', () => {
    expect(calculateDailyPortfolioVariation([
      { quantity: 3, currentPrice: 9, dailyChangePercent: -10 },
    ])).toMatchObject({ amount: -3, percent: -10, includedHoldings: 1, totalHoldings: 1 });
  });

  it('uses available live quotes and historical closes for holdings without quotes', () => {
    const variation = calculateDailyPortfolioVariation([
      { quantity: 1, currentPrice: 110, dailyChangePercent: 10 },
      {
        quantity: 1,
        currentPrice: null,
        dailyChangePercent: null,
        history: [
          { date: '2026-10-22T20:00:00.000Z', price: 20 },
          { date: '2026-10-23T20:00:00.000Z', price: 22 },
        ],
      },
    ]);

    expect(variation?.amount).toBeCloseTo(12);
    expect(variation?.percent).toBeCloseTo(10);
    expect(variation).toMatchObject({ includedHoldings: 2, totalHoldings: 2, historicalHoldings: 1 });
  });

  it('returns unavailable when there are no holdings or a required quote is missing', () => {
    expect(calculateDailyPortfolioVariation([])).toBeNull();
    expect(calculateDailyPortfolioVariation([
      { quantity: 2, currentPrice: Number.NaN, dailyChangePercent: 1 },
    ])).toBeNull();
  });
});

describe('historical portfolio variation', () => {
  it('builds a shared portfolio series and carries forward the last close', () => {
    const series = buildPortfolioValueSeries([
      {
        quantity: 2,
        history: [
          { date: '2026-10-20T20:00:00.000Z', price: 10 },
          { date: '2026-10-22T20:00:00.000Z', price: 12 },
        ],
      },
      {
        quantity: 1,
        history: [
          { date: '2026-10-21T20:00:00.000Z', price: 20 },
          { date: '2026-10-22T20:00:00.000Z', price: 22 },
        ],
      },
    ]);

    expect(series).toEqual([
      { date: '2026-10-21', value: 40 },
      { date: '2026-10-22', value: 46 },
    ]);
  });

  it('compares the latest portfolio value with the last close before the calendar cutoff', () => {
    const series = [
      { date: '2025-10-24', value: 100 },
      { date: '2026-09-24', value: 120 },
      { date: '2026-10-17', value: 110 },
      { date: '2026-10-24', value: 130 },
    ];

    expect(calculateHistoricalPortfolioVariation(series, 7)).toEqual({ amount: 20, percent: (20 / 110) * 100 });
    expect(calculateHistoricalPortfolioVariation(series, 30)).toEqual({ amount: 10, percent: (10 / 120) * 100 });
    expect(calculateHistoricalPortfolioVariation(series, 365)).toEqual({ amount: 30, percent: 30 });
    expect(calculateHistoricalPortfolioVariation([{ date: '2026-10-24', value: 100 }], 7)).toBeNull();
  });

  it('uses the latest two available closes for the fallback daily variation', () => {
    expect(calculateLatestHistoricalPortfolioVariation([
      { date: '2026-10-22', value: 100 },
      { date: '2026-10-23', value: 110 },
    ])).toEqual({ amount: 10, percent: 10 });
    expect(calculateLatestHistoricalPortfolioVariation([{ date: '2026-10-23', value: 110 }])).toBeNull();
  });
});
