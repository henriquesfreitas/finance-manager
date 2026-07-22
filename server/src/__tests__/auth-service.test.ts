import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { createAuthService } from '../services/auth-service.js';

// ─── Fake helpers ────────────────────────────────────────────────────────────

// Real bcrypt hashes computed once at suite startup (cost 4 = fast for tests).
let REAL_HASH: string;
let WRONG_HASH: string;

beforeAll(async () => {
  REAL_HASH = await bcrypt.hash('password123', 4);
  // Hash a different password so compare('password123', WRONG_HASH) always returns false.
  WRONG_HASH = await bcrypt.hash('completely-different-password', 4);
});

function makeAdminUser(overrides: Partial<{
  id: string;
  username: string;
  passwordHash: string;
}> = {}) {
  return {
    id: overrides.id ?? 'admin-1',
    username: overrides.username ?? 'admin',
    passwordHash: overrides.passwordHash ?? REAL_HASH,
  };
}

function makeSession(overrides: Partial<{
  id: string;
  token: string;
  adminId: string;
  expiresAt: Date;
  createdAt: Date;
  admin: { id: string };
}> = {}) {
  return {
    id: overrides.id ?? 'session-1',
    token: overrides.token ?? 'a'.repeat(64),
    adminId: overrides.adminId ?? 'admin-1',
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: overrides.createdAt ?? new Date(),
    admin: overrides.admin ?? { id: 'admin-1' },
  };
}

