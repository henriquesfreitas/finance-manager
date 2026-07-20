import { z } from 'zod';
import type { CreateOrderInput, UpdateOrderInput } from '../types/order.js';

/**
 * Zod schema for creating an order.
 * Validates order type, positive quantity/price, and an ISO date that is
 * not in the future. The date is validated against `new Date()` at parse
 * time, so "today" is always accepted regardless of timezone.
 *
 * @example
 *   createOrderSchema.parse({ type: 'BUY', quantity: 100, price: 28.35, orderDate: '2024-01-15' })
 *   // → { type: 'BUY', quantity: 100, price: 28.35, orderDate: '2024-01-15' }
 */
export const createOrderSchema = z.object({
  type: z.enum(['BUY', 'SELL', 'BONUS', 'SPLIT']),

  quantity: z
    .number()
    .positive('quantity must be greater than 0'),

  price: z
    .number()
    .min(0, 'price must be 0 or greater'),

  orderDate: z
    .string()
    .date()
    .refine(
      (d) => {
        const today = new Date().toLocaleDateString('en-CA');
        return d <= today;
      },
      'order date must not be in the future',
    ),

  // Contracted rate at purchase time — optional, treasury-only (e.g. 6.5 for IPCA+ 6.5%)
  contractedRate: z
    .number()
    .positive('contractedRate must be greater than 0')
    .nullable()
    .optional(),

  // PM snapshot at sell time — if omitted on create, the service auto-computes it.
  // Accepted here so callers can override the auto-computed value if needed.
  averagePriceAtSell: z
    .number()
    .positive('averagePriceAtSell must be greater than 0')
    .nullable()
    .optional(),
}).superRefine((data, ctx) => {
  if (data.type !== 'SPLIT' && data.price <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'price must be greater than 0',
      path: ['price'],
    });
  }
});

export type CreateOrderSchemaInput = z.input<typeof createOrderSchema>;

/**
 * Parses and validates raw order creation input.
 * Returns a discriminated-union result to avoid try/catch at the call site.
 *
 * @example
 *   const result = validateCreateOrderInput({ type: 'BUY', quantity: 100, price: 28.35, orderDate: '2024-01-15' });
 *   if (result.success) { ... result.data ... }
 *   else { ... result.errors // { quantity: ['quantity must be greater than 0'] } ... }
 */
export function validateCreateOrderInput(raw: unknown):
  | { success: true; data: CreateOrderInput }
  | { success: false; errors: Record<string, string[]> } {
  const parsed = createOrderSchema.safeParse(raw);

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  // Flatten ZodError into a field→messages map for consistent API error shape
  const errors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path.join('.') || '_root';
    (errors[field] ??= []).push(issue.message);
  }
  return { success: false, errors };
}

/**
 * Zod schema for updating an existing order.
 * All fields are optional — only the provided fields will be updated.
 * Same constraints as createOrderSchema apply to each field.
 *
 * @example
 *   updateOrderSchema.parse({ price: 30.00 })
 *   // → { price: 30.00 }
 */
export const updateOrderSchema = z.object({
  type: z.enum(['BUY', 'SELL', 'BONUS', 'SPLIT']).optional(),

  quantity: z
    .number()
    .positive('quantity must be greater than 0')
    .optional(),

  price: z
    .number()
    .min(0, 'price must be 0 or greater')
    .optional(),

  orderDate: z
    .string()
    .date()
    .refine(
      (d) => {
        const today = new Date().toLocaleDateString('en-CA');
        return d <= today;
      },
      'order date must not be in the future',
    )
    .optional(),

  // Pass null to clear a previously recorded rate
  contractedRate: z
    .number()
    .positive('contractedRate must be greater than 0')
    .nullable()
    .optional(),

  // PM snapshot — user can edit or clear after creation
  averagePriceAtSell: z
    .number()
    .positive('averagePriceAtSell must be greater than 0')
    .nullable()
    .optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  'at least one field must be provided for update',
);

export type UpdateOrderSchemaInput = z.input<typeof updateOrderSchema>;

/**
 * Parses and validates raw order update input.
 * Returns a discriminated-union result to avoid try/catch at the call site.
 *
 * @example
 *   const result = validateUpdateOrderInput({ price: 30.00 });
 *   if (result.success) { ... result.data ... }
 */
export function validateUpdateOrderInput(raw: unknown):
  | { success: true; data: UpdateOrderInput }
  | { success: false; errors: Record<string, string[]> } {
  const parsed = updateOrderSchema.safeParse(raw);

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  const errors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path.join('.') || '_root';
    (errors[field] ??= []).push(issue.message);
  }
  return { success: false, errors };
}
