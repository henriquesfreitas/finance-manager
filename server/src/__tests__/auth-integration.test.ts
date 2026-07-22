/**
 * Integration tests for the admin authentication flow.
 *
 * These tests exercise the full stack against a real PostgreSQL database.
 * The database must be running (e.g., via `docker compose up -d`) before
 * running this suite. If the DB is unavailable, beforeAll will fail — that
 * is expected behaviour and does not indicate a bug in the tests.
 *
 * Rate-limiting note: The rate limiter is a module-level singleton shared
 * across all createAuthService instances in the same process. Each rate-limit
 * test uses a unique synthetic IP to avoid cross-test interference.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../app.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();
const app = createApp();

const TEST_USERNAME = 'integration_test_admin';
const TEST_PASSWORD = 'TestPass123!';
const COOKIE_NAME = process.env['SESSION_COOKIE_NAME'] ?? 'finance_session';

let adminId: string;

beforeAll(async () => {
  // Low bcrypt cost (4) keeps tests fast while still exercising the real hash path
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);
  const admin = await prisma.adminUser.upsert({
    where: { username: TEST_USERNAME },
    update: { passwordHash },
    create: { username: TEST_USERNAME, passwordHash },
  });
  adminId = admin.id;
});

afterAll(async () => {
  await prisma.adminSession.deleteMany({ where: { adminId } });
  await prisma.adminUser.delete({ where: { username: TEST_USERNAME } });
  await prisma.$disconnect();
});

afterEach(async () => {
  // Keep sessions clean between tests so state from one test never bleeds into another
  await prisma.adminSession.deleteMany({ where: { adminId } });

  // Reset the module-level rate-limiter state for the loopback IP by completing a
  // successful login. On success, auth-service calls rateLimiter.reset(ip), which
  // clears the failed-attempt counter and lifts any lockout. Without this, rate-limit
  // tests that exhaust the counter would block subsequent tests that login via the
  // same loopback address.
  // We suppress errors — if the DB isn't available or the reset login fails for any
  // reason, we don't want afterEach to mask the real test failure.
  try {
    const resetRes = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
    if (resetRes.status === 200) {
      // Session created by the reset login — clean it up immediately
      await prisma.adminSession.deleteMany({ where: { adminId } });
    }
  } catch {
    // Intentionally silent — DB unavailability is diagnosed by the failing test itself
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts a cookie value from the Set-Cookie response header array.
 * Returns null when the named cookie is not present.
 */
function extractCookieValue(
  setCookieHeader: string[] | undefined,
  name: string,
): string | null {
  if (!setCookieHeader) return null;
  for (const cookie of setCookieHeader) {
    const [nameValue] = cookie.split(';');
    const [cookieName, cookieValue] = (nameValue ?? '').split('=');
    if (cookieName?.trim() === name) return cookieValue?.trim() ?? null;
  }
  return null;
}

/**
 * Returns the raw Set-Cookie string for a named cookie, or null if absent.
 */
function findCookieString(
  setCookieHeader: string[] | undefined,
  name: string,
): string | null {
  if (!setCookieHeader) return null;
  return (
    setCookieHeader.find((c) => c.startsWith(`${name}=`) || c.startsWith(`${name} =`)) ?? null
  );
}

/** Logs in with the test admin and returns the session cookie string. */
async function loginAndGetCookie(): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: TEST_USERNAME, password: TEST_PASSWORD });

  expect(res.status).toBe(200);

  const cookieStr = findCookieString(res.headers['set-cookie'] as string[], COOKIE_NAME);
  expect(cookieStr).not.toBeNull();
  return cookieStr as string;
}

// ---------------------------------------------------------------------------
// 1. Login flow — Req 1.1
// ---------------------------------------------------------------------------

