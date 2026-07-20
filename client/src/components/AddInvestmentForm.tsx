import React, { useState } from 'react';
import { useController, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateInvestment, useCreateTreasuryInvestment, useTreasuryProducts } from '@/hooks/useInvestments';
import { INVESTMENT_SECTORS } from '@/lib/investment-sectors';

// ─── Asset type selector ──────────────────────────────────────────────────────

type AssetType = 'STOCK' | 'TREASURY';

// ─── Stock form schema ────────────────────────────────────────────────────────

const stockSchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1, 'Ticker is required')
    .max(20, 'Ticker must be at most 20 characters')
    .regex(/^[A-Za-z0-9.\-]+$/, 'Ticker must contain only letters, digits, dots, and hyphens'),
  sector: z.enum(INVESTMENT_SECTORS, { error: 'Sector is required' }),
});

type StockFormValues = z.infer<typeof stockSchema>;

// ─── Treasury form schema ─────────────────────────────────────────────────────

const treasurySchema = z.object({
  treasuryProductId: z.string().min(1, 'Please select a product'),
});

type TreasuryFormValues = z.infer<typeof treasurySchema>;

// ─── Stock sub-form ───────────────────────────────────────────────────────────

interface StockFormProps {
  onSuccess: () => void;
}

function StockForm({ onSuccess }: StockFormProps): React.JSX.Element {
  const createInvestment = useCreateInvestment();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StockFormValues>({
    resolver: zodResolver(stockSchema),
    defaultValues: { ticker: '', sector: undefined },
  });

  const { field: tickerField } = useController({ name: 'ticker', control });

  function handleTickerChange(e: React.ChangeEvent<HTMLInputElement>): void {
    tickerField.onChange(e.target.value.toUpperCase());
  }

  function onSubmit(values: StockFormValues): void {
    createInvestment.mutate(
      { ticker: values.ticker, sector: values.sector },
      {
        onSuccess: () => {
          reset();
          toast.success(`${values.ticker} added to your portfolio`);
          onSuccess();
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
          <Label htmlFor="add-stock-ticker">Ticker</Label>
          <Input
            id="add-stock-ticker"
            placeholder="ITUB3"
            className="w-40"
            aria-invalid={!!errors.ticker}
            aria-describedby={errors.ticker ? 'add-stock-ticker-error' : undefined}
            {...tickerField}
            onChange={handleTickerChange}
          />
        </div>

        {/* Sector */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-stock-sector">Sector</Label>
          <select
            id="add-stock-sector"
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 w-52"
            aria-invalid={!!errors.sector}
            aria-describedby={errors.sector ? 'add-stock-sector-error' : undefined}
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
          {createInvestment.isPending ? 'Adding…' : 'Add'}
        </Button>
      </div>

      {errors.ticker && (
        <p id="add-stock-ticker-error" className="text-xs text-destructive" role="alert">
          {errors.ticker.message}
        </p>
      )}
      {errors.sector && (
        <p id="add-stock-sector-error" className="text-xs text-destructive" role="alert">
          {errors.sector.message}
        </p>
      )}
    </form>
  );
}

// ─── Treasury sub-form ────────────────────────────────────────────────────────

interface TreasuryFormProps {
  onSuccess: () => void;
}

function TreasuryForm({ onSuccess }: TreasuryFormProps): React.JSX.Element {
  const createTreasury = useCreateTreasuryInvestment();
  const { data: products = [], isLoading: loadingProducts } = useTreasuryProducts();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TreasuryFormValues>({
    resolver: zodResolver(treasurySchema),
    defaultValues: { treasuryProductId: '' },
  });

  function onSubmit(values: TreasuryFormValues): void {
    const product = products.find((p) => p.id === values.treasuryProductId);
    const productName = product?.name ?? 'Treasury bond';

    createTreasury.mutate(values.treasuryProductId, {
      onSuccess: () => {
        reset();
        toast.success(`${productName} added to your portfolio`);
        onSuccess();
      },
      onError: (error: Error) => {
        if (error.message.includes('already registered')) {
          toast.error(error.message);
        } else {
          toast.error(`Failed to add ${productName}: ${error.message}`);
        }
      },
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-end gap-2">
        {/* Product selector */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-treasury-product">Product</Label>
          <select
            id="add-treasury-product"
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 w-72"
            aria-invalid={!!errors.treasuryProductId}
            aria-describedby={errors.treasuryProductId ? 'add-treasury-product-error' : undefined}
            disabled={loadingProducts}
            {...register('treasuryProductId')}
          >
            <option value="">
              {loadingProducts ? 'Loading products…' : 'Select a product…'}
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" disabled={createTreasury.isPending || loadingProducts}>
          {createTreasury.isPending ? 'Adding…' : 'Add'}
        </Button>
      </div>

      {errors.treasuryProductId && (
        <p id="add-treasury-product-error" className="text-xs text-destructive" role="alert">
          {errors.treasuryProductId.message}
        </p>
      )}
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Add-investment form with an asset type selector.
 * Step 1: choose type (Ações or Tesouro Direto).
 * Step 2a: ticker + sector form for stocks.
 * Step 2b: product dropdown for treasury bonds.
 *
 * The type selector is always visible; the form below changes dynamically.
 *
 * @example <AddInvestmentForm />
 */
export function AddInvestmentForm(): React.JSX.Element {
  const [assetType, setAssetType] = useState<AssetType>('STOCK');

  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    setAssetType(e.target.value as AssetType);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Asset type selector */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-investment-type">Type</Label>
          <select
            id="add-investment-type"
            value={assetType}
            onChange={handleTypeChange}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-44"
            aria-label="Investment type"
          >
            <option value="STOCK">Ações / ETFs</option>
            <option value="TREASURY">Tesouro Direto</option>
          </select>
        </div>
      </div>

      {/* Conditional sub-form */}
      {assetType === 'STOCK' ? (
        <StockForm onSuccess={() => {}} />
      ) : (
        <TreasuryForm onSuccess={() => {}} />
      )}
    </div>
  );
}
