import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { createAuthService } from '../services/auth-service.js';

// ─── Shared hash ─────────────────────────────────────────────────────────────

// Computed once with low cost for speed. All "valid password" scenarios use this.
let REAL_HASH: string;
const REAL_PASSWORD = 'ValidPass1!';

beforeAll(async () => {
  REAL_HASH = await bcrypt.hash(REAL_PASSWORD, 4);
});

// ─── Fake Prisma builder ──────────────────────────────────────────────────────

function makeFakePrisma(overrides: {
  adminUserFindUnique?: ReturnType<typeof vi.fn>;
  adminSessionCreate?: ReturnType<typeof vi.fn>;
  adminSessionFindUnique?: ReturnType<typeof vi.fn>;
  adminSessionUpdate?: ReturnType<typeof vi.fn>;
  adminSessionDelete?: ReturnType<typeof vi.fn>;
} = {}): PrismaClient {
  return {
    adminUser: {
      findUnique: overrides.adminUserFindUnique ?? vi.fn().mockResolvedValue(null),
    },
    adminSession: {
      create: overrides.adminSessionCreate ?? vi.fn().mockResolvedValue({}),
      findUnique: overrides.adminSessionFindUnique ?? vi.fn().mockResolvedValue(null),
      update: overrides.adminSessionUpdate ?? vi.fn().mockResolvedValue({}),
      delete: overrides.adminSessionDelete ?? vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaClient;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Safe ASCII username: 3–50 characters (alphanumeric + underscore to avoid injection noise). */
const arbUsername = fc.stringMatching(/^[a-zA-Z0-9_]{3,50}$/);

/** Unique IP per run to prevent rate-limiter state from bleeding between iterations. */
const arbIp = fc.uuid().map((id) => `10.${id.slice(0, 3).split('').map(Number).filter(Boolean).join('.') || '0.0.1'}`);

/** Arbitrary non-empty hex token string (simulates session tokens in DB). */
const arbToken = fc.string({ minLength: 16, maxLength: 128, unit: fc.constantFrom(...'0123456789abcdef'.split('')) });

// ─── Property 1: Token issuance produces secure tokens ───────────────────────
// Validates: Requirements 1.1, 2.1

describe('Property 1: Token issuance produces secure tokens', () => {
  it(
    'Feature: admin-login, Property 1: token is 64-char hex and session stored with ~7-day expiry',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbUsername, arbIp, async (username, ip) => {
          const sessionCreate = vi.fn().mockResolvedValue({});
          const db = makeFakePrisma({
            adminUserFindUnique: vi.fn().mockResolvedValue({
              id: `user-${username}`,
              username,
              passwordHash: REAL_HASH,
            }),
            adminSessionCreate: sessionCreate,
          });

          const svc = createAuthService({ db });
          // Clear any accumulated rate-limit state for this IP
          svc.clearFailedAttempts(ip);

          const before = Date.now();
          const result = await svc.authenticate(username, REAL_PASSWORD, ip);
          const after = Date.now();

          // Token must be a 64-character hex string (256-bit opaque token)
          expect(result.token).toMatch(/^[0-9a-f]{64}$/);
          expect(result.adminId).toBe(`user-${username}`);

          // Session create must have been called exactly once
          expect(sessionCreate).toHaveBeenCalledOnce();
          const callArg = sessionCreate.mock.calls[0]?.[0] as {
            data: { token: string; adminId: string; expiresAt: Date };
          };

          // Token in DB must match returned token
          expect(callArg.data.token).toBe(result.token);

          // expiresAt must be approximately 7 days in the future (±2s tolerance)
          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
          const expiresMs = callArg.data.expiresAt.getTime();
          expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs - 2000);
          expect(expiresMs).toBeLessThanOrEqual(after + sevenDaysMs + 2000);
        }),
        { numRuns: 50 },
      );
    },
  );
});

// ─── Property 2: Invalid credentials produce identical error responses ────────
// Validates: Requirements 1.2

describe('Property 2: Invalid credentials produce identical error responses', () => {
  it(
    'Feature: admin-login, Property 2: wrong username and wrong password yield the same error',
    async () => {
      // Pre-compute a hash for a different password (always wrong when compared to REAL_PASSWORD)
      const wrongHash = await bcrypt.hash('completely-different-secret-99', 4);

      await fc.assert(
        fc.asyncProperty(arbUsername, arbUsername, arbIp, arbIp, async (username1, username2, ip1, ip2) => {
          // Scenario A: username does not exist in DB
          const dbNoUser = makeFakePrisma({
            adminUserFindUnique: vi.fn().mockResolvedValue(null),
          });
          const svcA = createAuthService({ db: dbNoUser });
          svcA.clearFailedAttempts(ip1);

          // Scenario B: username exists but password is wrong
          const dbWrongPw = makeFakePrisma({
            adminUserFindUnique: vi.fn().mockResolvedValue({
              id: 'user-exists',
              username: username2,
              passwordHash: wrongHash,
            }),
          });
          const svcB = createAuthService({ db: dbWrongPw });
          svcB.clearFailedAttempts(ip2);

          const errA = await svcA
            .authenticate(username1, REAL_PASSWORD, ip1)
            .catch((e: Error) => e.message);
          const errB = await svcB
            .authenticate(username2, REAL_PASSWORD, ip2)
            .catch((e: Error) => e.message);

          // Both scenarios must throw exactly the same generic message
          expect(errA).toBe('Invalid credentials');
          expect(errB).toBe('Invalid credentials');
          expect(errA).toBe(errB);
        }),
        { numRuns: 50 },
      );
    },
  );
});

