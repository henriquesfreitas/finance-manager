/**
 * Property-based tests for auth middleware.
 *
 * Feature: admin-login
 * Properties covered: 7 (middleware rejects all invalid tokens), 8 (valid token attaches admin identity)
 * Validates: Requirements 2.4, 3.2, 3.3, 3.5, 3.6
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import request from 'supertest';
import express, { type Application } from 'express';
import cookieParser from 'cookie-parser';
import type { AuthService } from '../services/auth-service.js';
import { createAuthMiddleware } from '../middleware/auth-middleware.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFakeAuthService(
  validateSessionImpl?: (token: string) => Promise<{ adminId: string } | null>,
): AuthService {
  return {
    authenticate: vi.fn(),
    validateSession: vi.fn().mockImplementation(validateSessionImpl ?? (() => Promise.resolve(null))),
    invalidateSession: vi.fn(),
    isRateLimited: vi.fn().mockReturnValue(false),
    recordFailedAttempt: vi.fn(),
    clearFailedAttempts: vi.fn(),
  };
}

function buildApp(authService: AuthService): Application {
  // Use the default cookie name so tests are deterministic
  delete process.env['SESSION_COOKIE_NAME'];

  const app = express();
  app.use(cookieParser());
  app.use('/protected', createAuthMiddleware({ authService }));
  app.get('/protected', (req, res) => {
    res.json({ adminId: req.adminId });
  });
  return app;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const HEX_CHARS = '0123456789abcdef'.split('');

/**
 * Generates token strings that must NOT satisfy /^[0-9a-f]{64}$/.
 * Three sub-cases:
 *   1. Too short (0-63 chars) — any chars
 *   2. Too long (65-128 chars) — any chars
 *   3. Exactly 64 chars but contains at least one non-hex character
 */
const invalidTokenArb = fc.oneof(
  // Case 1: too short (includes empty string)
  fc.string({ minLength: 0, maxLength: 63 }),
  // Case 2: too long
  fc.string({ minLength: 65, maxLength: 128 }),
  // Case 3: exactly 64 chars but fails hex check
  fc.string({ minLength: 64, maxLength: 64 }).filter(s => !/^[0-9a-f]{64}$/.test(s)),
);

/**
 * Generates valid 64-char lowercase hex tokens that satisfy /^[0-9a-f]{64}$/.
 */
const validTokenArb = fc.string({
  minLength: 64,
  maxLength: 64,
  unit: fc.constantFrom(...HEX_CHARS),
});

// ─── Property 7: Middleware rejects all invalid tokens ────────────────────────
// Validates: Requirements 2.4, 3.2, 3.3, 3.6

describe('Property 7: Middleware rejects all invalid tokens', () => {
  /**
   * **Validates: Requirements 2.4, 3.2, 3.3, 3.6**
   *
   * For ANY token that doesn't match /^[0-9a-f]{64}$/ (wrong length, non-hex
   * chars, or missing entirely), the middleware must return HTTP 401 with a
   * JSON body that includes an `error` field.
   */
  it('returns 401 with an error field for any malformed token value', async () => {
    const authService = makeFakeAuthService();
    const app = buildApp(authService);

    await fc.assert(
      fc.asyncProperty(invalidTokenArb, async (token) => {
        const res = await request(app)
          .get('/protected')
          .set('Cookie', `finance_session=${token}`);

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
        expect(res.body.error.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 },
    );
  });

  /**
   * **Validates: Requirements 3.2**
   *
   * A completely missing cookie must also result in HTTP 401.
   */
  it('returns 401 with an error field when no cookie is sent at all', async () => {
    const authService = makeFakeAuthService();
    const app = buildApp(authService);

    const res = await request(app).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  /**
   * **Validates: Requirements 3.6**
   *
   * validateSession must never be called for malformed tokens — the middleware
   * must reject before even consulting the service.
   */
  it('does not call validateSession for any malformed token', async () => {
    const authService = makeFakeAuthService();
    const app = buildApp(authService);

    await fc.assert(
      fc.asyncProperty(invalidTokenArb, async (token) => {
        vi.clearAllMocks();

        await request(app)
          .get('/protected')
          .set('Cookie', `finance_session=${token}`);

        // Empty strings won't set a cookie value, but other invalid tokens must
        // not reach validateSession either. For empty/whitespace tokens the
        // cookie may not be sent, but either way validateSession is not called.
        expect(authService.validateSession).not.toHaveBeenCalled();
      }),
      { numRuns: 50 },
    );
  });
});

// ─── Property 8: Valid token attaches admin identity ─────────────────────────
// Validates: Requirements 3.5

describe('Property 8: Valid token attaches admin identity', () => {
  const ADMIN_ID = 'admin-1';

  /**
   * **Validates: Requirements 3.5**
   *
   * For ANY well-formed 64-char lowercase hex token, when validateSession
   * returns a session record, the middleware must:
   *   - respond HTTP 200 (call next())
   *   - attach `adminId` from the session record to req, visible to downstream handlers
   */
  it('calls next() and attaches adminId for any valid hex token', async () => {
    // validateSession always resolves with the admin record for this property
    const authService = makeFakeAuthService(() => Promise.resolve({ adminId: ADMIN_ID }));
    const app = buildApp(authService);

    await fc.assert(
      fc.asyncProperty(validTokenArb, async (token) => {
        const res = await request(app)
          .get('/protected')
          .set('Cookie', `finance_session=${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ adminId: ADMIN_ID });
      }),
      { numRuns: 50 },
    );
  });

  /**
   * **Validates: Requirements 3.5**
   *
   * The adminId attached to the request must be exactly the one returned by
   * validateSession, regardless of which admin is logged in.
   */
  it('attaches exactly the adminId returned by validateSession', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTokenArb,
        fc.string({ minLength: 1, maxLength: 64 }),
        async (token, adminId) => {
          const authService = makeFakeAuthService(() => Promise.resolve({ adminId }));
          const app = buildApp(authService);

          const res = await request(app)
            .get('/protected')
            .set('Cookie', `finance_session=${token}`);

          expect(res.status).toBe(200);
          expect(res.body).toEqual({ adminId });
        },
      ),
      { numRuns: 50 },
    );
  });
});
