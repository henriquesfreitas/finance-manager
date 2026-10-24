import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddInvestmentForm } from '@/components/AddInvestmentForm';

const { createInvestment } = vi.hoisted(() => ({ createInvestment: vi.fn() }));

vi.mock('@/hooks/useInvestments', () => ({
  useCreateInvestment: () => ({ mutate: createInvestment, isPending: false }),
  useCreateTreasuryInvestment: () => ({ mutate: vi.fn(), isPending: false }),
  useTreasuryProducts: () => ({ data: [], isLoading: false }),
}));

describe('AddInvestmentForm FII sectors', () => {
  beforeEach(() => createInvestment.mockReset());

  it.each(['FIIs — Tijolo', 'FIIs — Papel', 'FIIs — Misto'])(
    'submits a new investment with sector %s',
    async (sector) => {
      const user = userEvent.setup();
      render(<AddInvestmentForm />);

      const sectorSelect = screen.getByRole('combobox', { name: 'Sector' });
      expect(screen.queryByRole('option', { name: 'FIIs', exact: true })).not.toBeInTheDocument();
      await user.type(screen.getByLabelText('Ticker'), 'TEST11');
      await user.selectOptions(sectorSelect, sector);
      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => expect(createInvestment).toHaveBeenCalledWith({
        ticker: 'TEST11',
        sector,
      }, expect.any(Object)));
    },
  );
});
