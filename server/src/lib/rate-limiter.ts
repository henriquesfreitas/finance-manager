/**
 * In-memory rate limiter for login attempt tracking.
 * Isolated in lib/ so business logic never depends on the Map directly —
 * tests can swap the factory for a fake without touching service code.
 *
 * @example
 *   const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 900_000, lockoutMs: 900_000 });
 *   if (limiter.isLimited(clientIp)) return res.status(429).json({ error: '...' });
 *   limiter.recordAttempt(clientIp);
 */

export interface RateLimiterConfig {
  maxAttempts: number; // 5
  windowMs: number;    // 15 * 60 * 1000
  lockoutMs: number;   // 15 * 60 * 1000
}

export interface RateLimiter {
  isLimited(key: string): boolean;
  recordAttempt(key: string): void;
  reset(key: string): void;
}

interface AttemptRecord {
  count: number;
  firstAttemptAt: number; // Date.now()
  lockedUntil: number | null;
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  const store = new Map<string, AttemptRecord>();

  function isLimited(key: string): boolean {
    const record = store.get(key);
    if (!record) return false;

    // Active lockout: still within the lockout window
    if (record.lockedUntil !== null && Date.now() < record.lockedUntil) return true;

    // Stale window (no active lockout): clear the record so the next call starts fresh
    if (record.lockedUntil === null && Date.now() - record.firstAttemptAt > config.windowMs) {
      store.delete(key);
    }

    return false;
  }

  function recordAttempt(key: string): void {
    const now = Date.now();
    const existing = store.get(key);

    // Window expired and not locked — treat as a fresh start
    if (existing && existing.lockedUntil === null && now - existing.firstAttemptAt > config.windowMs) {
      store.delete(key);
    }

    const record = store.get(key) ?? { count: 0, firstAttemptAt: now, lockedUntil: null };
    record.count += 1;

    if (record.count >= config.maxAttempts) {
      record.lockedUntil = now + config.lockoutMs;
    }

    store.set(key, record);
  }

  function reset(key: string): void {
    store.delete(key);
  }

  return { isLimited, recordAttempt, reset };
}
