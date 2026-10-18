import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AllOrdersSection } from '@/components/AllOrdersSection';

vi.mock('@/hooks/useOrders', () => ({
  useAllOrders: () => ({ data: [
    { id: 'buy-1', investmentId: 'investment-1', ticker: 'ACME3', type: 'BUY', quantity: '10', price: '20', orderDate: '2026-01-01', contractedRate: null, averagePriceAtSell: null, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'sell-1', investmentId: 'investment-1', ticker: 'ACME3', type: 'SELL', quantity: '2', price: '25', orderDate: '2026-01-02', contractedRate: null, averagePriceAtSell: '20', createdAt: '2026-01-02T00:00:00.000Z' },
  ], isLoading: false, isError: false }),
}));

describe('AllOrdersSection', () => {
  it('filters order history to sales and toggles back to all orders', async () => {
    const user = userEvent.setup();
    render(<AllOrdersSection />);

    const table = screen.getByRole('table');
    expect(within(table).getByText('BUY')).toBeInTheDocument();
    expect(within(table).getByText('SELL')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show only sold orders' }));

    expect(screen.getByRole('button', { name: 'Show all order types' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('table')).queryByText('BUY')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('SELL')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show all order types' }));
    expect(within(screen.getByRole('table')).getByText('BUY')).toBeInTheDocument();
  });
});
