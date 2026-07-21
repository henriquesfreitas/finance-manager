import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Pencil, X, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOrders, useCreateOrder, useUpdateOrder } from '@/hooks/useOrders';
import type { InvestmentListItem } from '@/types/investment';
import type { OrderListItem } from '@/types/order';
import { calculateSellTotalInvested, calculateSellProfit } from '@/lib/investment-calculator';
import { formatQuantity } from '@/lib/utils';

// ─── Validation schemas ───────────────────────────────────────────────────────

const orderSchema = z.object({
  type: z.enum(['BUY', 'SELL', 'BONUS', 'SPLIT']),
  quantity: z.number().positive('Quantity must be greater than 0'),
  price: z.number().min(0, 'Price must be 0 or greater'),
  orderDate: z.date().refine(
    (d) => {
      const inputDate = d.toLocaleDateString('en-CA');
      const today = new Date().toLocaleDateString('en-CA');
      return inputDate <= today;
    },
    { message: 'Order date must not be in the future' },
  ),
  contractedRate: z.number().positive('Rate must be greater than 0').nullable().optional(),
}).refine(
  (data) => data.type === 'SPLIT' || data.price > 0,
  { message: 'Price must be greater than 0', path: ['price'] },
);

type OrderFormValues = z.infer<typeof orderSchema>;

const editOrderSchema = z.object({
  type: z.enum(['BUY', 'SELL', 'BONUS', 'SPLIT']),
  quantity: z.number().positive('Quantity must be greater than 0'),
  price: z.number().min(0, 'Price must be 0 or greater'),
  orderDate: z.date().refine(
    (d) => {
      const inputDate = d.toLocaleDateString('en-CA');
      const today = new Date().toLocaleDateString('en-CA');
      return inputDate <= today;
    },
    { message: 'Order date must not be in the future' },
  ),
  averagePriceAtSell: z.number().positive('PM must be greater than 0').nullable().optional(),
}).refine(
  (data) => data.type === 'SPLIT' || data.price > 0,
  { message: 'Price must be greater than 0', path: ['price'] },
);

type EditOrderFormValues = z.infer<typeof editOrderSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns today's date as a "YYYY-MM-DD" string using local timezone. */
function todayISOString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats an "YYYY-MM-DD" order date as dd/MM/yyyy (pt-BR).
 * Appends T12:00:00 to avoid timezone off-by-one when constructing Date from date-only strings.
 */
function formatOrderDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR');
}

/** Computes the order total from decimal string fields. */
function computeTotal(quantity: string, price: string): string {
  return (parseFloat(quantity) * parseFloat(price)).toFixed(2);
}

