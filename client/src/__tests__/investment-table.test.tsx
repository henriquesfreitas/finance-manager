import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InvestmentListItem } from '@/types/investment';
import { InvestmentTable } from '@/components/InvestmentTable';

vi.mock('@/components/EditablePriceCell', () => ({
  EditablePriceCell: ({ value }: { value: number | null }) => <span>{value ?? '—'}</span>,
}));

vi.mock('@/hooks/useInvestments', () => ({
  useUpdateTargetPrices: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateCurrentValue: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useComments', () => ({
  useComments: () => ({ data: [], isLoading: false, isError: false }),
  useLatestCommentDates: () => ({ data: {}, isLoading: false, isError: false }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueries: ({ queries }: { queries: Array<{ enabled: boolean; queryKey: unknown[] }> }) => queries.map(({ enabled, queryKey }) => ({
    data: enabled ? queryKey[1] === 'no-history' ? [] : [
      { date: '2025-10-24T20:00:00.000Z', price: 10 },
      { date: '2026-09-24T20:00:00.000Z', price: 12 },
      { date: '2026-10-17T20:00:00.000Z', price: 11 },
      { date: '2026-10-24T20:00:00.000Z', price: 13 },
    ] : undefined,
    isLoading: false,
    isError: false,
  })),
}));

afterEach(() => cleanup());

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

function renderInvestmentTable(investments: InvestmentListItem[], pricesLoading = false): void {
  render(
    <InvestmentTable
      investments={investments}
      isLoading={false}
      pricesLoading={pricesLoading}
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
    expect(screen.getAllByRole('button', { name: 'View comments for ACME3' })[0]).toHaveClass('text-red-600');
    expect(screen.getAllByRole('button', { name: 'View comments for MISSING3' })[0]).toHaveClass('text-green-600');
    expect(within(table).queryByText('NOQTY3')).not.toBeInTheDocument();
    expect(within(table).getAllByText(/R\$\s*20,00/)).toHaveLength(2);
    expect(within(table).getAllByText('N/A')).toHaveLength(2);
    expect(within(table).getByText(/Combined total\s*\(partial\)/)).toBeInTheDocument();
    expect(within(section).getByText('Information only. Edit planned buy quantities in the investment details above.')).toBeInTheDocument();
  });

  it('does not render the summary when there are no positive buy quantities', () => {
    renderInvestmentTable([
      makeInvestment({ targetBuyQuantity: '0' }),
      makeInvestment({ id: 'investment-2', targetBuyQuantity: null }),
    ]);

    expect(screen.queryByRole('region', { name: 'Planned Buys' })).not.toBeInTheDocument();
  });

  it('keeps tickers and stored fields visible while quote-dependent values load', () => {
    renderInvestmentTable([
      makeInvestment({
        position: { quantity: '2', averagePrice: '10' },
        quote: null,
      }),
    ], true);

    const table = screen.getAllByRole('table')[0]!;
    const row = within(table).getAllByRole('row').find((candidate) => candidate.textContent?.includes('ACME3'));
    expect(row).toBeDefined();
    expect(within(row!).getByText('Industry')).toBeInTheDocument();
    expect(within(row!).getAllByText('2').length).toBeGreaterThan(0);
    expect(within(row!).getByText('R$ 10,00')).toBeInTheDocument();
    expect(within(row!).getAllByText('Loading…').length).toBeGreaterThan(0);
  });
});