// ─── Property 5: Session validation refreshes expiration (sliding window) ─────
// Validates: Requirements 2.2

describe('Property 5: Session validation refreshes expiration (sliding window)', () => {
  it(
    'Feature: admin-login, Property 5: validateSession updates expiresAt to ~7 days from now',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbToken, async (token) => {
          const sessionUpdate = vi.fn().mockResolvedValue({});
          const db = makeFakePrisma({
            adminSessionFindUnique: vi.fn().mockResolvedValue({
              id: 'session-id',
              token,
              adminId: 'admin-1',
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // valid, not expired
              createdAt: new Date(),
              admin: { id: 'admin-1' },
            }),
            adminSessionUpdate: sessionUpdate,
          });

          const svc = createAuthService({ db });

          const before = Date.now();
          const result = await svc.validateSession(token);
          const after = Date.now();

          // Must return adminId for a valid session
          expect(result).toEqual({ adminId: 'admin-1' });

          // Update must have been called once to refresh the sliding window
          expect(sessionUpdate).toHaveBeenCalledOnce();
          const updateArg = sessionUpdate.mock.calls[0]?.[0] as {
            where: { token: string };
            data: { expiresAt: Date };
          };

          // The update must target the correct token
          expect(updateArg.where.token).toBe(token);

          // New expiresAt must be approximately 7 days in the future (±2s)
          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
          const newExpiry = updateArg.data.expiresAt.getTime();
          expect(newExpiry).toBeGreaterThanOrEqual(before + sevenDaysMs - 2000);
          expect(newExpiry).toBeLessThanOrEqual(after + sevenDaysMs + 2000);
        }),
        { numRuns: 50 },
      );
    },
  );
});

// ─── Property 11: Logout invalidates session completely ──────────────────────
// Validates: Requirements 5.2

describe('Property 11: Logout invalidates session completely', () => {
  it(
    'Feature: admin-login, Property 11: invalidateSession deletes the session record by token',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbToken, async (token) => {
          const sessionDelete = vi.fn().mockResolvedValue({});
          const db = makeFakePrisma({ adminSessionDelete: sessionDelete });

          const svc = createAuthService({ db });
          await svc.invalidateSession(token);

          // Delete must have been called exactly once with the correct token
          expect(sessionDelete).toHaveBeenCalledOnce();
          expect(sessionDelete).toHaveBeenCalledWith({ where: { token } });
        }),
        { numRuns: 50 },
      );
    },
  );
});

// ─── Property 12: Password hash never appears in outputs ─────────────────────
// Validates: Requirements 6.5

describe('Property 12: Password hash never appears in outputs', () => {
  it(
    'Feature: admin-login, Property 12: successful login result does not contain the password hash',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbUsername, arbIp, async (username, ip) => {
          const db = makeFakePrisma({
            adminUserFindUnique: vi.fn().mockResolvedValue({
              id: `user-${username}`,
              username,
              passwordHash: REAL_HASH,
            }),
            adminSessionCreate: vi.fn().mockResolvedValue({}),
          });

          const svc = createAuthService({ db });
          svc.clearFailedAttempts(ip);

          const result = await svc.authenticate(username, REAL_PASSWORD, ip) as Record<string, unknown>;
          const serialized = JSON.stringify(result);

          // The returned object must not have a passwordHash key
          expect(result).not.toHaveProperty('passwordHash');
          // The serialized output must not contain the literal hash value
          expect(serialized).not.toContain(REAL_HASH);
          // Must also not contain the field name as a key
          expect(serialized).not.toContain('passwordHash');
        }),
        { numRuns: 50 },
      );
    },
  );

  it(
    'Feature: admin-login, Property 12: failed login error does not contain the password hash',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbUsername, arbIp, async (username, ip) => {
          // User exists (has a real hash) but the supplied password is wrong
          const wrongHash = await bcrypt.hash('wrong-pass-for-property-12', 4);
          const db = makeFakePrisma({
            adminUserFindUnique: vi.fn().mockResolvedValue({
              id: `user-${username}`,
              username,
              passwordHash: wrongHash,
            }),
          });

          const svc = createAuthService({ db });
          svc.clearFailedAttempts(ip);

          const error = await svc
            .authenticate(username, 'this-will-not-match', ip)
            .catch((e: Error) => e);

          expect(error).toBeInstanceOf(Error);
          const errorMessage = (error as Error).message;

          // Error message must not expose the hash
          expect(errorMessage).not.toContain(wrongHash);
          expect(errorMessage).not.toContain('passwordHash');
        }),
        { numRuns: 50 },
      );
    },
  );
});
