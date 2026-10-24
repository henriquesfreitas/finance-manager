import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PortfolioAllocationDialog } from '@/components/PortfolioAllocationDialog';
import type { InvestmentListItem } from '@/types/investment';

function makeFii(id: string, ticker: string, sector: string): InvestmentListItem {
  return {
    id,
    ticker,
    type: 'STOCK',
    sector,
    archivedAt: null,
    targetSellPrice: null,
    targetBuyPrice: null,
    targetBuyQuantity: null,
    recommendation: null,
    currentValue: null,
    treasuryProductId: null,
    treasuryProductName: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    position: { quantity: '1', averagePrice: '10' },
    quote: { currentPrice: 10, dailyChangePercent: 0 },
  };
}

describe('PortfolioAllocationDialog FII grouping', () => {
  it('groups Tijolo, Papel, and Misto sectors together as FIIs', async () => {
    const user = userEvent.setup();
    render(<PortfolioAllocationDialog investments={[
      makeFii('1', 'BRICK11', 'FIIs — Tijolo'),
      makeFii('2', 'PAPER11', 'FIIs — Papel'),
      makeFii('3', 'MIXED11', 'FIIs — Misto'),
    ]} />);

    await user.click(screen.getByRole('button', { name: 'Portfolio Allocation' }));

    expect(screen.getByRole('list')).toHaveTextContent('FIIs');
    expect(screen.getByRole('list')).toHaveTextContent('R$ 30,00');
  });
});
