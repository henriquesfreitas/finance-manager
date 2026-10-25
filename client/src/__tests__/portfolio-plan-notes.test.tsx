import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortfolioPlanNotesDialog } from '@/components/PortfolioPlanNotesDialog';
import { InvestmentTable } from '@/components/InvestmentTable';
import type { InvestmentListItem } from '@/types/investment';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  query: {
    data: [{ id: 'note-1', content: 'Review allocation', createdAt: '2026-10-25T10:00:00.000Z', updatedAt: '2026-10-25T10:00:00.000Z' }] as Array<{ id: string; content: string; createdAt: string; updatedAt: string }> | undefined,
    isLoading: false as boolean,
    isError: false as boolean,
    refetch: vi.fn() as () => void,
  },
}));

vi.mock('@/hooks/usePortfolioComments', () => ({
  usePortfolioComments: () => mocks.query,
  useCreatePortfolioComment: () => ({ mutate: mocks.create, isPending: false }),
  useUpdatePortfolioComment: () => ({ mutate: mocks.update, isPending: false }),
  useDeletePortfolioComment: () => ({ mutate: mocks.remove, isPending: false }),
}));

vi.mock('@/components/EditablePriceCell', () => ({ EditablePriceCell: () => <span /> }));
vi.mock('@/hooks/useInvestments', () => ({
  useUpdateTargetPrices: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateCurrentValue: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useComments', () => ({
  useComments: () => ({ data: [], isLoading: false, isError: false }),
  useLatestCommentDates: () => ({ data: {}, isLoading: false, isError: false }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueries: ({ queries }: { queries: Array<{ enabled: boolean }> }) => queries.map(() => ({ data: [], isLoading: false, isError: false })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeInvestment(): InvestmentListItem {
  return {
    id: 'investment-1', ticker: 'ACME3', type: 'STOCK', sector: 'Industry', archivedAt: null,
    targetSellPrice: null, targetBuyPrice: null, targetBuyQuantity: null, recommendation: null,
    currentValue: null, treasuryProductId: null, treasuryProductName: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    position: { quantity: '2', averagePrice: '10' },
    quote: { currentPrice: 11, dailyChangePercent: 1 },
  };
}

describe('PortfolioPlanNotesDialog', () => {
  it('creates, edits, deletes notes and renders stored HTML safely', () => {
    render(<PortfolioPlanNotesDialog open onOpenChange={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Investment plan notes' });
    const form = within(dialog).getByRole('textbox', { name: 'Add a note…' });
    fireEvent.change(form, { target: { value: '<p>New plan</p>' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add note' }));
    expect(mocks.create).toHaveBeenCalledWith('<p>New plan</p>', expect.any(Object));
    expect(within(dialog).getByText('Review allocation')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit note' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Edit note' }), { target: { value: 'Updated plan' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save note' }));
    expect(mocks.update).toHaveBeenCalledWith({ id: 'note-1', content: 'Updated plan' }, expect.any(Object));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete note' }));
    expect(mocks.remove).toHaveBeenCalledWith('note-1', expect.any(Object));
  });

  it('shows loading and error states', () => {
    mocks.query = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    const { rerender } = render(<PortfolioPlanNotesDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText('Loading notes…')).toBeInTheDocument();

    mocks.query = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
    rerender(<PortfolioPlanNotesDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load notes.');
    mocks.query = {
      data: [{ id: 'note-1', content: 'Review allocation', createdAt: '2026-10-25T10:00:00.000Z', updatedAt: '2026-10-25T10:00:00.000Z' }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
  });
});

describe('InvestmentTable plan notes entry point', () => {
  it('shows the link above daily variation on desktop and mobile and opens the modal', () => {
    render(
      <InvestmentTable
        investments={[makeInvestment()]}
        isLoading={false}
        onAddOrder={vi.fn()}
        onArchive={vi.fn()}
        onTickerClick={vi.fn()}
      />,
    );

    const tableRows = within(screen.getAllByRole('table')[0]!).getAllByRole('row');
    expect(tableRows[0]?.textContent).toContain('Investment plan notes');
    expect(tableRows[1]?.textContent).toContain('Today’s portfolio variation');
    fireEvent.click(screen.getAllByRole('button', { name: 'Investment plan notes' })[0]!);
    expect(screen.getByRole('dialog', { name: 'Investment plan notes' })).toBeInTheDocument();
  });
});
