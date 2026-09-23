import type { AssetType, MarketQuote } from '../types/investment.js';

export interface TargetPriceCandidate {
  ticker: string;
  type: AssetType;
  currentValue: number | null;
  targetSellPrice: number | null;
  targetBuyPrice: number | null;
}

export interface ReachedTargetAlert {
  ticker: string;
  currentPrice: number;
  sellTarget: number | null;
  buyTarget: number | null;
  reached: Array<'SELL' | 'BUY'>;
}

/** Finds active investments whose latest price has reached a configured target. */
export function findReachedTargetAlerts(
  investments: TargetPriceCandidate[],
  quotes: ReadonlyMap<string, MarketQuote | null>,
): ReachedTargetAlert[] {
  const alerts: ReachedTargetAlert[] = [];

  for (const investment of investments) {
    const currentPrice = investment.type === 'TREASURY'
      ? investment.currentValue
      : (quotes.get(investment.ticker)?.currentPrice ?? null);

    if (currentPrice === null || !Number.isFinite(currentPrice)) continue;

    const reached: Array<'SELL' | 'BUY'> = [];
    if (investment.targetSellPrice !== null && currentPrice >= investment.targetSellPrice) {
      reached.push('SELL');
    }
    if (investment.targetBuyPrice !== null && currentPrice <= investment.targetBuyPrice) {
      reached.push('BUY');
    }

    if (reached.length > 0) {
      alerts.push({
        ticker: investment.ticker,
        currentPrice,
        sellTarget: investment.targetSellPrice,
        buyTarget: investment.targetBuyPrice,
        reached,
      });
    }
  }

  return alerts;
}
