import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { validateLoginInput } from '../validators/auth-validator.js';

/**
 * Property 3: Login input validation enforces length boundaries
 * Validates: Requirements 1.3
 *
 * These tests exercise the Zod schema boundaries with arbitrary inputs
 * rather than fixed examples, confirming the validator accepts/rejects
 * the full space of inputs — not just the handful covered by unit tests.
 *
 * Feature: admin-login, Property 3: Login input validation enforces length boundaries
 */
describe('auth-validator — Property 3: Login input validation enforces length boundaries', () => {
  // ─── Generators ────────────────────────────────────────────────────────────

  const validUsername = fc.string({ minLength: 3, maxLength: 50 });
  const validPassword = fc.string({ minLength: 8, maxLength: 128 });

  const tooShortUsername = fc.string({ minLength: 0, maxLength: 2 });
  const tooLongUsername = fc.string({ minLength: 51, maxLength: 200 });

  const tooShortPassword = fc.string({ minLength: 0, maxLength: 7 });
  const tooLongPassword = fc.string({ minLength: 129, maxLength: 300 });

  // ─── P3a: Valid username + valid password → accepted ───────────────────────

  it('P3a: accepts any username in [3, 50] chars combined with any password in [8, 128] chars', () => {
    /**
     * Feature: admin-login, Property 3: Login input validation enforces length boundaries
     * Validates: Requirements 1.3
     */
    fc.assert(
      fc.property(validUsername, validPassword, (username, password) => {
        const result = validateLoginInput({ username, password });
        return result.success === true;
      }),
      { numRuns: 100 },
    );
  });

  // ─── P3b: Too-short username → rejected ────────────────────────────────────

  it('P3b: rejects any username shorter than 3 chars regardless of a valid password', () => {
    /**
     * Feature: admin-login, Property 3: Login input validation enforces length boundaries
     * Validates: Requirements 1.3
     */
    fc.assert(
      fc.property(tooShortUsername, validPassword, (username, password) => {
        const result = validateLoginInput({ username, password });
        return result.success === false;
      }),
      { numRuns: 100 },
    );
  });

  // ─── P3c: Too-long username → rejected ─────────────────────────────────────

  it('P3c: rejects any username longer than 50 chars regardless of a valid password', () => {
    /**
     * Feature: admin-login, Property 3: Login input validation enforces length boundaries
     * Validates: Requirements 1.3
     */
    fc.assert(
      fc.property(tooLongUsername, validPassword, (username, password) => {
        const result = validateLoginInput({ username, password });
        return result.success === false;
      }),
      { numRuns: 100 },
    );
  });

  // ─── P3d: Too-short password → rejected ────────────────────────────────────

  it('P3d: rejects any password shorter than 8 chars regardless of a valid username', () => {
    /**
     * Feature: admin-login, Property 3: Login input validation enforces length boundaries
     * Validates: Requirements 1.3
     */
    fc.assert(
      fc.property(validUsername, tooShortPassword, (username, password) => {
        const result = validateLoginInput({ username, password });
        return result.success === false;
      }),
      { numRuns: 100 },
    );
  });

  // ─── P3e: Too-long password → rejected ─────────────────────────────────────

  it('P3e: rejects any password longer than 128 chars regardless of a valid username', () => {
    /**
     * Feature: admin-login, Property 3: Login input validation enforces length boundaries
     * Validates: Requirements 1.3
     */
    fc.assert(
      fc.property(validUsername, tooLongPassword, (username, password) => {
        const result = validateLoginInput({ username, password });
        return result.success === false;
      }),
      { numRuns: 100 },
    );
  });
});
