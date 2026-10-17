import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bill } from '@/types/bill';
import { BillsControlPage } from '@/pages/BillsControlPage';

const mocks = vi.hoisted(() => ({
  bills: [] as Bill[],
  createBill: vi.fn(),
  updateBillPaid: vi.fn(),
  deleteBill: vi.fn(),
  setSettlementPaid: vi.fn(),
}));

vi.mock('@/hooks/useBills', () => ({
  useBills: () => ({ data: mocks.bills, isLoading: false, isError: false, refetch: vi.fn() }),
  useBillSettlements: () => ({ data: [], isLoading: false }),
  useCreateBill: () => ({ mutateAsync: mocks.createBill, isPending: false }),
  useUpdateBillPaid: () => ({ mutate: mocks.updateBillPaid, isPending: false }),
  useDeleteBill: () => ({ mutate: mocks.deleteBill, isPending: false }),
  useSetBillMonthSettlementPaid: () => ({ mutate: mocks.setSettlementPaid, isPending: false }),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    logout: vi.fn(),
    admin: { id: 'admin-1', username: 'Henrique', permissions: ['BILLS_CONTROL'] },
  }),
}));

vi.mock('@/components/EditBillDialog', () => ({ EditBillDialog: () => null }));
vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => null }));

function makeReceivedBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'received-1',
    amount: '10.00',
    type: 'RECEIVED',
    detail: 'shared gift',
    billDate: '2026-10-31T00:00:00.000Z',
    paidBy: 'HENRIQUE',
    responsibleBy: null,
    isPaid: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mocks.bills = [];
  mocks.createBill.mockReset().mockResolvedValue(undefined);
  mocks.updateBillPaid.mockReset();
  mocks.deleteBill.mockReset();
  mocks.setSettlementPaid.mockReset();
  window.localStorage.setItem('finance-manager:bills-language', 'en');
});

afterEach(() => cleanup());

describe('BillsControlPage received amounts', () => {
  it('shows details, receiver, fixed equal split, and the received amount action', async () => {
    const user = userEvent.setup();
    render(<BillsControlPage />);

    await user.selectOptions(screen.getByLabelText('Type'), 'RECEIVED');

    expect(screen.getByLabelText(/Who received/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Details/)).toBeInTheDocument();
    expect(screen.getByText('Amount split')).toBeInTheDocument();
    expect(screen.getByText('Split equally')).toBeInTheDocument();
    expect(screen.queryByLabelText('Bill responsibility')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add received amount' })).toBeInTheDocument();
  });

  it('submits a received amount with details, receiver, and equal responsibility', async () => {
    const user = userEvent.setup();
    render(<BillsControlPage />);

    await user.type(screen.getByLabelText('Amount (R$)'), '10');
    await user.selectOptions(screen.getByLabelText('Type'), 'RECEIVED');
    await user.type(screen.getByLabelText(/Details/), 'wedding gift');
    await user.selectOptions(screen.getByLabelText(/Who received/), 'HENRIQUE');
    await user.click(screen.getByRole('button', { name: 'Add received amount' }));

    await waitFor(() => expect(mocks.createBill).toHaveBeenCalledOnce());
    expect(mocks.createBill).toHaveBeenCalledWith(expect.objectContaining({
      amount: 10,
      type: 'RECEIVED',
      detail: 'wedding gift',
      paidBy: 'HENRIQUE',
      responsibleBy: null,
      isPaid: true,
    }));
  });

  it('excludes received amounts from monthly expenses and settles them opposite to expenses', () => {
    mocks.bills = [makeReceivedBill()];
    render(<BillsControlPage />);

    const month = screen.getByRole('heading', { name: 'October 2026' }).closest('section');
    expect(month).not.toBeNull();
    expect(within(month!).getByText('Monthly bill total').parentElement).toHaveTextContent(/R\$\s*0\.00/);
    expect(within(month!).getByText('Henrique pays Amanda R$5.00 to balance paid bills.')).toBeInTheDocument();
    expect(within(month!).getAllByText('Received by:')).toHaveLength(2);
    expect(within(month!).getAllByText('shared gift')).toHaveLength(2);
  });
});
