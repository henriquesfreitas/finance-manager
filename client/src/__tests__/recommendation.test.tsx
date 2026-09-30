import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommentModal } from '@/components/CommentModal';
import { getRecommendationColorClass } from '@/lib/recommendation';

const mocks = vi.hoisted(() => ({ recommendationMutate: vi.fn(), orders: vi.fn() }));

vi.mock('@/hooks/useComments', () => ({
  useComments: () => ({ data: [], isLoading: false, isError: false, error: undefined }),
  useCreateComment: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateComment: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteComment: () => ({ mutate: vi.fn(), isPending: false }),
  useLatestCommentDates: () => ({ data: {} }),
}));

vi.mock('@/hooks/useOrders', () => ({
  useOrders: (...args: unknown[]) => {
    mocks.orders(...args);
    return { data: [], isLoading: false, isError: false };
  },
}));

vi.mock('@/hooks/useInvestments', () => ({
  useUpdateInvestmentSector: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateInvestmentRecommendation: () => ({ mutate: mocks.recommendationMutate, isPending: false }),
}));

describe('ticker recommendation', () => {
  it('maps the 1–5 score from red to green', () => {
    expect(getRecommendationColorClass(1)).toContain('text-red-600');
    expect(getRecommendationColorClass(2)).toContain('text-orange-600');
    expect(getRecommendationColorClass(3)).toContain('text-yellow-600');
    expect(getRecommendationColorClass(4)).toContain('text-lime-600');
    expect(getRecommendationColorClass(5)).toContain('text-green-600');
    expect(getRecommendationColorClass(null)).toBe('');
  });

  it('saves the selected score from the ticker modal', async () => {
    const user = userEvent.setup();
    const investment = {
      id: 'investment-1',
      ticker: 'ACME3',
      type: 'STOCK' as const,
      sector: 'Industry',
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
      position: { quantity: '10', averagePrice: '20' },
      quote: { currentPrice: 25, dailyChangePercent: 1.5 },
    };
    render(
      <CommentModal
        open
        onOpenChange={vi.fn()}
        investmentId="investment-1"
        ticker="ACME3"
        sector="Industry"
        recommendation={null}
        investment={investment}
        activeInvestments={[investment]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Investment Details' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Order History — ACME3' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('combobox', { name: 'Ticker recommendation' })).not.toBeInTheDocument();
    expect(mocks.orders).toHaveBeenLastCalledWith('investment-1', false);

    await user.click(screen.getByRole('button', { name: 'Order History — ACME3' }));
    expect(screen.getByRole('button', { name: 'Order History — ACME3' })).toHaveAttribute('aria-expanded', 'true');
    expect(mocks.orders).toHaveBeenLastCalledWith('investment-1', true);

    await user.click(screen.getByRole('button', { name: 'Investment Details' }));
    expect(screen.getByText('Current total')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ticker recommendation' }), '5');

    expect(mocks.recommendationMutate).toHaveBeenCalledWith(
      { id: 'investment-1', recommendation: 5 },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });
});
