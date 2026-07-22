import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Application } from 'express';
import cookieParser from 'cookie-parser';
import type { AuthService } from '../services/auth-service.js';

// ─── Fake auth service ────────────────────────────────────────────────────────

function makeFakeAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    authenticate: vi.fn(),
    validateSession: vi.fn().mockResolvedValue(null),
    invalidateSession: vi.fn().mockResolvedValue(undefined),
    isRateLimited: vi.fn().mockReturnValue(false),
    recordFailedAttempt: vi.fn(),
    clearFailedAttempts: vi.fn(),
    ...overrides,
  };
}

// Import router after mocks are registered
const { createAuthRouter } = await import('../routes/auth-routes.js');

// ─── Test app factory ─────────────────────────────────────────────────────────

function buildApp(authService: AuthService): Application {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', createAuthRouter(authService));
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : 'Internal server error';
      res.status(500).json({ error: message });
    },
  );
  return app;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_TOKEN = 'a'.repeat(64); // 64-char lowercase hex
const ADMIN_ID = 'admin-uuid-abc';
const VALID_BODY = { username: 'admin', password: 'secret123' };

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = makeFakeAuthService();
    vi.clearAllMocks();
    delete process.env['SESSION_COOKIE_NAME'];
    delete process.env['SESSION_EXPIRY_DAYS'];
  });

  it('returns 200 with admin info and sets a session cookie on valid credentials', async () => {
    vi.mocked(authService.authenticate).mockResolvedValueOnce({
      token: VALID_TOKEN,
      adminId: ADMIN_ID,
    });
    const app = buildApp(authService);

    const res = await request(app).post('/api/auth/login').send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ admin: { id: ADMIN_ID, username: 'admin' } });
    expect(res.headers['set-cookie']).toBeDefined();
    const cookie: string = (res.headers['set-cookie'] as string[])[0] ?? '';
    expect(cookie).toContain('finance_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toMatch(/Max-Age=\d+/);
  });

  it('sets Max-Age to 7 days (604800 seconds) by default', async () => {
    vi.mocked(authService.authenticate).mockResolvedValueOnce({
      token: VALID_TOKEN,
      adminId: ADMIN_ID,
    });
    const app = buildApp(authService);

    const res = await request(app).post('/api/auth/login').send(VALID_BODY);

    const cookie: string = (res.headers['set-cookie'] as string[])[0] ?? '';
    expect(cookie).toContain('Max-Age=604800');
  });

  it('uses SESSION_COOKIE_NAME env var when set', async () => {
    process.env['SESSION_COOKIE_NAME'] = 'my_cookie';
    vi.mocked(authService.authenticate).mockResolvedValueOnce({
      token: VALID_TOKEN,
      adminId: ADMIN_ID,
    });
    // Must rebuild router after env var change
    const { createAuthRouter: buildRouter } = await import('../routes/auth-routes.js');
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', buildRouter(authService));

    const res = await request(app).post('/api/auth/login').send(VALID_BODY);

    const cookie: string = (res.headers['set-cookie'] as string[])[0] ?? '';
    expect(cookie).toContain('my_cookie=');
  });

  it('returns 400 with validation errors when username is too short', async () => {
    const app = buildApp(authService);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ab', password: 'secret123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toBeDefined();
    expect(authService.authenticate).not.toHaveBeenCalled();
  });

  it('returns 400 with validation errors when password is too short', async () => {
    const app = buildApp(authService);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(authService.authenticate).not.toHaveBeenCalled();
  });

  it('returns 400 when body is empty', async () => {
    const app = buildApp(authService);

    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 401 when authenticate throws "Invalid credentials"', async () => {
    vi.mocked(authService.authenticate).mockRejectedValueOnce(new Error('Invalid credentials'));
    const app = buildApp(authService);

    const res = await request(app).post('/api/auth/login').send(VALID_BODY);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('returns 429 with Retry-After header when rate-limited', async () => {
    vi.mocked(authService.authenticate).mockRejectedValueOnce(
      new Error('Too many login attempts. Try again in 15 minutes.'),
    );
    const app = buildApp(authService);

    const res = await request(app).post('/api/auth/login').send(VALID_BODY);

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'Too many login attempts. Try again in 15 minutes.' });
    expect(res.headers['retry-after']).toBe('900');
  });

  it('returns 500 on unexpected errors', async () => {
    vi.mocked(authService.authenticate).mockRejectedValueOnce(new Error('DB exploded'));
    const app = buildApp(authService);

    const res = await request(app).post('/api/auth/login').send(VALID_BODY);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('does not set a cookie on failed authentication', async () => {
    vi.mocked(authService.authenticate).mockRejectedValueOnce(new Error('Invalid credentials'));
    const app = buildApp(authService);

    const res = await request(app).post('/api/auth/login').send(VALID_BODY);

    expect(res.headers['set-cookie']).toBeUndefined();
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = makeFakeAuthService({
      // validateSession returns valid session so auth middleware passes
      validateSession: vi.fn().mockResolvedValue({ adminId: ADMIN_ID }),
    });
    vi.clearAllMocks();
    delete process.env['SESSION_COOKIE_NAME'];
  });

  it('returns 204 and clears the session cookie on valid session', async () => {
    const app = buildApp(authService);

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `finance_session=${VALID_TOKEN}`);

    expect(res.status).toBe(204);
    expect(res.headers['set-cookie']).toBeDefined();
    const cookie: string = (res.headers['set-cookie'] as string[])[0] ?? '';
    expect(cookie).toContain('finance_session=');
    expect(cookie).toContain('Max-Age=0');
  });

  it('calls invalidateSession with the session token', async () => {
    const app = buildApp(authService);

    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `finance_session=${VALID_TOKEN}`);

    expect(authService.invalidateSession).toHaveBeenCalledWith(VALID_TOKEN);
  });

  it('returns 401 when no session cookie is present', async () => {
    // Auth middleware blocks request before reaching logout handler
    const unauthService = makeFakeAuthService({
      validateSession: vi.fn().mockResolvedValue(null),
    });
    const app = buildApp(unauthService);

    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(401);
    expect(unauthService.invalidateSession).not.toHaveBeenCalled();
  });

  it('returns 401 when the session is expired', async () => {
    const expiredService = makeFakeAuthService({
      validateSession: vi.fn().mockResolvedValue(null),
    });
    const app = buildApp(expiredService);

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `finance_session=${VALID_TOKEN}`);

    expect(res.status).toBe(401);
    expect(expiredService.invalidateSession).not.toHaveBeenCalled();
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = makeFakeAuthService({
      validateSession: vi.fn().mockResolvedValue({ adminId: ADMIN_ID }),
    });
    vi.clearAllMocks();
    delete process.env['SESSION_COOKIE_NAME'];
  });

  afterEach(() => {
    delete process.env['SESSION_COOKIE_NAME'];
  });

  it('returns 200 with admin id when session is valid', async () => {
    const app = buildApp(authService);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `finance_session=${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ admin: { id: ADMIN_ID } });
  });

  it('returns 401 when no cookie is present', async () => {
    const unauthService = makeFakeAuthService({
      validateSession: vi.fn().mockResolvedValue(null),
    });
    const app = buildApp(unauthService);

    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('returns 401 when session is expired', async () => {
    const expiredService = makeFakeAuthService({
      validateSession: vi.fn().mockResolvedValue(null),
    });
    const app = buildApp(expiredService);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `finance_session=${VALID_TOKEN}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Session expired or invalid');
  });

  it('calls validateSession with the token extracted from the cookie', async () => {
    const app = buildApp(authService);

    await request(app)
      .get('/api/auth/me')
      .set('Cookie', `finance_session=${VALID_TOKEN}`);

    expect(authService.validateSession).toHaveBeenCalledWith(VALID_TOKEN);
  });

  it('returns 401 for a malformed token', async () => {
    const app = buildApp(authService);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'finance_session=not-valid-hex');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid token format');
  });
});
