import { z } from 'zod';
import type { CreateCommentInput, UpdateCommentInput } from '../types/comment.js';

const contentSchema = z
  .string()
  .min(1, 'comment must not be empty')
  .max(2000, 'comment must be at most 2000 characters');

/**
 * Zod schema for creating a comment.
 *
 * @example
 *   createCommentSchema.parse({ content: 'Strong earnings this quarter.' })
 */
export const createCommentSchema = z.object({
  content: contentSchema,
});

/**
 * Zod schema for updating a comment.
 *
 * @example
 *   updateCommentSchema.parse({ content: 'Updated note.' })
 */
export const updateCommentSchema = z.object({
  content: contentSchema,
});

function flattenErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join('.') || '_root';
    (errors[field] ??= []).push(issue.message);
  }
  return errors;
}

export function validateCreateCommentInput(raw: unknown):
  | { success: true; data: CreateCommentInput }
  | { success: false; errors: Record<string, string[]> } {
  const parsed = createCommentSchema.safeParse(raw);
  if (parsed.success) return { success: true, data: parsed.data };
  return { success: false, errors: flattenErrors(parsed.error) };
}

export function validateUpdateCommentInput(raw: unknown):
  | { success: true; data: UpdateCommentInput }
  | { success: false; errors: Record<string, string[]> } {
  const parsed = updateCommentSchema.safeParse(raw);
  if (parsed.success) return { success: true, data: parsed.data };
  return { success: false, errors: flattenErrors(parsed.error) };
}
