import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS class names using clsx + tailwind-merge.
 * Use this everywhere class names need to be conditionally combined
 * so conflicting Tailwind utilities are resolved correctly.
 *
 * @example cn('px-2 py-1', condition && 'bg-red-500', 'py-2') → 'px-2 bg-red-500 py-2'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a quantity for display — shows up to 8 decimal places but trims
 * trailing zeros. Whole numbers show with no decimals.
 *
 * Uses pt-BR locale for thousand separators when the integer part is large.
 *
 * @example formatQuantity(100)        → "100"
 * @example formatQuantity(0.00345)    → "0,00345"
 * @example formatQuantity(1100.5)     → "1.100,5"
 * @example formatQuantity(0.00000001) → "0,00000001"
 */
export function formatQuantity(value: number): string {
  if (value === 0) return '0';

  // Format with up to 8 decimals, trimming trailing zeros
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
}