describe('InvestmentTable mobile table view', () => {
  it('toggles to a compact table with held and watchlist investments and only the requested columns', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const { container } = render(
      <InvestmentTable
        investments={[
          makeInvestment({
            position: { quantity: '2', averagePrice: '10' },
            quote: { currentPrice: 13, dailyChangePercent: 1.25 },
          }),
          makeInvestment({
            id: 'watchlist-1',
            ticker: 'WATCH3',
            position: { quantity: '0', averagePrice: '0' },
          }),
        ]}
        isLoading={false}
        onAddOrder={vi.fn()}
        onArchive={vi.fn()}
        onTickerClick={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Show all tickers as table' }));

    const mobileView = container.querySelector('#mobile-investment-view');
    expect(mobileView).not.toBeNull();
    const table = within(mobileView as HTMLElement).getByRole('table');
    expect(within(table).getByRole('button', { name: 'View comments for ACME3' })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'View comments for WATCH3' })).toBeInTheDocument();
    expect(within(table).getAllByRole('columnheader')[0]).toHaveClass('sticky', 'left-0', 'z-20', 'bg-card');
    expect(within(table).getByRole('button', { name: 'View comments for ACME3' }).closest('td'))
      .toHaveClass('sticky', 'left-0', 'z-10', 'bg-card');
    expect(within(table).getByText('R$ 20,00')).toBeInTheDocument();
    expect(within(table).getByText('R$ 26,00')).toBeInTheDocument();
    expect(within(table).getByText('R$ 6,00')).toBeInTheDocument();
    expect(within(table).getByText('+30.00%')).toBeInTheDocument();
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim())).toEqual([
      'Ticker',
      'Sector',
      'Qty',
      'Avg Price',
      'Price Now',
      'Var %',
      'Total Invested',
      'Current Total',
      'Profit',
      'Var %',
      '%',
    ]);
    expect(within(table).queryByRole('columnheader', { name: /target sell/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show as cards' })).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Show as cards' }));
    expect(screen.getByRole('button', { name: 'Show all tickers as table' })).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('InvestmentTable portfolio daily variation', () => {
  it('shows the aggregate daily amount and percent and opens the history modal', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    renderInvestmentTable([makeInvestment({
      position: { quantity: '2', averagePrice: '10' },
      quote: { currentPrice: 13, dailyChangePercent: 1 },
    })]);

    const summary = screen.getAllByRole('region', { name: /portfolio variation/i })[0]!;
    expect(within(summary).getByText('R$ 0,26')).toBeInTheDocument();
    expect(within(summary).getByText('+1.00%')).toBeInTheDocument();

    const desktopRows = within(screen.getAllByRole('table')[0]!).getAllByRole('row');
    expect(desktopRows[0]?.textContent).toContain('Today’s portfolio variation');
    expect(desktopRows[1]?.textContent).toContain('Ticker');

    await user.click(within(summary).getByRole('button', { name: /Amount/ }));
    const dialog = screen.getByRole('dialog', { name: 'Portfolio variation' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('7 days')).toBeInTheDocument();
    expect(within(dialog).getByText('30 days')).toBeInTheDocument();
    expect(within(dialog).getByText('365 days')).toBeInTheDocument();
    expect(within(dialog).getByText('R$ 4,00')).toBeInTheDocument();
    expect(within(dialog).getByText('R$ 2,00')).toBeInTheDocument();
    expect(within(dialog).getByText('R$ 6,00')).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: /Portfolio value chart/ })).toBeInTheDocument();
    expect(within(dialog).getByText(/Uses current quantities for 1 of 1 stock holdings with available history/)).toBeInTheDocument();
  });

  it('falls back to the latest historical daily variation when a held stock quote is missing', () => {
    renderInvestmentTable([makeInvestment({
      position: { quantity: '2', averagePrice: '10' },
      quote: null,
    })]);

    const summary = screen.getByRole('region', { name: /Latest available variation/ });
    expect(within(summary).getByText('R$ 4,00')).toBeInTheDocument();
    expect(within(summary).getByText('+18.18%')).toBeInTheDocument();
    expect(within(summary).getByText(/Latest available variation/)).toBeInTheDocument();
  });

  it('does not show the portfolio daily summary for portfolios without stock positions', () => {
    renderInvestmentTable([makeInvestment({
      type: 'TREASURY',
      position: { quantity: '2', averagePrice: '10' },
      quote: null,
      currentValue: '12',
    })]);

    expect(screen.queryByRole('region', { name: /portfolio variation/i })).not.toBeInTheDocument();
  });

  it('shows a no-history state when historical prices are unavailable', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    renderInvestmentTable([makeInvestment({
      id: 'no-history',
      position: { quantity: '2', averagePrice: '10' },
    })]);

    const summary = screen.getAllByRole('region', { name: /portfolio variation/i })[0]!;
    await user.click(within(summary).getAllByRole('button')[0]!);
    expect(await screen.findByText('No portfolio price history available.')).toBeInTheDocument();
  });

  it('shows history for available stocks when another stock has no historical prices', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    renderInvestmentTable([
      makeInvestment({
        position: { quantity: '2', averagePrice: '10' },
      }),
      makeInvestment({
        id: 'no-history',
        ticker: 'NOHISTORY3',
        position: { quantity: '3', averagePrice: '20' },
      }),
    ]);

    const summary = screen.getAllByRole('region', { name: /portfolio variation/i })[0]!;
    await user.click(within(summary).getAllByRole('button')[0]!);

    const dialog = screen.getByRole('dialog', { name: 'Portfolio variation' });
    expect(within(dialog).getByRole('img', { name: /Portfolio value chart/ })).toBeInTheDocument();
    expect(within(dialog).getByText(/Uses current quantities for 1 of 2 stock holdings with available history/)).toBeInTheDocument();
    expect(within(dialog).queryByText('No portfolio price history available.')).not.toBeInTheDocument();
  });
});
