import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PortfolioAllocationDialog } from '@/components/PortfolioAllocationDialog';
import type { InvestmentListItem } from '@/types/investment';

function makeInvestment(
  id: string,
  ticker: string,
  sector: string | null,
  overrides: Partial<InvestmentListItem> = {},
): InvestmentListItem {
  return {
    id,
    ticker,
    type: 'STOCK',
    sector,
    archivedAt: null,
    targetSellPrice: null,
    targetBuyPrice: null,
    targetBuyQuantity: null,
    targetSellQuantity: null,
    recommendation: null,
    currentValue: null,
    treasuryProductId: null,
    treasuryProductName: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    position: { quantity: '1', averagePrice: '10' },
    quote: { currentPrice: 10, dailyChangePercent: 0 },
    ...overrides,
  };
}

describe('PortfolioAllocationDialog', () => {
  it('groups FII strategy sectors and shows their percentages within the selected group', async () => {
    const user = userEvent.setup();
    render(<PortfolioAllocationDialog investments={[
      makeInvestment('1', 'BRICK11', 'FIIs — Tijolo'),
      makeInvestment('2', 'PAPER11', 'FIIs — Papel'),
      makeInvestment('3', 'MIXED11', 'FIIs — Misto'),
    ]} />);

    await user.click(screen.getByRole('button', { name: 'Portfolio Allocation' }));
    expect(screen.getByRole('list', { name: 'Current allocation by asset type' })).toHaveTextContent('R$ 30,00');

    await user.click(screen.getByRole('button', { name: /FIIs:.*Show sector breakdown/ }));

    const sectors = screen.getByRole('list', { name: 'FIIs sector allocation' });
    expect(within(sectors).getByText('FIIs — Tijolo')).toBeInTheDocument();
    expect(within(sectors).getByText('FIIs — Papel')).toBeInTheDocument();
    expect(within(sectors).getByText('FIIs — Misto')).toBeInTheDocument();
    expect(sectors).toHaveTextContent('33.3%');

    await user.click(screen.getByRole('button', { name: /FIIs:.*Show sector breakdown/ }));
    expect(screen.queryByRole('heading', { name: 'FIIs sectors' })).not.toBeInTheDocument();
  });

  it('uses a distinct highlight color for Stocks', async () => {
    const user = userEvent.setup();
    render(<PortfolioAllocationDialog investments={[
      makeInvestment('1', 'ACME3', 'Industry'),
    ]} />);

    await user.click(screen.getByRole('button', { name: 'Portfolio Allocation' }));

    const currentAllocation = screen.getByRole('list', { name: 'Current allocation by asset type' });
    expect(within(currentAllocation).getByRole('img', { name: 'Stocks color' })).toHaveStyle({ backgroundColor: 'rgb(8, 145, 178)' });
  });

  it('projects planned buys and caps planned sells at the current position', async () => {
    const user = userEvent.setup();
    render(<PortfolioAllocationDialog investments={[
      makeInvestment('1', 'ACME3', 'Industry', {
        targetBuyQuantity: '5',
      }),
      makeInvestment('2', 'TESOURO', 'Renda Fixa', {
        type: 'TREASURY',
        currentValue: '10',
        quote: null,
        targetSellQuantity: '20',
      }),
    ]} />);

    await user.click(screen.getByRole('button', { name: 'Portfolio Allocation' }));

    const projected = screen.getByRole('list', { name: 'Projected allocation by asset type' });
    const stockValue = within(projected).getByRole('button', { name: /Stocks projected value.*change \+R\$\s*50,00/ });
    expect(stockValue).toHaveClass('text-emerald-700');
    expect(within(projected).getByText('100.0%')).toBeInTheDocument();
    await user.click(stockValue);
    const stockImpacts = screen.getByRole('list', { name: 'Stocks changed tickers' });
    expect(within(stockImpacts).getByText('ACME3')).toBeInTheDocument();
    expect(stockImpacts).toHaveTextContent('+R$ 50,00');

    const fixedIncomeValue = within(projected).getByRole('button', { name: /Renda Fixa projected value.*change −R\$\s*10,00/ });
    expect(fixedIncomeValue).toHaveClass('text-red-700');
    await user.click(fixedIncomeValue);
    const fixedIncomeImpacts = screen.getByRole('list', { name: 'Renda Fixa changed tickers' });
    expect(within(fixedIncomeImpacts).getByText('TESOURO')).toBeInTheDocument();
    expect(fixedIncomeImpacts).toHaveTextContent('−R$ 10,00');
  });

  it('shows a partial projection when a planned operation has no current price', async () => {
    const user = userEvent.setup();
    render(<PortfolioAllocationDialog investments={[
      makeInvestment('1', 'NOQUOTE3', 'Industry', {
        quote: null,
        position: { quantity: '2', averagePrice: '10' },
        targetBuyQuantity: '1',
      }),
    ]} />);

    await user.click(screen.getByRole('button', { name: 'Portfolio Allocation' }));

    expect(screen.getByRole('status')).toHaveTextContent('Partial projection');
    expect(screen.getByRole('list', { name: 'Projected allocation by asset type' })).toHaveTextContent('R$ 20,00');
  });

  it('shows empty states for current and projected allocation when there is no value', async () => {
    const user = userEvent.setup();
    render(<PortfolioAllocationDialog investments={[
      makeInvestment('1', 'EMPTY3', 'Industry', {
        position: { quantity: '0', averagePrice: '0' },
        quote: { currentPrice: 10, dailyChangePercent: 0 },
      }),
    ]} />);

    await user.click(screen.getByRole('button', { name: 'Portfolio Allocation' }));

    expect(screen.getByText('No investment value available.')).toBeInTheDocument();
    expect(screen.getByText('No investment value available after planned buys and sells.')).toBeInTheDocument();
  });
});
