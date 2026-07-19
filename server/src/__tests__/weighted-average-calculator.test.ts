import { describe, it, expect } from 'vitest';
import { createWeightedAverageCalculator } from '../services/weighted-average-calculator.js';
import type { OrderEntry } from '../services/weighted-average-calculator.js';

const calculator = createWeightedAverageCalculator();

describe('weighted-average-calculator', () => {
  // ─── Empty / single order ─────────────────────────────────────────────────

  it('returns zero position when there are no orders', () => {
    const result = calculator.computePosition([]);
    expect(result).toEqual({ quantity: 0, averagePrice: 0 });
  });

  it('returns the order price as average for a single BUY', () => {
    const orders: OrderEntry[] = [{ type: 'BUY', quantity: 100, price: 28.35 }];
    const result = calculator.computePosition(orders);
    expect(result.quantity).toBe(100);
    expect(result.averagePrice).toBe(28.35);
  });

  // ─── Multiple BUYs (weighted average) ─────────────────────────────────────

  it('computes weighted average for two BUYs at different prices', () => {
    const orders: OrderEntry[] = [
      { type: 'BUY', quantity: 100, price: 10 },
      { type: 'BUY', quantity: 50, price: 20 },
    ];
    const result = calculator.computePosition(orders);
    // (100*10 + 50*20) / 150 = 2000/150 = 13.33333333
    expect(result.quantity).toBe(150);
    expect(result.averagePrice).toBe(13.33333333);
  });

  it('computes weighted average for three BUYs', () => {
    const orders: OrderEntry[] = [
      { type: 'BUY', quantity: 100, price: 10 },
      { type: 'BUY', quantity: 100, price: 20 },
      { type: 'BUY', quantity: 100, price: 30 },
    ];
    const result = calculator.computePosition(orders);
    // (100*10 + 100*20 + 100*30) / 300 = 6000/300 = 20
    expect(result.quantity).toBe(300);
    expect(result.averagePrice).toBe(20);
  });

  // ─── SELL orders ──────────────────────────────────────────────────────────

  it('reduces quantity on SELL without changing average price', () => {
    const orders: OrderEntry[] = [
      { type: 'BUY', quantity: 100, price: 10 },
      { type: 'SELL', quantity: 30, price: 15 },
    ];
    const result = calculator.computePosition(orders);
    expect(result.quantity).toBe(70);
    expect(result.averagePrice).toBe(10);
  });

  it('resets average price to zero when selling entire position', () => {
    const orders: OrderEntry[] = [
      { type: 'BUY', quantity: 100, price: 25 },
      { type: 'SELL', quantity: 100, price: 30 },
    ];
    const result = calculator.computePosition(orders);
    expect(result.quantity).toBe(0);
    expect(result.averagePrice).toBe(0);
  });

  it('new BUY after full SELL sets average to the new price', () => {
    const orders: OrderEntry[] = [
      { type: 'BUY', quantity: 100, price: 10 },
      { type: 'SELL', quantity: 100, price: 15 },
      { type: 'BUY', quantity: 50, price: 20 },
    ];
    const result = calculator.computePosition(orders);
    expect(result.quantity).toBe(50);
    expect(result.averagePrice).toBe(20);
  });

  // ─── BONUS orders ─────────────────────────────────────────────────────────

  it('treats BONUS the same as BUY (increases position at given price)', () => {
    const orders: OrderEntry[] = [
      { type: 'BUY', quantity: 100, price: 10 },
      { type: 'BONUS', quantity: 20, price: 10 },
    ];
    const result = calculator.computePosition(orders);
    // (100*10 + 20*10) / 120 = 1200/120 = 10
    expect(result.quantity).toBe(120);
    expect(result.averagePrice).toBe(10);
  });

  it('BONUS at different price adjusts weighted average', () => {
    const orders: OrderEntry[] = [
      { type: 'BUY', quantity: 100, price: 10 },
      { type: 'BONUS', quantity: 100, price: 0.01 },
    ];
    const result = calculator.computePosition(orders);
    // (100*10 + 100*0.01) / 200 = 1001/200 = 5.005
    expect(result.quantity).toBe(200);
    expect(result.averagePrice).toBe(5.005);
  });

  // ─── SPLIT orders ─────────────────────────────────────────────────────────

  it('multiplies quantity and divides average price on SPLIT (2:1)', () => {
    const orders: OrderEntry[] = [
      { type: 'BUY', quantity: 100, price: 40 },
      { type: 'SPLIT', quantity: 2, price: 0 },
    ];
    const result = calculator.computePosition(orders);
    // 100 * 2 = 200 quantity, 40 / 2 = 20 average
    expect(result.quantity).toBe(200);
    expect(result.averagePrice).toBe(20);
  });

  it('handles SPLIT with factor 4 (4:1 split)', () => {
    const orders: OrderEntry[] = [
      { type: 'BUY', quantity: 50, price: 100 },
      { type: 'SPLIT', quantity: 4, price: 0 },
    ];
    const result = calculator.computePosition(orders);
    expect(result.quantity).toBe(200);
    expect(result.averagePrice).toBe(25);
  });

  it('SPLIT on zero position is a no-op', () => {
    const orders: OrderEntry[] = [
      { type: 'BUY', quantity: 100, price: 10 },
      { type: 'SELL', quantity: 100, price: 15 },
      { type: 'SPLIT', quantity: 2, price: 0 },
    ];
    const result = calculator.computePosition(orders);
    expect(result.quantity).toBe(0);
    expect(result.averagePrice).toBe(0);
  });

  // ─── Complex mixed scenarios ──────────────────────────────────────────────

  it('handles a realistic mixed order history', () => {
    const orders: OrderEntry[] = [
      { type: 'BUY', quantity: 100, price: 28 },
      { type: 'BUY', quantity: 50, price: 30 },
      { type: 'SELL', quantity: 30, price: 35 },
      { type: 'BONUS', quantity: 10, price: 28 },
      { type: 'SPLIT', quantity: 2, price: 0 },
    ];
    const result = calculator.computePosition(orders);

    // After BUYs: qty=150, avg=(100*28+50*30)/150 = 4300/150 = 28.66666667
    // After SELL(30): qty=120, avg=28.66666667 (unchanged)
    // After BONUS(10@28): qty=130, avg=(120*28.66666667+10*28)/130 = 3720/130 = 28.61538462
    // After SPLIT(2): qty=260, avg=28.61538462/2 = 14.30769231
    expect(result.quantity).toBe(260);
    expect(result.averagePrice).toBeCloseTo(14.30769231, 7);
  });

  // ─── Rounding precision ───────────────────────────────────────────────────

  it('rounds to 8 decimal places', () => {
    const orders: OrderEntry[] = [
      { type: 'BUY', quantity: 3, price: 10 },
      { type: 'BUY', quantity: 7, price: 3 },
    ];
    const result = calculator.computePosition(orders);
    // (3*10 + 7*3) / 10 = 51/10 = 5.1
    expect(result.quantity).toBe(10);
    expect(result.averagePrice).toBe(5.1);
  });

  it('rounds repeating decimals to 8 places', () => {
    const orders: OrderEntry[] = [
      { type: 'BUY', quantity: 1, price: 10 },
      { type: 'BUY', quantity: 2, price: 20 },
    ];
    const result = calculator.computePosition(orders);
    // (1*10 + 2*20) / 3 = 50/3 = 16.66666667 (rounded)
    expect(result.averagePrice).toBe(16.66666667);
  });
});
