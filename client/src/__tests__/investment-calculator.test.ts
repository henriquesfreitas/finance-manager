import { describe, it, expect } from 'vitest';
import {
  calculateTotalInvested,
  calculateCurrentTotal,
  calculateProfit,
  calculateTotalVariation,
  calculatePortfolioWeight,
  calculatePortfolioWeightByInvested,
} from '../lib/investment-calculator';

// ─── calculateTotalInvested ───────────────────────────────────────────────────

describe('calculateTotalInvested', () => {
  it('multiplies quantity by averagePrice', () => {
    expect(calculateTotalInvested(100, 28.35)).toBeCloseTo(2835);
  });

  it('returns 0 when quantity is 0', () => {
    expect(calculateTotalInvested(0, 28.35)).toBe(0);
  });

  it('returns 0 when averagePrice is 0', () => {
    expect(calculateTotalInvested(100, 0)).toBe(0);
  });

  it('handles fractional quantity', () => {
    expect(calculateTotalInvested(0.5, 100)).toBeCloseTo(50);
  });

  it('handles large values without overflow', () => {
    expect(calculateTotalInvested(1_000_000, 500)).toBe(500_000_000);
  });
});

// ─── calculateCurrentTotal ────────────────────────────────────────────────────

describe('calculateCurrentTotal', () => {
  it('returns quantity × currentPrice when price is available', () => {
    expect(calculateCurrentTotal(100, 29.5)).toBeCloseTo(2950);
  });

  it('returns null when currentPrice is null', () => {
    expect(calculateCurrentTotal(100, null)).toBeNull();
  });

  it('returns 0 when currentPrice is 0', () => {
    expect(calculateCurrentTotal(100, 0)).toBe(0);
  });
});

// ─── calculateProfit ─────────────────────────────────────────────────────────

describe('calculateProfit', () => {
  it('returns currentTotal - totalInvested for a gain', () => {
    expect(calculateProfit(2950, 2835)).toBeCloseTo(115);
  });

  it('returns a negative number for a loss', () => {
    expect(calculateProfit(2500, 2835)).toBeCloseTo(-335);
  });

  it('returns 0 for break-even', () => {
    expect(calculateProfit(2835, 2835)).toBe(0);
  });

  it('returns null when currentTotal is null', () => {
    expect(calculateProfit(null, 2835)).toBeNull();
  });
});

// ─── calculateTotalVariation ─────────────────────────────────────────────────

describe('calculateTotalVariation', () => {
  it('returns (profit / totalInvested) * 100', () => {
    // 115 / 2835 * 100 ≈ 4.056%
    expect(calculateTotalVariation(115, 2835)).toBeCloseTo(4.056, 1);
  });

  it('returns a negative percentage for a loss', () => {
    expect(calculateTotalVariation(-335, 2835)).toBeLessThan(0);
  });

  it('returns 0 for break-even', () => {
    expect(calculateTotalVariation(0, 2835)).toBe(0);
  });

  it('returns null when profit is null', () => {
    expect(calculateTotalVariation(null, 2835)).toBeNull();
  });

  it('returns null when totalInvested is 0 (division by zero guard)', () => {
    expect(calculateTotalVariation(100, 0)).toBeNull();
  });

  it('handles 100% gain correctly', () => {
    expect(calculateTotalVariation(1000, 1000)).toBe(100);
  });
});

// ─── calculatePortfolioWeight ─────────────────────────────────────────────────

describe('calculatePortfolioWeight', () => {
  it('returns (positionCurrentTotal / portfolioCurrentTotal) * 100', () => {
    expect(calculatePortfolioWeight(2950, 20000)).toBeCloseTo(14.75);
  });

  it('returns null when positionCurrentTotal is null (price unavailable)', () => {
    expect(calculatePortfolioWeight(null, 20000)).toBeNull();
  });

  it('returns null when portfolioCurrentTotal is null (any position missing price)', () => {
    expect(calculatePortfolioWeight(2950, null)).toBeNull();
  });

  it('returns null when portfolioCurrentTotal is 0 (division by zero guard)', () => {
    expect(calculatePortfolioWeight(2950, 0)).toBeNull();
  });

  it('returns 100 when position equals the entire portfolio', () => {
    expect(calculatePortfolioWeight(5000, 5000)).toBeCloseTo(100);
  });

  it('handles fractional weights correctly', () => {
    expect(calculatePortfolioWeight(1000, 3000)).toBeCloseTo(33.333, 2);
  });
});

// ─── calculatePortfolioWeightByInvested ──────────────────────────────────────

describe('calculatePortfolioWeightByInvested', () => {
  it('returns (positionTotalInvested / portfolioTotalInvested) * 100', () => {
    expect(calculatePortfolioWeightByInvested(2835, 18000)).toBeCloseTo(15.75);
  });

  it('returns null when portfolioTotalInvested is 0 (division by zero guard)', () => {
    expect(calculatePortfolioWeightByInvested(2835, 0)).toBeNull();
  });

  it('returns 100 when position is the entire invested portfolio', () => {
    expect(calculatePortfolioWeightByInvested(5000, 5000)).toBeCloseTo(100);
  });

  it('handles zero position correctly (new ticker with no orders)', () => {
    expect(calculatePortfolioWeightByInvested(0, 10000)).toBeCloseTo(0);
  });

  it('handles fractional weights correctly', () => {
    expect(calculatePortfolioWeightByInvested(1000, 3000)).toBeCloseTo(33.333, 2);
  });
});
