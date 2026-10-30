import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BudgetsPage } from '../pages/BudgetsPage';
import { ThemeProvider } from '../contexts/theme-context';

const mocks = vi.hoisted(() => ({
  createBudget: vi.fn(),
  updateBudgetName: vi.fn(),
  deleteBudget: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  logout: vi.fn(),
  admin: { id: 'admin-1', username: 'admin_finance', permissions: ['BUDGET'] as string[] },
  budgetUsers: [] as { id: string; username: string; budgets: { id: string; name: string; createdAt: string }[] }[],
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../contexts/auth-context', () => ({
  useAuth: () => ({ admin: mocks.admin, logout: mocks.logout }),
}));

vi.mock('../hooks/useBudgets', () => ({
  useBudgetUsers: () => ({ data: mocks.budgetUsers, isLoading: false, isError: false, refetch: vi.fn() }),
  useBudgets: () => ({ data: [{ id: 'budget-1', name: 'Monthly', createdAt: '2026-10-01T00:00:00.000Z' }], isLoading: false, isError: false, refetch: vi.fn() }),
  useBudget: (id: string | null) => ({
    data: id ? {
      id,
      name: 'Monthly',
      createdAt: '2026-10-01T00:00:00.000Z',
      items: [
        { id: 'item-1', budgetId: id, value: '12.50', itemDate: '2026-10-20T00:00:00.000Z', description: 'Groceries', additionalInfo: 'Market', isPaid: true, createdAt: '', updatedAt: '' },
        { id: 'item-2', budgetId: id, value: '-2.50', itemDate: '2026-10-19T00:00:00.000Z', description: null, additionalInfo: null, isPaid: false, createdAt: '', updatedAt: '' },
      ],
    } : undefined,
    isLoading: false,
    isError: false,
  }),
  useCreateBudget: () => ({ mutateAsync: mocks.createBudget, isPending: false }),
  useUpdateBudgetName: () => ({ mutateAsync: mocks.updateBudgetName, isPending: false }),
  useDeleteBudget: () => ({ mutateAsync: mocks.deleteBudget, isPending: false }),
  useCreateBudgetItem: () => ({ mutateAsync: mocks.createItem, isPending: false }),
  useUpdateBudgetItem: () => ({ mutateAsync: mocks.updateItem, isPending: false }),
  useDeleteBudgetItem: () => ({ mutateAsync: mocks.deleteItem, isPending: false }),
}));

vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function renderPage(): void {
  render(<ThemeProvider><BudgetsPage /></ThemeProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin = { id: 'admin-1', username: 'admin_finance', permissions: ['BUDGET'] };
  mocks.budgetUsers = [];
  mocks.createBudget.mockResolvedValue({ id: 'budget-2', name: 'Trip' });
  mocks.updateBudgetName.mockResolvedValue({ id: 'budget-1', name: 'Renamed' });
  mocks.deleteBudget.mockResolvedValue(undefined);
  mocks.createItem.mockResolvedValue({ id: 'item-new' });
  mocks.updateItem.mockResolvedValue({ id: 'item-1' });
  mocks.deleteItem.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

describe('BudgetsPage', () => {
  it('lets ADMIN select another user and manage that user’s budget items', async () => {
    mocks.admin = { id: 'admin-1', username: 'admin_finance', permissions: ['BUDGET', 'ADMIN'] };
    mocks.budgetUsers = [{
      id: 'owner-2', username: 'pedro', budgets: [{ id: 'budget-2', name: 'Home', createdAt: '2026-10-01T00:00:00.000Z' }],
    }];
    renderPage();

    expect(await screen.findByRole('button', { name: /pedro/ })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByLabelText('Budget name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit: Groceries' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove: Groceries' })).toBeInTheDocument();
  });

  it('shows private budgets, signed total, and defaults item dates to the local current date', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Monthly' })).toBeInTheDocument();
    expect(screen.getByText(/10\.00/)).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Unpaid')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue(localToday());
  });

  it('creates a budget from its required name', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Budget name'), 'Trip');
    await user.click(screen.getByRole('button', { name: 'Create budget' }));
    await waitFor(() => expect(mocks.createBudget).toHaveBeenCalledWith('Trip'));
  });

  it('creates, edits, and removes items and supports Portuguese copy', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Value (R$)'), '-15.75');
    await user.type(screen.getByLabelText('Description (optional)'), 'Correction');
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await waitFor(() => expect(mocks.createItem).toHaveBeenCalledWith(expect.objectContaining({
      value: -15.75,
      itemDate: localToday(),
      description: 'Correction',
      isPaid: false,
    })));

    await user.click(screen.getByRole('button', { name: 'Edit: Groceries' }));
    expect(screen.getByLabelText('Value (R$)')).toHaveValue(12.5);
    await user.click(screen.getByRole('button', { name: /Save item/ }));
    await waitFor(() => expect(mocks.updateItem).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'item-1' })));

    await user.click(screen.getByRole('button', { name: 'Remove: Groceries' }));
    await waitFor(() => expect(mocks.deleteItem).toHaveBeenCalledWith('item-1'));

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'pt' } });
    expect(await screen.findByRole('heading', { name: 'Seus orçamentos' })).toBeInTheDocument();
    expect(screen.getByLabelText('Valor (R$)')).toBeInTheDocument();
  });
});
