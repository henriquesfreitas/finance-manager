import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InvestmentListItem } from '@/types/investment';
import { InvestmentTable } from '@/components/InvestmentTable';

vi.mock('@/components/EditablePriceCell', () => ({
  EditablePriceCell: ({ value }: { value: number | null }) => <span>{value ?? '—'}</span>,
}));

vi.mock('@/hooks/useInvestments', () => ({
  useUpdateTargetPrices: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateCurrentValue: () => ({ mutate: vi.fn(), isPending: false }),
}));

function makeInvestment(overrides: Partial<InvestmentListItem> = {}): InvestmentListItem {
  return {
    id: 'investment-1',
    ticker: 'ACME3',
    type: 'STOCK',
    sector: 'Industry',
    archivedAt: null,
    targetSellPrice: '15',
    targetBuyPrice: '9',
    targetBuyQuantity: '2',
    recommendation: 1,
    currentValue: null,
    treasuryProductId: null,
    treasuryProductName: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    position: { quantity: '0', averagePrice: '0' },
    quote: { currentPrice: 10, dailyChangePercent: 1.25 },
    ...overrides,
  };
}

function renderInvestmentTable(investments: InvestmentListItem[]): void {
  render(
    <InvestmentTable
      investments={investments}
      isLoading={false}
      onAddOrder={vi.fn()}
      onArchive={vi.fn()}
      onTickerClick={vi.fn()}
    />,
  );
}

describe('InvestmentTable planned buys', () => {
  it('shows only positive buy quantities and calculates row and combined values', () => {
    renderInvestmentTable([
      makeInvestment(),
      makeInvestment({
        id: 'investment-2',
        ticker: 'MISSING3',
        recommendation: 5,
        targetSellPrice: null,
        targetBuyPrice: null,
        targetBuyQuantity: '3',
        quote: null,
      }),
      makeInvestment({
        id: 'investment-3',
        ticker: 'NOQTY3',
        targetBuyQuantity: null,
      }),
    ]);

    const section = screen.getByRole('region', { name: 'Planned Buys' });
    const table = within(section).getByRole('table');

    expect(within(table).getByText('ACME3')).toBeInTheDocument();
    expect(within(table).getByText('MISSING3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View comments for ACME3' })).toHaveClass('text-red-600');
    expect(screen.getByRole('button', { name: 'View comments for MISSING3' })).toHaveClass('text-green-600');
    expect(within(table).queryByText('NOQTY3')).not.toBeInTheDocument();
    expect(within(table).getAllByText(/R\$\s*20,00/)).toHaveLength(2);
    expect(within(table).getAllByText('N/A')).toHaveLength(2);
    expect(within(table).getByText(/Combined total\s*\(partial\)/)).toBeInTheDocument();
    expect(within(section).getByText('Information only. Edit planned buy quantities in the table above.')).toBeInTheDocument();
  });

  it('does not render the summary when there are no positive buy quantities', () => {
    renderInvestmentTable([
      makeInvestment({ targetBuyQuantity: '0' }),
      makeInvestment({ id: 'investment-2', targetBuyQuantity: null }),
    ]);

    expect(screen.queryByRole('region', { name: 'Planned Buys' })).not.toBeInTheDocument();
  });
});
