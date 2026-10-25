import { z } from 'zod';
import type { PortfolioCommentInput } from '../types/portfolio-comment.js';

const portfolioCommentSchema = z.object({
  content: z.string().trim().min(1, 'comment must not be empty').max(10000, 'comment must be at most 10000 characters'),
});

function flattenErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join('.') || '_root';
    (errors[field] ??= []).push(issue.message);
  }
  return errors;
}

export function validatePortfolioCommentInput(raw: unknown):
  | { success: true; data: PortfolioCommentInput }
  | { success: false; errors: Record<string, string[]> } {
  const parsed = portfolioCommentSchema.safeParse(raw);
  if (parsed.success) return { success: true, data: parsed.data };
  return { success: false, errors: flattenErrors(parsed.error) };
}
