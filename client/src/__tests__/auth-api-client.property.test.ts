/**
 * Property-Based Tests — Auth API Client
 * Feature: admin-login, Property 10: 401 response triggers auth cleanup
 *
 * Validates: Requirements 4.3
 *
 * These tests verify that the auth API client correctly propagates arbitrary
 * 401 error messages by throwing an Error whose message matches the server's
 * `error` field. This is the foundation that enables the auth context to
 * detect 401s and perform cleanup/redirect.
 */

import * as fc from 'fast-check';
import { vi, describe, it, afterEach } from 'vitest';
import { login, logout, fetchCurrentAdmin } from '../services/auth-api-client';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Arbitrary non-empty error message strings, representing any server error
 * payload the backend might return in the `error` field.
 */
const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 });

// ─── Mock helpers ────────────────────────────────────────────────────────────

/**
 * Stubs global `fetch` to return a 401 response with the given error message
 * as the JSON body's `error` field — simulating a server auth rejection.
 */
function mock401(errorMessage: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ error: errorMessage }),
    }),
  );
}

// ─── Teardown ────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Property 10: 401 response triggers error with server message ─────────────

/**
 * **Property 10: 401 response triggers auth cleanup**
 * **Validates: Requirements 4.3**
 *
 * For any HTTP 401 response body containing an arbitrary `error` string,
 * all three auth API functions SHALL throw an Error whose message exactly
 * matches the server-provided error message.
 *
 * This ensures the auth context layer can reliably detect 401s and dispatch
 * the appropriate cleanup/redirect actions.
 */
describe('Property 10: 401 response triggers error with server message', () => {
  it('login propagates arbitrary 401 error messages', async () => {
    await fc.assert(
      fc.asyncProperty(errorMessageArb, async (errorMessage) => {
        mock401(errorMessage);
        await expect(login('user', 'pass')).rejects.toThrow(errorMessage);
        vi.unstubAllGlobals();
      }),
      { numRuns: 100 },
    );
  });

  it('logout propagates arbitrary 401 error messages', async () => {
    await fc.assert(
      fc.asyncProperty(errorMessageArb, async (errorMessage) => {
        mock401(errorMessage);
        await expect(logout()).rejects.toThrow(errorMessage);
        vi.unstubAllGlobals();
      }),
      { numRuns: 100 },
    );
  });

  it('fetchCurrentAdmin propagates arbitrary 401 error messages', async () => {
    await fc.assert(
      fc.asyncProperty(errorMessageArb, async (errorMessage) => {
        mock401(errorMessage);
        await expect(fetchCurrentAdmin()).rejects.toThrow(errorMessage);
        vi.unstubAllGlobals();
      }),
      { numRuns: 100 },
    );
  });
});
