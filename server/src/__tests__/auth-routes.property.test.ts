import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import request from 'supertest';
import express, { type Application } from 'express';
import cookieParser from 'cookie-parser';
import type { AuthService } from '../services/auth-service.js';

// ─── Fake auth service ────────────────────────────────────────────────────────

const VALID_TOKEN = 'a'.repeat(64); // 64-char lowercase hex

function makeFakeAuthService(token = VALID_TOKEN): AuthService {
  return {
    authenticate: vi.fn().mockResolvedValue({ token, adminId: 'admin-1' }),
    validateSession: vi.fn().mockResolvedValue(null),
    invalidateSession: vi.fn().mockResolvedValue(undefined),
    isRateLimited: vi.fn().mockReturnValue(false),
    recordFailedAttempt: vi.fn(),
    clearFailedAttempts: vi.fn(),
  };
}

// ─── Test app factory ─────────────────────────────────────────────────────────

const { createAuthRouter } = await import('../routes/auth-routes.js');

function buildApp(authService: AuthService): Application {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', createAuthRouter(authService));
  return app;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Valid username: 3–50 characters (within Zod schema bounds) */
const validUsername = fc.string({ minLength: 3, maxLength: 50 });

/** Valid password: 8–128 characters (within Zod schema bounds) */
const validPassword = fc.string({ minLength: 8, maxLength: 128 });

// ─── Property 6: Cookie contains required security attributes ─────────────────
// Validates: Requirements 2.5

describe('Property 6: Cookie contains required security attributes', () => {
  it(
    'Feature: admin-login, Property 6: Cookie contains required security attributes',
    async () => {
      await fc.assert(
        fc.asyncProperty(validUsername, validPassword, async (username, password) => {
          const authService = makeFakeAuthService();
          const app = buildApp(authService);

          const res = await request(app)
            .post('/api/auth/login')
            .send({ username, password });

          // Only check cookie attributes for successful responses
          expect(res.status).toBe(200);
          expect(res.headers['set-cookie']).toBeDefined();

          const cookie: string = (res.headers['set-cookie'] as string[])[0] ?? '';

          // Req 2.5 — cookie must carry all four required security attributes
          expect(cookie).toContain('HttpOnly');
          expect(cookie).toContain('Secure');
          expect(cookie).toContain('SameSite=Strict');
          expect(cookie).toContain('Max-Age=604800');
        }),
        { numRuns: 100 },
      );
    },
  );
});
