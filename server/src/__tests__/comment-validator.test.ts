import { describe, it, expect } from 'vitest';
import { validateCreateCommentInput, validateUpdateCommentInput } from '../validators/comment-validator.js';

describe('validateCreateCommentInput', () => {
  // ─── Valid inputs ─────────────────────────────────────────────────────────

  it('accepts a valid comment', () => {
    const result = validateCreateCommentInput({ content: 'Strong earnings this quarter.' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.content).toBe('Strong earnings this quarter.');
  });

  it('accepts comment at exactly 1 character', () => {
    const result = validateCreateCommentInput({ content: 'A' });
    expect(result.success).toBe(true);
  });

  it('accepts comment at exactly 2000 characters', () => {
    const content = 'x'.repeat(2000);
    const result = validateCreateCommentInput({ content });
    expect(result.success).toBe(true);
  });

  // ─── Invalid inputs ───────────────────────────────────────────────────────

  it('rejects empty content', () => {
    const result = validateCreateCommentInput({ content: '' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['content']).toBeDefined();
    expect(result.errors['content']?.[0]).toContain('empty');
  });

  it('rejects content exceeding 2000 characters', () => {
    const content = 'x'.repeat(2001);
    const result = validateCreateCommentInput({ content });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['content']).toBeDefined();
    expect(result.errors['content']?.[0]).toContain('2000');
  });

  it('rejects missing content field', () => {
    const result = validateCreateCommentInput({});
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['content']).toBeDefined();
  });

  it('rejects non-string content', () => {
    const result = validateCreateCommentInput({ content: 123 });
    expect(result.success).toBe(false);
  });
});

describe('validateUpdateCommentInput', () => {
  it('accepts a valid updated content', () => {
    const result = validateUpdateCommentInput({ content: 'Updated note.' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.content).toBe('Updated note.');
  });

  it('rejects empty content', () => {
    const result = validateUpdateCommentInput({ content: '' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['content']).toBeDefined();
  });

  it('rejects content exceeding 2000 characters', () => {
    const content = 'y'.repeat(2001);
    const result = validateUpdateCommentInput({ content });
    expect(result.success).toBe(false);
  });

  it('rejects missing content', () => {
    const result = validateUpdateCommentInput({});
    expect(result.success).toBe(false);
  });
});
