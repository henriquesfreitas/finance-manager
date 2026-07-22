import type { RequestHandler, Request, Response, NextFunction } from 'express';
import type { AuthService } from '../services/auth-service.js';

// ---------------------------------------------------------------------------
// Express type augmentation — attach adminId after successful auth
// ---------------------------------------------------------------------------

declare global {
  namespace Express {
    interface Request {
      adminId?: string;
    }
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthMiddlewareDeps {
  authService: AuthService;
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
  const { authService } = deps;
  const cookieName = process.env['SESSION_COOKIE_NAME'] ?? 'finance_session';

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
    next();
  };
}
