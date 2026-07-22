import { describe, it, expect } from 'vitest';
import { validateLoginInput } from '../validators/auth-validator.js';

describe('validateLoginInput', () => {
  // ─── Valid inputs ───────────────────────────────────────────────────────────

  it('accepts username and password at minimum lengths', () => {
    const result = validateLoginInput({ username: 'abc', password: '12345678' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.username).toBe('abc');
    expect(result.data.password).toBe('12345678');
  });

  it('accepts username and password at maximum lengths', () => {
    const username = 'a'.repeat(50);
    const password = 'b'.repeat(128);
    const result = validateLoginInput({ username, password });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.username).toBe(username);
    expect(result.data.password).toBe(password);
  });

  it('accepts a typical username and password', () => {
    const result = validateLoginInput({ username: 'admin', password: 'SecureP@ss123' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.username).toBe('admin');
  });

  // ─── Username — too short ───────────────────────────────────────────────────

  it('rejects username shorter than 3 characters', () => {
    const result = validateLoginInput({ username: 'ab', password: '12345678' });

    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.errors.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('username');
  });

  it('rejects empty username', () => {
    const result = validateLoginInput({ username: '', password: '12345678' });

    expect(result.success).toBe(false);
  });

  // ─── Username — too long ────────────────────────────────────────────────────

  it('rejects username longer than 50 characters', () => {
    const result = validateLoginInput({ username: 'a'.repeat(51), password: '12345678' });

    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.errors.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('username');
  });

  // ─── Password — too short ───────────────────────────────────────────────────

  it('rejects password shorter than 8 characters', () => {
    const result = validateLoginInput({ username: 'admin', password: '1234567' });

    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.errors.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('password');
  });

  it('rejects empty password', () => {
    const result = validateLoginInput({ username: 'admin', password: '' });

    expect(result.success).toBe(false);
  });

  // ─── Password — too long ────────────────────────────────────────────────────

  it('rejects password longer than 128 characters', () => {
    const result = validateLoginInput({ username: 'admin', password: 'x'.repeat(129) });

    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.errors.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('password');
  });

  // ─── Missing / wrong type ───────────────────────────────────────────────────

  it('rejects missing username field', () => {
    const result = validateLoginInput({ password: '12345678' });

    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.errors.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('username');
  });

  it('rejects missing password field', () => {
    const result = validateLoginInput({ username: 'admin' });

    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.errors.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('password');
  });

  it('rejects non-string username', () => {
    const result = validateLoginInput({ username: 123, password: '12345678' });

    expect(result.success).toBe(false);
  });

  it('rejects null input', () => {
    const result = validateLoginInput(null);

    expect(result.success).toBe(false);
  });

  // ─── Error shape ────────────────────────────────────────────────────────────

  it('returns a ZodError with issues on failure', () => {
    const result = validateLoginInput({ username: 'ab', password: 'short' });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.issues.length).toBeGreaterThan(0);
  });

  it('reports both username and password errors when both are invalid', () => {
    const result = validateLoginInput({ username: 'ab', password: 'short' });

    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.errors.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('username');
    expect(paths).toContain('password');
  });
});
