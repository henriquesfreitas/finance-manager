import { describe, expect, it } from 'vitest';
import { findReachedTargetAlerts } from '../services/target-price-alert-service.js';

describe('findReachedTargetAlerts', () => {
  it('detects reached sell and buy targets and ignores unreached targets', () => {
    const alerts = findReachedTargetAlerts([
      { ticker: 'SELL3', type: 'STOCK', currentValue: null, targetSellPrice: 20, targetBuyPrice: null },
      { ticker: 'BUY3', type: 'STOCK', currentValue: null, targetSellPrice: null, targetBuyPrice: 10 },
      { ticker: 'WAIT3', type: 'STOCK', currentValue: null, targetSellPrice: 20, targetBuyPrice: 10 },
    ], new Map([
      ['SELL3', { currentPrice: 21, dailyChangePercent: 1 }],
      ['BUY3', { currentPrice: 9, dailyChangePercent: -1 }],
      ['WAIT3', { currentPrice: 15, dailyChangePercent: 0 }],
    ]));

    expect(alerts).toEqual([
      { ticker: 'SELL3', currentPrice: 21, sellTarget: 20, buyTarget: null, reached: ['SELL'] },
      { ticker: 'BUY3', currentPrice: 9, sellTarget: null, buyTarget: 10, reached: ['BUY'] },
    ]);
  });

  it('uses the current value for Treasury products and skips unavailable prices', () => {
    const alerts = findReachedTargetAlerts([
      { ticker: 'TESOURO', type: 'TREASURY', currentValue: 100, targetSellPrice: 100, targetBuyPrice: null },
      { ticker: 'NODATA', type: 'STOCK', currentValue: null, targetSellPrice: 10, targetBuyPrice: null },
    ], new Map([['NODATA', null]]));

    expect(alerts).toEqual([
      { ticker: 'TESOURO', currentPrice: 100, sellTarget: 100, buyTarget: null, reached: ['SELL'] },
    ]);
  });
});
