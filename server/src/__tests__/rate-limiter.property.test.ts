/**
 * Property-based tests for the rate limiter.
 *
 * Feature: admin-login, Property 4: Rate limiter locks after threshold
 * Validates: Requirements 1.6
 *
 * Property under test:
 *   For any sequence of N consecutive failed login attempts (N ≥ 5) from the
 *   same client IP within a 15-minute window, the rate limiter SHALL report the
 *   client as locked and reject further attempts regardless of credential validity.
 *
 *   Inverse: For any N < 5 attempts, the rate limiter SHALL NOT lock the client.
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { createRateLimiter } from '../lib/rate-limiter.js';

const CONFIG = { maxAttempts: 5, windowMs: 900_000, lockoutMs: 900_000 };

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates IP-like strings of length 7–15.
 * Keeps the key space realistic without requiring valid IPv4 format —
 * the rate limiter treats keys as opaque strings.
 */
const ipArb = fc.string({ minLength: 7, maxLength: 15 });

/** Generates attempt counts that cross the lockout threshold (N ≥ 5). */
const attemptsAtOrAboveThresholdArb = fc.integer({ min: 5, max: 20 });

/** Generates attempt counts that stay below the lockout threshold (1 ≤ N < 5). */
const attemptsBelowThresholdArb = fc.integer({ min: 1, max: 4 });

// ─── Property 4: Rate limiter locks after threshold ───────────────────────────

describe('Property 4: Rate limiter locks after threshold', () => {
  /**
   * For any IP and any N ≥ 5, recording N attempts on a fresh limiter
   * must result in isLimited returning true.
   */
  it('locks the client after N ≥ 5 consecutive attempts', () => {
    fc.assert(
      fc.property(ipArb, attemptsAtOrAboveThresholdArb, (ip, n) => {
        const limiter = createRateLimiter(CONFIG);

        for (let i = 0; i < n; i++) {
          limiter.recordAttempt(ip);
        }

        return limiter.isLimited(ip) === true;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Inverse: For any IP and any N < 5, recording N attempts on a fresh limiter
   * must NOT trigger a lockout.
   */
  it('does NOT lock the client when fewer than 5 attempts are recorded', () => {
    fc.assert(
      fc.property(ipArb, attemptsBelowThresholdArb, (ip, n) => {
        const limiter = createRateLimiter(CONFIG);

        for (let i = 0; i < n; i++) {
          limiter.recordAttempt(ip);
        }

        return limiter.isLimited(ip) === false;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Key isolation: locking one IP must not affect a different IP.
   * For any two distinct IPs, exhausting attempts on one should leave the other unlocked.
   */
  it('lockout on one IP does not affect a different IP', () => {
    fc.assert(
      fc.property(
        ipArb,
        ipArb,
        attemptsAtOrAboveThresholdArb,
        (ipA, ipB, n) => {
          // When both IPs are identical this property degenerates — skip it.
          fc.pre(ipA !== ipB);

          const limiter = createRateLimiter(CONFIG);

          for (let i = 0; i < n; i++) {
            limiter.recordAttempt(ipA);
          }

          return limiter.isLimited(ipA) === true && limiter.isLimited(ipB) === false;
        },
      ),
      { numRuns: 100 },
    );
  });
});
