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
    { id: 'sell-paper', investmentId: 'investment-3', ticker: 'PAPER11', sector: 'FIIs — Papel', type: 'SELL', quantity: '1', price: '30', orderDate: '2026-01-03', contractedRate: null, averagePriceAtSell: '20', createdAt: '2026-01-03T00:00:00.000Z' },
    { id: 'sell-misto', investmentId: 'investment-4', ticker: 'MISTO11', sector: 'FIIs — Misto', type: 'SELL', quantity: '1', price: '40', orderDate: '2026-01-04', contractedRate: null, averagePriceAtSell: '20', createdAt: '2026-01-04T00:00:00.000Z' },
    { id: 'sell-tijolo', investmentId: 'investment-5', ticker: 'TIJOLO11', sector: 'FIIs — Tijolo', type: 'SELL', quantity: '1', price: '15', orderDate: '2026-01-05', contractedRate: null, averagePriceAtSell: '20', createdAt: '2026-01-05T00:00:00.000Z' },
    { id: 'other-sell', investmentId: 'investment-2', ticker: 'VIVT3', sector: 'Telecomunicações', type: 'SELL', quantity: '1', price: '50', orderDate: '2026-02-02', contractedRate: null, averagePriceAtSell: '30', createdAt: '2026-02-02T00:00:00.000Z' },
  ], isLoading: false, isError: false }),
}));

describe('AllOrdersSection', () => {
  it('filters order history to all sales or sales from a selected year', async () => {
    const user = userEvent.setup();
    render(<AllOrdersSection />);

    const table = screen.getByRole('table');
    expect(within(table).getByText('BUY')).toBeInTheDocument();
    expect(within(table).getAllByText('SELL')).toHaveLength(6);
    expect(screen.queryByRole('region', { name: 'FII sales summary' })).not.toBeInTheDocument();

    const filter = screen.getByRole('combobox', { name: 'Filter order history' });
    expect(filter).toHaveValue('all');

    await user.selectOptions(filter, 'sales');
    expect(within(screen.getByRole('table')).queryByText('BUY')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByText('SELL')).toHaveLength(6);
    const summary = screen.getByRole('region', { name: 'FII sales summary' });
    expect(within(summary).getByText('5')).toBeInTheDocument();
    expect(within(summary).getByText('+R$ 56.00')).toBeInTheDocument();

    await user.selectOptions(filter, 'year:2025');
    expect(within(screen.getByRole('table')).queryByText('BUY')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByText('SELL')).toHaveLength(1);
    const yearSummary = screen.getByRole('region', { name: 'FII sales summary' });
    expect(within(yearSummary).getByText('1')).toBeInTheDocument();
    expect(within(yearSummary).getByText('+R$ 21.00')).toBeInTheDocument();

    await user.selectOptions(filter, 'year:2026');
    expect(within(screen.getByRole('table')).getAllByText('SELL')).toHaveLength(5);
    const lossYearSummary = screen.getByRole('region', { name: 'FII sales summary' });
    expect(within(lossYearSummary).getByText('4')).toBeInTheDocument();
    expect(within(lossYearSummary).getByText('+R$ 35.00')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('-R$ 5.00')).toBeInTheDocument();
    await user.hover(screen.getByRole('button', { name: 'FII sale details' }));
    const saleDetails = screen.getByRole('tooltip', { hidden: true });
    expect(within(saleDetails).getByText('TIJOLO11')).toBeInTheDocument();
    expect(within(saleDetails).getByText(/Loss:/)).toBeInTheDocument();
    expect(within(saleDetails).getByText(/Date:/)).toBeInTheDocument();

    await user.selectOptions(filter, 'all');
    expect(within(screen.getByRole('table')).getByText('BUY')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByText('SELL')).toHaveLength(6);
  });
});
