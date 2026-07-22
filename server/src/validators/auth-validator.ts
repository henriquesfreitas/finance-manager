import { z } from 'zod';

/**
 * Zod schema for login input validation.
 * Username: 3–50 characters. Password: 8–128 characters.
 *
 * @example
 *   loginInputSchema.parse({ username: 'admin', password: 'secret123' })
 *   // → { username: 'admin', password: 'secret123' }
 */
export const loginInputSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(128),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

/**
 * Parses and validates raw login input.
 * Returns a discriminated-union result to avoid try/catch at the call site.
 *
 * @example
 *   const result = validateLoginInput({ username: 'admin', password: 'secret123' });
 *   if (result.success) { ... result.data.username ... }
 *   else { ... result.errors.issues ... }
 */
export function validateLoginInput(
  data: unknown,
): { success: true; data: LoginInput } | { success: false; errors: z.ZodError } {
  const parsed = loginInputSchema.safeParse(data);

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  return { success: false, errors: parsed.error };
}
