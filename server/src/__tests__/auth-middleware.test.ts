import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Application } from 'express';
import cookieParser from 'cookie-parser';
import type { AuthService } from '../services/auth-service.js';
import { createAuthMiddleware } from '../middleware/auth-middleware.js';

// ─── Fake auth service ────────────────────────────────────────────────────────

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

// ─── Test app factory ─────────────────────────────────────────────────────────

/**
 * Builds a minimal Express app with cookie-parser and the auth middleware,
 * followed by a protected sentinel route that returns the attached adminId.
 */
function buildApp(authService: AuthService, cookieName?: string): Application {
  if (cookieName) {
    process.env['SESSION_COOKIE_NAME'] = cookieName;
  } else {
    delete process.env['SESSION_COOKIE_NAME'];
  }

  const app = express();
  app.use(cookieParser());
  app.use('/protected', createAuthMiddleware({ authService }));
  app.get('/protected', (req, res) => {
    res.json({ adminId: req.adminId });
  });
  return app;
}

// ─── Valid token fixture ──────────────────────────────────────────────────────

const VALID_TOKEN = 'a'.repeat(64); // 64-char hex — satisfies /^[0-9a-f]{64}$/

// ─── Missing token (Req 3.2) ──────────────────────────────────────────────────

describe('missing session token', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = makeFakeAuthService();
    vi.clearAllMocks();
  });

  it('returns 401 with "Authentication required" when no cookie is present', async () => {
    const app = buildApp(authService);

    const res = await request(app).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
  });

  it('does not call validateSession when cookie is absent', async () => {
    const app = buildApp(authService);

    await request(app).get('/protected');

    expect(authService.validateSession).not.toHaveBeenCalled();
  });
});

// ─── Malformed token (Req 3.6) ────────────────────────────────────────────────

describe('malformed session token', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = makeFakeAuthService();
    vi.clearAllMocks();
  });

  it('returns 401 with "Invalid token format" for a token that is too short', async () => {
    const app = buildApp(authService);

    const res = await request(app)
      .get('/protected')
      .set('Cookie', 'finance_session=abc123');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token format' });
  });

  it('returns 401 with "Invalid token format" for a token with non-hex characters', async () => {
    const app = buildApp(authService);
    const nonHexToken = 'z'.repeat(64); // 'z' is not a hex char

    const res = await request(app)
      .get('/protected')
      .set('Cookie', `finance_session=${nonHexToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token format' });
  });

  it('returns 401 with "Invalid token format" for a 65-char token (one too long)', async () => {
    const app = buildApp(authService);
    const tooLong = 'a'.repeat(65);

    const res = await request(app)
      .get('/protected')
      .set('Cookie', `finance_session=${tooLong}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token format' });
  });

  it('returns 401 with "Invalid token format" for an uppercase hex token', async () => {
    const app = buildApp(authService);
    const uppercaseToken = 'A'.repeat(64); // uppercase hex is not /^[0-9a-f]{64}$/

    const res = await request(app)
      .get('/protected')
      .set('Cookie', `finance_session=${uppercaseToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token format' });
  });

  it('does not call validateSession for a malformed token', async () => {
    const app = buildApp(authService);

    await request(app)
      .get('/protected')
      .set('Cookie', 'finance_session=not-a-valid-token');

    expect(authService.validateSession).not.toHaveBeenCalled();
  });
});

// ─── Expired or unknown session (Req 2.4, 3.3) ────────────────────────────────

describe('expired or unknown session', () => {
  let authService: AuthService;

  beforeEach(() => {
    // validateSession returns null → session not found / expired
    authService = makeFakeAuthService(() => Promise.resolve(null));
    vi.clearAllMocks();
  });

  it('returns 401 with "Session expired or invalid" when validateSession returns null', async () => {
    const app = buildApp(authService);

    const res = await request(app)
      .get('/protected')
      .set('Cookie', `finance_session=${VALID_TOKEN}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Session expired or invalid' });
  });

  it('calls validateSession with the extracted token', async () => {
    const app = buildApp(authService);

    await request(app)
      .get('/protected')
      .set('Cookie', `finance_session=${VALID_TOKEN}`);

    expect(authService.validateSession).toHaveBeenCalledWith(VALID_TOKEN);
  });
});

// ─── Valid session (Req 3.1, 3.5) ────────────────────────────────────────────

describe('valid session', () => {
  let authService: AuthService;
  const ADMIN_ID = 'admin-uuid-123';

  beforeEach(() => {
    authService = makeFakeAuthService(() => Promise.resolve({ adminId: ADMIN_ID }));
    vi.clearAllMocks();
  });

  it('calls next() and attaches adminId to req on a valid token', async () => {
    const app = buildApp(authService);

    const res = await request(app)
      .get('/protected')
      .set('Cookie', `finance_session=${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ adminId: ADMIN_ID });
  });

  it('delegates session lookup to authService.validateSession', async () => {
    const app = buildApp(authService);

    await request(app)
      .get('/protected')
      .set('Cookie', `finance_session=${VALID_TOKEN}`);

    expect(authService.validateSession).toHaveBeenCalledOnce();
    expect(authService.validateSession).toHaveBeenCalledWith(VALID_TOKEN);
  });
});

// ─── Custom cookie name (SESSION_COOKIE_NAME env var) ────────────────────────

describe('custom SESSION_COOKIE_NAME', () => {
  let authService: AuthService;

  afterEach(() => {
    delete process.env['SESSION_COOKIE_NAME'];
  });

  it('reads the token from the cookie named by SESSION_COOKIE_NAME', async () => {
    authService = makeFakeAuthService(() => Promise.resolve({ adminId: 'admin-1' }));
    const app = buildApp(authService, 'my_custom_cookie');

    const res = await request(app)
      .get('/protected')
      .set('Cookie', `my_custom_cookie=${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(authService.validateSession).toHaveBeenCalledWith(VALID_TOKEN);
  });

  it('returns 401 when the token is in the default cookie name but a custom one is set', async () => {
    authService = makeFakeAuthService();
    const app = buildApp(authService, 'my_custom_cookie');

    // Token is in 'finance_session' but middleware expects 'my_custom_cookie'
    const res = await request(app)
      .get('/protected')
      .set('Cookie', `finance_session=${VALID_TOKEN}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
  });
});
