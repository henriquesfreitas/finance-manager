import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { createRateLimiter } from '../lib/rate-limiter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthServiceDeps {
  db: PrismaClient;
}

export interface LoginResult {
  token: string;
  adminId: string;
}

export interface AuthService {
  authenticate(username: string, password: string, clientIp: string): Promise<LoginResult>;
  validateSession(token: string): Promise<{ adminId: string } | null>;
  invalidateSession(token: string): Promise<void>;
  isRateLimited(clientIp: string): boolean;
  recordFailedAttempt(clientIp: string): void;
  clearFailedAttempts(clientIp: string): void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_EXPIRY_DAYS = parseInt(process.env['SESSION_EXPIRY_DAYS'] ?? '7', 10);

const rateLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
});

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the auth service responsible for credential verification,
 * session lifecycle management, and rate limiting.
 *
 * @example
 *   const authService = createAuthService({ db: prisma });
 *   const { token } = await authService.authenticate('admin', 'password', '127.0.0.1');
 */
export function createAuthService(deps: AuthServiceDeps): AuthService {
  const { db } = deps;

  function buildExpiresAt(): Date {
    return new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  }

  /**
   * Verifies credentials and issues a new session token.
   * Throws on invalid credentials or rate-limit breach.
   * Never returns or logs the password hash.
   */
  async function authenticate(
    username: string,
    password: string,
    clientIp: string,
  ): Promise<LoginResult> {
    if (rateLimiter.isLimited(clientIp)) {
      throw new Error('Too many login attempts. Try again in 15 minutes.');
    }

    const user = await db.adminUser.findUnique({
      where: { username },
      select: { id: true, username: true, passwordHash: true },
    });

    const passwordValid = user !== null && (await bcrypt.compare(password, user.passwordHash));

    if (!user || !passwordValid) {
      rateLimiter.recordAttempt(clientIp);
      // Generic message — never reveal which field was wrong (Req 1.2, 6.2)
      throw new Error('Invalid credentials');
    }

    rateLimiter.reset(clientIp);

    const token = randomBytes(32).toString('hex'); // 256-bit opaque token (Req 2.1)
    const expiresAt = buildExpiresAt();

    await db.adminSession.create({
      data: { token, adminId: user.id, expiresAt },
    });

    console.log(
      JSON.stringify({
        event: 'auth.login.success',
        adminId: user.id,
        clientIp,
        expiresAt: expiresAt.toISOString(),
        // passwordHash intentionally omitted (Req 6.5)
      }),
    );

    return { token, adminId: user.id };
  }

  /**
   * Validates an existing session token and refreshes its expiry (sliding window).
   * Returns null when the token is missing, expired, or not found.
   */
  async function validateSession(token: string): Promise<{ adminId: string } | null> {
    const session = await db.adminSession.findUnique({
      where: { token },
      include: { admin: { select: { id: true } } },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    // Sliding-window refresh — extend expiry on every successful validation (Req 2.2)
    const expiresAt = buildExpiresAt();
    await db.adminSession.update({
      where: { token },
      data: { expiresAt },
    });

    return { adminId: session.adminId };
  }

  /**
   * Deletes a session record by token.
   * Silently ignores "record not found" errors so logout is idempotent.
   */
  async function invalidateSession(token: string): Promise<void> {
    try {
      await db.adminSession.delete({ where: { token } });
    } catch {
      // Swallow "record not found" — idempotent logout (Req 5.2)
    }
  }

  return {
    authenticate,
    validateSession,
    invalidateSession,
    isRateLimited: (clientIp: string): boolean => rateLimiter.isLimited(clientIp),
    recordFailedAttempt: (clientIp: string): void => rateLimiter.recordAttempt(clientIp),
    clearFailedAttempts: (clientIp: string): void => rateLimiter.reset(clientIp),
  };
}
