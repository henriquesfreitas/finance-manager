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