/** Returns Tailwind text-color class based on order type. */
function orderTypeColorClass(type: string): string {
  if (type === 'BUY') return 'text-green-600';
  if (type === 'SELL') return 'text-red-600';
  if (type === 'BONUS') return 'text-blue-600';
  return 'text-purple-600'; // SPLIT
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface OrderFormProps {
  investmentId: string;
  isTreasury: boolean;
  onSuccess: () => void;
}

/**
 * Form for adding a new order (BUY or SELL).
 * Uses react-hook-form + Zod validation with inline error messages.
 */
function OrderForm({ investmentId, isTreasury, onSuccess }: OrderFormProps): React.JSX.Element {
  const createOrder = useCreateOrder(investmentId);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      type: 'BUY',
      price: undefined as unknown as number,
      orderDate: new Date(`${todayISOString()}T12:00:00`),
    },
  });

  const selectedType = watch('type');

  // When switching to SPLIT, auto-set price to 0 (hidden field)
  React.useEffect(() => {
    if (selectedType === 'SPLIT') {
      setValue('price', 0);
    }
  }, [selectedType, setValue]);

  function onSubmit(values: OrderFormValues): void {
    // SPLIT orders don't have a price — force it to 0
    const payload = values.type === 'SPLIT' ? { ...values, price: 0 } : values;
    createOrder.mutate(payload, {
      onSuccess: () => {
        toast.success('Order added successfully');
        reset({
          type: 'BUY',
          quantity: undefined as unknown as number,
          price: undefined as unknown as number,
          contractedRate: undefined,
          orderDate: new Date(`${todayISOString()}T12:00:00`),
        });
        onSuccess();
      },
      onError: (error: Error) => {
        toast.error(error.message);
      },
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      {/* Order Type */}
      <div className="grid gap-1.5">
        <Label htmlFor="order-type">Type</Label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <select
              id="order-type"
              className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${orderTypeColorClass(field.value)}`}
              aria-invalid={!!errors.type}
              value={field.value}
              onChange={field.onChange}
            >
              <option value="BUY" className="text-green-600">BUY</option>
              <option value="SELL" className="text-red-600">SELL</option>
              <option value="BONUS" className="text-blue-600">BONUS</option>
              <option value="SPLIT" className="text-purple-600">SPLIT</option>
            </select>
          )}
        />
        {errors.type && (
          <p className="text-xs text-destructive" role="alert">
            {errors.type.message}
          </p>
        )}
      </div>

      {/* Quantity / Factor */}
      <div className="grid gap-1.5">
        <Label htmlFor="order-quantity">
          {selectedType === 'SPLIT' ? 'Factor (e.g. 2 for 2:1)' : 'Quantity'}
        </Label>
        <Input
          id="order-quantity"
          type="number"
          step="any"
          placeholder={selectedType === 'SPLIT' ? '2' : '100'}
          aria-invalid={!!errors.quantity}
          {...register('quantity', { valueAsNumber: true })}
        />
        {errors.quantity && (
          <p className="text-xs text-destructive" role="alert">
            {errors.quantity.message}
          </p>
        )}
      </div>

      {/* Unit Price — hidden for SPLIT (price is 0) */}
      {selectedType !== 'SPLIT' && (
        <div className="grid gap-1.5">
          <Label htmlFor="order-price">Unit Price (R$)</Label>
          <Input
            id="order-price"
            type="number"
            step="any"
            placeholder="28.50"
            aria-invalid={!!errors.price}
            {...register('price', { valueAsNumber: true })}
          />
          {errors.price && (
            <p className="text-xs text-destructive" role="alert">
              {errors.price.message}
            </p>
          )}
        </div>
      )}

      {/* Contracted Rate — only shown for treasury investments */}
      {isTreasury && selectedType === 'BUY' && (
        <div className="grid gap-1.5">
          <Label htmlFor="order-rate">Contracted Rate (%)</Label>
          <Input
            id="order-rate"
            type="number"
            step="0.01"
            placeholder="6.50"
            aria-invalid={!!errors.contractedRate}
            {...register('contractedRate', { valueAsNumber: true })}
          />
          {errors.contractedRate && (
            <p className="text-xs text-destructive" role="alert">
              {errors.contractedRate.message}
            </p>
          )}
        </div>
      )}

      {/* Order Date */}
      <div className="grid gap-1.5">
        <Label htmlFor="order-date">Order Date</Label>
        <Controller
          name="orderDate"
          control={control}
          render={({ field }) => (
            <Input
              id="order-date"
              type="date"
              max={todayISOString()}
              aria-invalid={!!errors.orderDate}
              value={field.value instanceof Date ? field.value.toISOString().slice(0, 10) : ''}
              onChange={(e) =>
                field.onChange(
                  e.target.value ? new Date(`${e.target.value}T12:00:00`) : null,
                )
              }
            />
          )}
        />
        {errors.orderDate && (
          <p className="text-xs text-destructive" role="alert">
            {errors.orderDate.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={createOrder.isPending}>
        {createOrder.isPending ? 'Adding…' : 'Add Order'}
      </Button>
    </form>
  );
}

interface EditOrderRowProps {
  order: OrderListItem;
  investmentId: string;
  onCancel: () => void;
  onSaved: () => void;
}

/**
 * Inline edit row that replaces a history row when the user clicks the edit icon.
 * Pre-fills all fields from the existing order record.
 */
function EditOrderRow({
  order,
  investmentId,
  onCancel,
  onSaved,
}: EditOrderRowProps): React.JSX.Element {
  const updateOrder = useUpdateOrder(investmentId);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<EditOrderFormValues>({
    resolver: zodResolver(editOrderSchema),
    defaultValues: {
      type: order.type,
      quantity: parseFloat(order.quantity),
      price: parseFloat(order.price),
      orderDate: new Date(`${order.orderDate}T12:00:00`),
      averagePriceAtSell:
        order.averagePriceAtSell !== null && order.averagePriceAtSell !== undefined
          ? parseFloat(order.averagePriceAtSell)
          : null,
    },
  });

  const selectedType = watch('type');

  function onSubmit(values: EditOrderFormValues): void {
    updateOrder.mutate(
      {
        orderId: order.id,
        data: {
          ...values,
          // Only send averagePriceAtSell when editing a SELL order
          averagePriceAtSell:
            values.type === 'SELL' ? (values.averagePriceAtSell ?? null) : null,
        },
      },
      {
        onSuccess: () => {
          toast.success('Order updated successfully');
          onSaved();
        },
        onError: (error: Error) => {
          toast.error(error.message);
        },
      },
    );
  }

  return (
    <TableRow>
      <TableCell colSpan={6}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-2"
          aria-label="Edit order"
        >
          {/* Row 1: Type + Date side by side */}
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <select
                    className={`h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm font-medium shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${orderTypeColorClass(field.value)}`}
                    aria-label="Order type"
                    aria-invalid={!!errors.type}
                    value={field.value}
                    onChange={field.onChange}
                  >
                    <option value="BUY" className="text-green-600">BUY</option>
                    <option value="SELL" className="text-red-600">SELL</option>
                    <option value="BONUS" className="text-blue-600">BONUS</option>
                    <option value="SPLIT" className="text-purple-600">SPLIT</option>
                  </select>
                )}
              />
              {errors.type && (
                <p className="text-xs text-destructive" role="alert">{errors.type.message}</p>
              )}
            </div>
            <div className="grid gap-1">
              <Controller
                name="orderDate"
                control={control}
                render={({ field }) => (
                  <Input
                    type="date"
                    max={todayISOString()}
                    aria-label="Order date"
                    aria-invalid={!!errors.orderDate}
                    value={field.value instanceof Date ? field.value.toISOString().slice(0, 10) : ''}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? new Date(`${e.target.value}T12:00:00`) : null,
                      )
                    }
                  />
                )}
              />
              {errors.orderDate && (
                <p className="text-xs text-destructive" role="alert">{errors.orderDate.message}</p>
              )}
            </div>
          </div>

          {/* Row 2: Quantity + Price side by side */}
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Input
                type="number"
                step="any"
                placeholder="Quantity"
                aria-label="Quantity"
                aria-invalid={!!errors.quantity}
                {...register('quantity', { valueAsNumber: true })}
              />
              {errors.quantity && (
                <p className="text-xs text-destructive" role="alert">{errors.quantity.message}</p>
              )}
            </div>
            <div className="grid gap-1">
              <Input
                type="number"
                step="any"
                placeholder="Price"
                aria-label="Price"
                aria-invalid={!!errors.price}
                {...register('price', { valueAsNumber: true })}
              />
              {errors.price && (
                <p className="text-xs text-destructive" role="alert">{errors.price.message}</p>
              )}
            </div>
          </div>

          {/* Row 3: PM at sell — only for SELL orders */}
          {selectedType === 'SELL' && (
            <div className="grid gap-1">
              <Input
                type="number"
                step="any"
                placeholder="PM (preço médio)"
                aria-label="Average price at sell (PM)"
                aria-invalid={!!errors.averagePriceAtSell}
                {...register('averagePriceAtSell', { valueAsNumber: true })}
              />
              {errors.averagePriceAtSell && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.averagePriceAtSell.message}
                </p>
              )}
            </div>
          )}

          {/* Row 4: Actions */}
          <div className="flex justify-end gap-1">
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              disabled={updateOrder.isPending}
              aria-label="Save order"
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onCancel}
              aria-label="Cancel edit"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </form>
      </TableCell>
    </TableRow>
  );
}

interface OrderHistoryProps {
  investmentId: string;
  isTreasury: boolean;
}

/**
 * Displays the complete order history for an investment with inline edit support.
 * Each row has a pencil icon that switches it to an inline edit form.
 * Always fetches fresh data (staleTime: 0 in useOrders).
 * Shows an error message on fetch failure with no stale data (Req 5.4).
 */
function OrderHistory({ investmentId, isTreasury }: OrderHistoryProps): React.JSX.Element {
  const { data: orders, isLoading, isError, error } = useOrders(investmentId);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">Loading orders…</p>
    );
  }

  if (isError) {
    return (
      <p className="py-4 text-center text-sm text-destructive" role="alert">
        Could not load orders: {error.message}
      </p>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No orders recorded yet
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table className="min-w-[520px]">
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Price (R$)</TableHead>
            {isTreasury && <TableHead className="text-right">Rate (%)</TableHead>}
            <TableHead className="text-right">Date</TableHead>
            <TableHead className="text-right">Total (R$)</TableHead>
            <TableHead className="text-right">Actions</TableHead>          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order: OrderListItem) =>
            editingOrderId === order.id ? (
              <EditOrderRow
                key={order.id}
                order={order}
                investmentId={investmentId}
                onCancel={() => setEditingOrderId(null)}
                onSaved={() => setEditingOrderId(null)}
              />
            ) : (
              <React.Fragment key={order.id}>
                <TableRow>
                  <TableCell>
                    <span className={`${orderTypeColorClass(order.type)} font-medium`}>
                      {order.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {order.type === 'SPLIT'
                      ? `×${formatQuantity(parseFloat(order.quantity))}`
                      : formatQuantity(parseFloat(order.quantity))}
                  </TableCell>
                  <TableCell className="text-right">
                    {order.type === 'SPLIT' ? '—' : parseFloat(order.price).toFixed(2)}
                  </TableCell>
                  {isTreasury && (
                    <TableCell className="text-right">
                      {order.contractedRate !== null && order.contractedRate !== undefined
                        ? `${parseFloat(order.contractedRate).toFixed(2)}%`
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {formatOrderDate(order.orderDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    {order.type === 'SPLIT' ? '—' : computeTotal(order.quantity, order.price)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingOrderId(order.id)}
                      aria-label={`Edit order from ${formatOrderDate(order.orderDate)}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
                {order.type === 'SELL' && order.averagePriceAtSell !== null && (() => {
                  const qty = parseFloat(order.quantity);
                  const sellPrice = parseFloat(order.price);
                  const pm = parseFloat(order.averagePriceAtSell!);
                  const totalSold = qty * sellPrice;
                  const totalInvestedAtSell = calculateSellTotalInvested(qty, pm);
                  const profit = calculateSellProfit(totalSold, totalInvestedAtSell);
                  const profitColor =
                    profit === null
                      ? 'text-muted-foreground'
                      : profit > 0
                      ? 'text-green-600 dark:text-green-400'
                      : profit < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-foreground';
                  const colSpan = isTreasury ? 7 : 6;
                  return (
                    <TableRow key={`${order.id}-sell-detail`} className="bg-muted/30 hover:bg-muted/40">
                      <TableCell colSpan={colSpan} className="py-1">
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-2 text-xs text-muted-foreground">
                          <span>
                            PM: <span className="font-medium text-foreground">R$ {pm.toFixed(2)}</span>
                          </span>
                          <span>
                            Investido: <span className="font-medium text-foreground">
                              R$ {totalInvestedAtSell !== null ? totalInvestedAtSell.toFixed(2) : '—'}
                            </span>
                          </span>
                          <span>
                            Vendido: <span className="font-medium text-foreground">R$ {totalSold.toFixed(2)}</span>
                          </span>
                          <span>
                            Lucro:{' '}
                            <span className={`font-semibold ${profitColor}`}>
                              {profit !== null
                                ? `${profit >= 0 ? '+' : ''}R$ ${profit.toFixed(2)}`
                                : '—'}
                            </span>
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })()}
              </React.Fragment>
            ),
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Props & main component ───────────────────────────────────────────────────

interface OrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment: InvestmentListItem | null;
}

/**
 * Modal for adding orders and viewing/editing order history for a specific investment.
 *
 * - Top section: form to add a BUY or SELL order with Zod validation
 * - Bottom section: full order history table with inline row editing
 * - Success/error toasts on order creation and update
 * - Error state on history fetch failure (no stale data shown — Req 5.4)
 *
 * Renders null when no investment is selected.
 *
 * @example
 * <OrderModal
 *   open={orderModalOpen}
 *   onOpenChange={setOrderModalOpen}
 *   investment={selectedInvestment}
 * />
 */
export function OrderModal({
  open,
  onOpenChange,
  investment,
}: OrderModalProps): React.JSX.Element | null {
  if (!investment) return null;

  const isTreasury = investment.type === 'TREASURY';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle>
            Orders — {isTreasury && investment.treasuryProductName
              ? investment.treasuryProductName
              : investment.ticker}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-2">
          {/* Add order form */}
          <OrderForm
            investmentId={investment.id}
            isTreasury={isTreasury}
            onSuccess={() => {
              // History auto-refreshes via query invalidation in useCreateOrder
            }}
          />

          {/* Order history */}
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">Order History</h3>
            <OrderHistory investmentId={investment.id} isTreasury={isTreasury} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