function makeFakePrisma(overrides: {
  adminUserFindUnique?: ReturnType<typeof vi.fn>;
  adminSessionCreate?: ReturnType<typeof vi.fn>;
  adminSessionFindUnique?: ReturnType<typeof vi.fn>;
  adminSessionUpdate?: ReturnType<typeof vi.fn>;
  adminSessionDelete?: ReturnType<typeof vi.fn>;
} = {}) {
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

// ─── authenticate ────────────────────────────────────────────────────────────

describe('authenticate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns token and adminId on valid credentials', async () => {
    const user = makeAdminUser();
    const db = makeFakePrisma({
      adminUserFindUnique: vi.fn().mockResolvedValue(user),
      adminSessionCreate: vi.fn().mockResolvedValue({}),
    });

    const svc = createAuthService({ db });
    const result = await svc.authenticate('admin', 'password123', '127.0.0.1');

    expect(result.adminId).toBe('admin-1');
    // Token must be a 64-char hex string (256-bit opaque token)
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('creates a session record in the DB on success', async () => {
    const user = makeAdminUser();
    const sessionCreate = vi.fn().mockResolvedValue({});
    const db = makeFakePrisma({
      adminUserFindUnique: vi.fn().mockResolvedValue(user),
      adminSessionCreate: sessionCreate,
    });

    const svc = createAuthService({ db });
    const { token } = await svc.authenticate('admin', 'password123', '127.0.0.1');

    expect(sessionCreate).toHaveBeenCalledOnce();
    const callArg = sessionCreate.mock.calls[0]?.[0] as { data: { token: string; adminId: string; expiresAt: Date } };
    expect(callArg.data.token).toBe(token);
    expect(callArg.data.adminId).toBe('admin-1');
    expect(callArg.data.expiresAt).toBeInstanceOf(Date);
  });

  it('sets session expiry ~7 days in the future', async () => {
    const user = makeAdminUser();
    const sessionCreate = vi.fn().mockResolvedValue({});
    const db = makeFakePrisma({
      adminUserFindUnique: vi.fn().mockResolvedValue(user),
      adminSessionCreate: sessionCreate,
    });

    const svc = createAuthService({ db });
    const before = Date.now();
    await svc.authenticate('admin', 'password123', '127.0.0.1');
    const after = Date.now();

    const callArg = sessionCreate.mock.calls[0]?.[0] as { data: { expiresAt: Date } };
    const expiresMs = callArg.data.expiresAt.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  it('throws "Invalid credentials" when user does not exist', async () => {
    const db = makeFakePrisma({
      adminUserFindUnique: vi.fn().mockResolvedValue(null),
    });

    const svc = createAuthService({ db });
    await expect(
      svc.authenticate('nobody', 'password123', '10.0.0.1'),
    ).rejects.toThrow('Invalid credentials');
  });

  it('throws "Invalid credentials" when password is wrong', async () => {
    const user = makeAdminUser({ passwordHash: WRONG_HASH });
    const db = makeFakePrisma({
      adminUserFindUnique: vi.fn().mockResolvedValue(user),
    });

    const svc = createAuthService({ db });
    await expect(
      svc.authenticate('admin', 'wrongpass', '10.0.0.1'),
    ).rejects.toThrow('Invalid credentials');
  });

  it('emits the same error for wrong username AND wrong password (no field disclosure)', async () => {
    const dbNoUser = makeFakePrisma({ adminUserFindUnique: vi.fn().mockResolvedValue(null) });
    const dbWrongPw = makeFakePrisma({
      adminUserFindUnique: vi.fn().mockResolvedValue(makeAdminUser({ passwordHash: WRONG_HASH })),
    });

    const svc1 = createAuthService({ db: dbNoUser });
    const svc2 = createAuthService({ db: dbWrongPw });

    const err1 = await svc1.authenticate('x', 'y', '1.1.1.1').catch((e: Error) => e.message);
    const err2 = await svc2.authenticate('admin', 'y', '1.1.1.2').catch((e: Error) => e.message);

    expect(err1).toBe(err2);
    expect(err1).toBe('Invalid credentials');
  });

  it('does NOT include passwordHash in the returned value', async () => {
    const user = makeAdminUser();
    const db = makeFakePrisma({
      adminUserFindUnique: vi.fn().mockResolvedValue(user),
      adminSessionCreate: vi.fn().mockResolvedValue({}),
    });

    const svc = createAuthService({ db });
    const result = await svc.authenticate('admin', 'password123', '127.0.0.1') as Record<string, unknown>;

    expect(result).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain(REAL_HASH);
  });
});

// ─── validateSession ─────────────────────────────────────────────────────────

describe('validateSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns adminId for a valid, non-expired session', async () => {
    const session = makeSession();
    const db = makeFakePrisma({
      adminSessionFindUnique: vi.fn().mockResolvedValue(session),
      adminSessionUpdate: vi.fn().mockResolvedValue({}),
    });

    const svc = createAuthService({ db });
    const result = await svc.validateSession('a'.repeat(64));

    expect(result).toEqual({ adminId: 'admin-1' });
  });

  it('updates expiresAt (sliding window) on valid session', async () => {
    const session = makeSession({ token: 'tok' });
    const sessionUpdate = vi.fn().mockResolvedValue({});
    const db = makeFakePrisma({
      adminSessionFindUnique: vi.fn().mockResolvedValue(session),
      adminSessionUpdate: sessionUpdate,
    });

    const svc = createAuthService({ db });
    const before = Date.now();
    await svc.validateSession('tok');
    const after = Date.now();

    expect(sessionUpdate).toHaveBeenCalledOnce();
    const updateArg = sessionUpdate.mock.calls[0]?.[0] as { where: { token: string }; data: { expiresAt: Date } };
    expect(updateArg.where.token).toBe('tok');
    const newExpiry = updateArg.data.expiresAt.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(newExpiry).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(newExpiry).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  it('returns null when session is not found', async () => {
    const db = makeFakePrisma({
      adminSessionFindUnique: vi.fn().mockResolvedValue(null),
    });

    const svc = createAuthService({ db });
    const result = await svc.validateSession('nonexistent');

    expect(result).toBeNull();
  });

  it('returns null when session is expired', async () => {
    const expired = makeSession({ expiresAt: new Date(Date.now() - 1000) });
    const db = makeFakePrisma({
      adminSessionFindUnique: vi.fn().mockResolvedValue(expired),
    });

    const svc = createAuthService({ db });
    const result = await svc.validateSession('expired-token');

    expect(result).toBeNull();
  });

  it('does NOT update expiry for an expired session', async () => {
    const expired = makeSession({ expiresAt: new Date(Date.now() - 1000) });
    const sessionUpdate = vi.fn().mockResolvedValue({});
    const db = makeFakePrisma({
      adminSessionFindUnique: vi.fn().mockResolvedValue(expired),
      adminSessionUpdate: sessionUpdate,
    });

    const svc = createAuthService({ db });
    await svc.validateSession('expired-token');

    expect(sessionUpdate).not.toHaveBeenCalled();
  });
});

// ─── invalidateSession ───────────────────────────────────────────────────────

describe('invalidateSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the session record', async () => {
    const sessionDelete = vi.fn().mockResolvedValue({});
    const db = makeFakePrisma({ adminSessionDelete: sessionDelete });

    const svc = createAuthService({ db });
    await svc.invalidateSession('some-token');

    expect(sessionDelete).toHaveBeenCalledWith({ where: { token: 'some-token' } });
  });

  it('does not throw when session record is not found (idempotent logout)', async () => {
    const db = makeFakePrisma({
      adminSessionDelete: vi.fn().mockRejectedValue(new Error('Record not found')),
    });

    const svc = createAuthService({ db });
    await expect(svc.invalidateSession('missing-token')).resolves.toBeUndefined();
  });
});

// ─── rate-limiter delegation ─────────────────────────────────────────────────

describe('rate limiter delegation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('isRateLimited returns false for a fresh IP', () => {
    const db = makeFakePrisma();
    const svc = createAuthService({ db });
    expect(svc.isRateLimited('1.2.3.4')).toBe(false);
  });

  it('isRateLimited returns true after 5 recordFailedAttempt calls', () => {
    const db = makeFakePrisma();
    const svc = createAuthService({ db });
    const ip = '5.5.5.5';

    for (let i = 0; i < 5; i++) svc.recordFailedAttempt(ip);

    expect(svc.isRateLimited(ip)).toBe(true);
  });

  it('clearFailedAttempts resets the limiter so IP is no longer blocked', () => {
    const db = makeFakePrisma();
    const svc = createAuthService({ db });
    const ip = '6.6.6.6';

    for (let i = 0; i < 5; i++) svc.recordFailedAttempt(ip);
    expect(svc.isRateLimited(ip)).toBe(true);

    svc.clearFailedAttempts(ip);
    expect(svc.isRateLimited(ip)).toBe(false);
  });

  it('throws rate-limit error when authenticate is called for a locked IP', async () => {
    const db = makeFakePrisma({
      adminUserFindUnique: vi.fn().mockResolvedValue(makeAdminUser()),
      adminSessionCreate: vi.fn().mockResolvedValue({}),
    });

    const svc = createAuthService({ db });
    const ip = '7.7.7.7';

    // Lock the IP via the public delegation method
    for (let i = 0; i < 5; i++) svc.recordFailedAttempt(ip);

    await expect(
      svc.authenticate('admin', 'password123', ip),
    ).rejects.toThrow('Too many login attempts. Try again in 15 minutes.');
  });
});