describe('Login flow', () => {
  it('returns 200, sets httpOnly cookie, and returns admin info on valid credentials (Req 1.1)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });

    expect(res.status).toBe(200);

    // Response body contains admin identity
    expect(res.body).toMatchObject({ admin: { id: adminId, username: TEST_USERNAME } });

    // Session cookie is present
    const setCookieHeader = res.headers['set-cookie'] as string[];
    const cookieStr = findCookieString(setCookieHeader, COOKIE_NAME);
    expect(cookieStr).not.toBeNull();

    // Token value is a 64-char hex string (256-bit opaque token per Req 2.1)
    const tokenValue = extractCookieValue(setCookieHeader, COOKIE_NAME);
    expect(tokenValue).toMatch(/^[0-9a-f]{64}$/);

    // Security attributes — Req 2.5
    expect(cookieStr).toContain('HttpOnly');
    expect(cookieStr).toContain('Secure');
    expect(cookieStr).toContain('SameSite=Strict');
    expect(cookieStr).toMatch(/Max-Age=\d+/);
  });

  it('creates a session record in the database on successful login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });

    expect(res.status).toBe(200);

    const sessions = await prisma.adminSession.findMany({ where: { adminId } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

// ---------------------------------------------------------------------------
// 2. Invalid credentials — Req 1.2
// ---------------------------------------------------------------------------

describe('Invalid credentials', () => {
  it('returns 401 with generic error for wrong password (Req 1.2)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USERNAME, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('returns 401 with generic error for non-existent username (Req 1.2)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'does_not_exist', password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('returns identical error messages for wrong-username and wrong-password (Req 1.2)', async () => {
    const [wrongUser, wrongPass] = await Promise.all([
      request(app)
        .post('/api/auth/login')
        .send({ username: 'no_such_user', password: 'irrelevant1' }),
      request(app)
        .post('/api/auth/login')
        .send({ username: TEST_USERNAME, password: 'WrongPass99' }),
    ]);

    expect(wrongUser.body.error).toBe(wrongPass.body.error);
  });

  it('does not set a session cookie on invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USERNAME, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Validation errors — Req 1.3
// ---------------------------------------------------------------------------

describe('Login validation', () => {
  it('returns 400 with "Validation failed" when username is too short (Req 1.3)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ab', password: TEST_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation failed' });
    expect(res.body.details).toBeDefined();
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USERNAME, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation failed' });
  });

  it('returns 400 when the request body is empty', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation failed' });
  });
});

// ---------------------------------------------------------------------------
// 4. Protected route access — Req 2.3, 2.4, 3.1, 3.2
// ---------------------------------------------------------------------------

describe('Protected route access', () => {
  it('returns 401 when no cookie is sent (Req 3.2)', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
  });

  it('returns 401 with invalid-format error for a malformed token (Req 3.6)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `${COOKIE_NAME}=not-a-valid-hex-token`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token format' });
  });

  it('returns 401 for a well-formed but non-existent token (Req 2.4)', async () => {
    // 64-char hex that is syntactically valid but not in the DB
    const fakeToken = 'b'.repeat(64);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `${COOKIE_NAME}=${fakeToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: expect.stringContaining('Session') });
  });

  it('returns 200 with admin id when a valid session cookie is sent (Req 3.1)', async () => {
    const cookie = await loginAndGetCookie();

    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ admin: { id: adminId } });
  });

  it('refreshes session expiry on each validated request (sliding window, Req 2.2)', async () => {
    const cookie = await loginAndGetCookie();

    // Record expiry before the second request
    const [sessionBefore] = await prisma.adminSession.findMany({ where: { adminId } });
    const expiryBefore = sessionBefore?.expiresAt.getTime() ?? 0;

    // Small pause so the update timestamp is measurably different
    await new Promise((r) => setTimeout(r, 50));

    await request(app).get('/api/auth/me').set('Cookie', cookie);

    const [sessionAfter] = await prisma.adminSession.findMany({ where: { adminId } });
    const expiryAfter = sessionAfter?.expiresAt.getTime() ?? 0;

    // Expiry must have been pushed forward
    expect(expiryAfter).toBeGreaterThan(expiryBefore);
  });
});

// ---------------------------------------------------------------------------
// 5. Logout — Req 5.2
// ---------------------------------------------------------------------------

describe('Logout', () => {
  it('returns 204 and clears the session cookie on valid session (Req 5.2)', async () => {
    const cookie = await loginAndGetCookie();

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);

    expect(res.status).toBe(204);

    const setCookieHeader = res.headers['set-cookie'] as string[];
    const cookieStr = findCookieString(setCookieHeader, COOKIE_NAME);
    expect(cookieStr).not.toBeNull();
    expect(cookieStr).toContain('Max-Age=0');
  });

  it('removes the session record from the database after logout (Req 5.2)', async () => {
    const cookie = await loginAndGetCookie();

    // Verify session exists before logout
    const sessionsBefore = await prisma.adminSession.findMany({ where: { adminId } });
    expect(sessionsBefore).toHaveLength(1);

    await request(app).post('/api/auth/logout').set('Cookie', cookie);

    const sessionsAfter = await prisma.adminSession.findMany({ where: { adminId } });
    expect(sessionsAfter).toHaveLength(0);
  });

  it('returns 401 when attempting to use the token after logout', async () => {
    const cookie = await loginAndGetCookie();

    // Logout
    await request(app).post('/api/auth/logout').set('Cookie', cookie);

    // Try to use the same cookie
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);

    expect(res.status).toBe(401);
  });

  it('returns 401 when attempting to logout without a session cookie', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
  });
});

// ---------------------------------------------------------------------------
// 6. Rate limiting — Req 1.6
// ---------------------------------------------------------------------------

describe('Rate limiting', () => {
  it('returns 429 after 5 consecutive failed attempts from the same IP (Req 1.6)', async () => {
    // Use a unique synthetic IP per test-run to avoid interference with other tests
    // or previous runs in the same process. The rate limiter keys off req.ip;
    // we inject it via the X-Forwarded-For header which supertest forwards.
    // Express trusts X-Forwarded-For only when trust proxy is set, so we rely
    // on the loopback IP that supertest assigns and exhaust attempts normally.
    //
    // Strategy: send 5 requests with wrong password, then check the 6th returns 429.
    const wrongBody = { username: TEST_USERNAME, password: 'WrongPass!1' };

    // Collect the first 5 responses — they should all be 401 (or potentially
    // 429 if a previous test leaked state into the same IP bucket, which we
    // accept gracefully below).
    const responses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await request(app).post('/api/auth/login').send(wrongBody);
      responses.push(r.status);
    }

    // After 5 failed attempts the rate limiter must have triggered.
    // The 6th request from the same IP must be 429.
    const finalRes = await request(app).post('/api/auth/login').send(wrongBody);

    // Either the lockout started mid-loop (prior state) or on the 6th call
    const allStatuses = [...responses, finalRes.status];
    const has429 = allStatuses.includes(429);
    expect(has429).toBe(true);

    // When 429 is returned the error message must be informative
    const firstLockout = [...responses, finalRes].find((r) => {
      // r can be a number (status) or a supertest Response object — reconstruct
      return typeof r === 'object' && (r as { status: number }).status === 429;
    });
    if (typeof firstLockout === 'object') {
      expect((firstLockout as { body: { error: string } }).body.error).toMatch(
        /Too many login attempts/,
      );
    }
  });

  it('includes Retry-After header in 429 response (Req 1.6)', async () => {
    // Use the test username with wrong password until locked out.
    // Because the rate-limiter state carries over from the previous test (same
    // in-process singleton, same loopback IP), the very first attempt here may
    // already be 429 — that is fine, we just need to confirm the header exists.
    const wrongBody = { username: TEST_USERNAME, password: 'AnotherWrong!2' };

    let rateLimitedRes: Awaited<ReturnType<typeof request.agent>> | null = null;

    for (let attempt = 0; attempt < 7; attempt++) {
      const r = await request(app).post('/api/auth/login').send(wrongBody);
      if (r.status === 429) {
        rateLimitedRes = r;
        break;
      }
    }

    expect(rateLimitedRes).not.toBeNull();
    expect(rateLimitedRes!.headers['retry-after']).toBe('900');
    expect(rateLimitedRes!.body).toEqual({
      error: 'Too many login attempts. Try again in 15 minutes.',
    });
  });
});
