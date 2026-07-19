import React from 'react';
import { useController, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateInvestment } from '@/hooks/useInvestments';
import { INVESTMENT_SECTORS } from '@/lib/investment-sectors';

// ─── Validation schema ────────────────────────────────────────────────────────

/**
 * Client-side Zod schema for add-investment form.
 * Mirrors the server-side validator: ticker is trimmed/uppercased, sector
 * must be one of the canonical INVESTMENT_SECTORS values.
 */
const addInvestmentSchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1, 'Ticker is required')
    .max(10, 'Ticker must be at most 10 characters')
    .regex(/^[A-Za-z0-9.]+$/, 'Ticker must contain only letters, digits, and dots'),
  sector: z.enum(INVESTMENT_SECTORS, { error: 'Sector is required' }),
});

type AddInvestmentFormValues = z.infer<typeof addInvestmentSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Inline form for registering a new investment with ticker and sector.
 * Renders a row: ticker input + sector dropdown + submit button.
 *
 * Features:
 * - Real-time uppercase conversion on the ticker field
 * - Inline Zod validation errors below each field
 * - Toast on duplicate ticker (server 409) or success
 *
 * @example <AddInvestmentForm />
 */
export function AddInvestmentForm(): React.JSX.Element {
  const createInvestment = useCreateInvestment();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddInvestmentFormValues>({
    resolver: zodResolver(addInvestmentSchema),
    defaultValues: { ticker: '', sector: undefined },
  });

  // useController gives us fine-grained onChange access for uppercase conversion
  const { field: tickerField } = useController({ name: 'ticker', control });

  function handleTickerChange(e: React.ChangeEvent<HTMLInputElement>): void {
    tickerField.onChange(e.target.value.toUpperCase());
  }

  function onSubmit(values: AddInvestmentFormValues): void {
    createInvestment.mutate(
      { ticker: values.ticker, sector: values.sector },
      {
        onSuccess: () => {
          reset();
          toast.success(`${values.ticker} added to your portfolio`);
        },
        onError: (error: Error) => {
          if (error.message.includes('already registered')) {
            toast.error(error.message);
          } else {
            toast.error(`Failed to add ${values.ticker}: ${error.message}`);
          }
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-end gap-2">
        {/* Ticker */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-investment-ticker">Ticker</Label>
          <Input
            id="add-investment-ticker"
            placeholder="ITUB3"
            className="w-40"
            aria-invalid={!!errors.ticker}
            aria-describedby={errors.ticker ? 'add-investment-ticker-error' : undefined}
            {...tickerField}
            onChange={handleTickerChange}
          />
        </div>

        {/* Sector */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-investment-sector">Sector</Label>
          <select
            id="add-investment-sector"
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 w-52"
            aria-invalid={!!errors.sector}
            aria-describedby={errors.sector ? 'add-investment-sector-error' : undefined}
            {...register('sector')}
          >
            <option value="">Select a sector…</option>
            {INVESTMENT_SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" disabled={createInvestment.isPending}>
          {createInvestment.isPending ? 'Adding…' : 'Add Investment'}
        </Button>
      </div>

      {/* Validation errors */}
      {errors.ticker && (
        <p id="add-investment-ticker-error" className="text-xs text-destructive" role="alert">
          {errors.ticker.message}
        </p>
      )}
      {errors.sector && (
        <p id="add-investment-sector-error" className="text-xs text-destructive" role="alert">
          {errors.sector.message}
        </p>
      )}
    </form>
  );
}
