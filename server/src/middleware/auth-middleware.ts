import type { RequestHandler, Request, Response, NextFunction } from 'express';
import type { AppPermission } from '../generated/prisma/client.js';
import type { AuthService } from '../services/auth-service.js';
import { getSessionCookieName, getSessionCookieOptions } from '../lib/session.js';

// ---------------------------------------------------------------------------
// Express type augmentation — attach adminId after successful auth
// ---------------------------------------------------------------------------

declare global {
  namespace Express {
    interface Request {
      adminId?: string;
      adminUsername?: string;
      permissions?: AppPermission[];
    }
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthMiddlewareDeps {
  authService: AuthService;
  /**
   * Re-issues the session cookie with a fresh lifetime after each successful
   * validation. Disable only on routes that clear the cookie (logout).
   */
  refreshSessionCookie?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Matches exactly 64 lowercase hex characters — 256-bit opaque token (Req 2.1) */
const TOKEN_FORMAT = /^[0-9a-f]{64}$/;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates Express middleware that validates the session token from the
 * httpOnly cookie and attaches `adminId` to the request for downstream use.
 *
 * @example
 *   app.use('/api', createAuthMiddleware({ authService }));
 */
export function createAuthMiddleware(deps: AuthMiddlewareDeps): RequestHandler {
  const { authService, refreshSessionCookie = true } = deps;
  const cookieName = getSessionCookieName();

  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const token: string | undefined = req.cookies[cookieName] as string | undefined;

    // Req 3.2 — missing token
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Req 3.6 — malformed token (non-hex or wrong length)
    if (!TOKEN_FORMAT.test(token)) {
      res.status(401).json({ error: 'Invalid token format' });
      return;
    }

    // Req 2.3, 2.4, 3.3 — session lookup and expiry check
    const session = await authService.validateSession(token);

    if (!session) {
      res.status(401).json({ error: 'Session expired or invalid' });
      return;
    }

    // Req 3.5 — attach admin identity to request for downstream handlers
    req.adminId = session.adminId;
    req.adminUsername = session.username;
    req.permissions = session.permissions;

    // Sliding window — every authenticated request resets both the DB expiry
    // (inside validateSession) and the browser cookie to the full lifetime.
    if (refreshSessionCookie) {
      res.cookie(cookieName, token, getSessionCookieOptions());
    }

    next();
  };
}
