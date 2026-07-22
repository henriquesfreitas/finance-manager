import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRateLimiter } from '../lib/rate-limiter.js';

const CONFIG = { maxAttempts: 5, windowMs: 900_000, lockoutMs: 900_000 };

afterEach(() => {
  vi.useRealTimers();
});

// ─── isLimited ────────────────────────────────────────────────────────────────

describe('isLimited', () => {
  it('returns false for a key with no recorded attempts', () => {
    const limiter = createRateLimiter(CONFIG);
    expect(limiter.isLimited('1.2.3.4')).toBe(false);
  });

  it('returns false before the attempt threshold is reached', () => {
    const limiter = createRateLimiter(CONFIG);
    for (let i = 0; i < CONFIG.maxAttempts - 1; i++) limiter.recordAttempt('1.2.3.4');
    expect(limiter.isLimited('1.2.3.4')).toBe(false);
  });

  it('returns true after maxAttempts are recorded within the window', () => {
    const limiter = createRateLimiter(CONFIG);
    for (let i = 0; i < CONFIG.maxAttempts; i++) limiter.recordAttempt('1.2.3.4');
    expect(limiter.isLimited('1.2.3.4')).toBe(true);
  });

  it('returns false once the lockout period has elapsed', () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter(CONFIG);
    for (let i = 0; i < CONFIG.maxAttempts; i++) limiter.recordAttempt('1.2.3.4');
    expect(limiter.isLimited('1.2.3.4')).toBe(true);

    vi.advanceTimersByTime(CONFIG.lockoutMs + 1);
    expect(limiter.isLimited('1.2.3.4')).toBe(false);
  });

  it('clears stale records whose window has expired and returns false', () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter(CONFIG);
    // Record attempts below the threshold so no lockout is set
    for (let i = 0; i < CONFIG.maxAttempts - 1; i++) limiter.recordAttempt('1.2.3.4');

    // Advance past the window
    vi.advanceTimersByTime(CONFIG.windowMs + 1);
    expect(limiter.isLimited('1.2.3.4')).toBe(false);
  });

  it('isolates different keys independently', () => {
    const limiter = createRateLimiter(CONFIG);
    for (let i = 0; i < CONFIG.maxAttempts; i++) limiter.recordAttempt('1.1.1.1');
    expect(limiter.isLimited('1.1.1.1')).toBe(true);
    expect(limiter.isLimited('2.2.2.2')).toBe(false);
  });
});

// ─── recordAttempt ────────────────────────────────────────────────────────────

describe('recordAttempt', () => {
  it('sets a lockout exactly at maxAttempts', () => {
    const limiter = createRateLimiter(CONFIG);
    for (let i = 0; i < CONFIG.maxAttempts - 1; i++) limiter.recordAttempt('1.2.3.4');
    expect(limiter.isLimited('1.2.3.4')).toBe(false);

    limiter.recordAttempt('1.2.3.4');
    expect(limiter.isLimited('1.2.3.4')).toBe(true);
  });

  it('resets the counter when the window has expired and is not locked', () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter(CONFIG);
    for (let i = 0; i < CONFIG.maxAttempts - 1; i++) limiter.recordAttempt('1.2.3.4');

    // Window expires — next attempt starts a fresh window
    vi.advanceTimersByTime(CONFIG.windowMs + 1);
    limiter.recordAttempt('1.2.3.4');
    expect(limiter.isLimited('1.2.3.4')).toBe(false);
  });

  it('remains limited after additional attempts during an active lockout', () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter(CONFIG);
    for (let i = 0; i < CONFIG.maxAttempts; i++) limiter.recordAttempt('1.2.3.4');
    expect(limiter.isLimited('1.2.3.4')).toBe(true);

    // Additional attempts during lockout should not unlock the key
    limiter.recordAttempt('1.2.3.4');
    limiter.recordAttempt('1.2.3.4');
    expect(limiter.isLimited('1.2.3.4')).toBe(true);
  });
});

// ─── reset ────────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('clears all attempts so subsequent calls are no longer limited', () => {
    const limiter = createRateLimiter(CONFIG);
    for (let i = 0; i < CONFIG.maxAttempts; i++) limiter.recordAttempt('1.2.3.4');
    expect(limiter.isLimited('1.2.3.4')).toBe(true);

    limiter.reset('1.2.3.4');
    expect(limiter.isLimited('1.2.3.4')).toBe(false);
  });

  it('is idempotent — resetting a key with no record does not throw', () => {
    const limiter = createRateLimiter(CONFIG);
    expect(() => limiter.reset('unknown')).not.toThrow();
  });

  it('allows new attempts to accumulate after reset without ghost counts', () => {
    const limiter = createRateLimiter(CONFIG);
    for (let i = 0; i < CONFIG.maxAttempts; i++) limiter.recordAttempt('1.2.3.4');
    limiter.reset('1.2.3.4');

    // After reset, maxAttempts - 1 new attempts should not trigger a lockout
    for (let i = 0; i < CONFIG.maxAttempts - 1; i++) limiter.recordAttempt('1.2.3.4');
    expect(limiter.isLimited('1.2.3.4')).toBe(false);
  });
});
