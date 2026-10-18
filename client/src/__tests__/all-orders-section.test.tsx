import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AllOrdersSection } from '@/components/AllOrdersSection';

vi.mock('@/hooks/useOrders', () => ({
  useAllOrders: () => ({ data: [
    { id: 'buy-1', investmentId: 'investment-1', ticker: 'ACME3', sector: 'FIIs', type: 'BUY', quantity: '10', price: '20', orderDate: '2026-01-01', contractedRate: null, averagePriceAtSell: null, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'sell-2026', investmentId: 'investment-1', ticker: 'ACME3', sector: 'FIIs', type: 'SELL', quantity: '2', price: '25', orderDate: '2026-01-02', contractedRate: null, averagePriceAtSell: '20', createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 'sell-2025', investmentId: 'investment-1', ticker: 'ACME3', sector: 'FIIs', type: 'SELL', quantity: '3', price: '27', orderDate: '2025-12-02', contractedRate: null, averagePriceAtSell: '20', createdAt: '2025-12-02T00:00:00.000Z' },
    { id: 'other-sell', investmentId: 'investment-2', ticker: 'VIVT3', sector: 'Telecomunicações', type: 'SELL', quantity: '1', price: '50', orderDate: '2026-02-02', contractedRate: null, averagePriceAtSell: '30', createdAt: '2026-02-02T00:00:00.000Z' },
  ], isLoading: false, isError: false }),
}));

describe('AllOrdersSection', () => {
  it('filters order history to all sales or sales from a selected year', async () => {
    const user = userEvent.setup();
    render(<AllOrdersSection />);

    const table = screen.getByRole('table');
    expect(within(table).getByText('BUY')).toBeInTheDocument();
    expect(within(table).getAllByText('SELL')).toHaveLength(3);
    expect(screen.queryByRole('region', { name: 'FII sales summary' })).not.toBeInTheDocument();

    const filter = screen.getByRole('combobox', { name: 'Filter order history' });
    expect(filter).toHaveValue('all');

    await user.selectOptions(filter, 'sales');
    expect(within(screen.getByRole('table')).queryByText('BUY')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByText('SELL')).toHaveLength(3);
    const summary = screen.getByRole('region', { name: 'FII sales summary' });
    expect(within(summary).getByText('2')).toBeInTheDocument();
    expect(within(summary).getByText('+R$ 31.00')).toBeInTheDocument();

    await user.selectOptions(filter, 'year:2025');
    expect(within(screen.getByRole('table')).queryByText('BUY')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByText('SELL')).toHaveLength(1);

    await user.selectOptions(filter, 'all');
    expect(within(screen.getByRole('table')).getByText('BUY')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByText('SELL')).toHaveLength(3);
  });
});
