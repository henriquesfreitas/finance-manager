import { Router, type Request, type Response } from 'express';
import type { AuthService } from '../services/auth-service.js';
import { createAuthMiddleware } from '../middleware/auth-middleware.js';
import { validateLoginInput } from '../validators/auth-validator.js';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the auth router with login, logout, and session-check endpoints.
 * Auth middleware is applied inline on protected routes (logout, me).
 *
 * @example
 *   app.use('/api/auth', createAuthRouter(authService));
 */
export function createAuthRouter(authService: AuthService): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware({ authService });

  const cookieName = process.env['SESSION_COOKIE_NAME'] ?? 'finance_session';
  const expiryDays = parseInt(process.env['SESSION_EXPIRY_DAYS'] ?? '7', 10);

  // ─── POST /login ────────────────────────────────────────────────────────────

  /**
   * Validates credentials and issues a session cookie on success.
   * Returns Retry-After header on rate-limit (429) responses (Req 1.6).
   *
   * @example
   *   fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
   */
  router.post('/login', async (req: Request, res: Response): Promise<void> => {
    const validation = validateLoginInput(req.body);

    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.errors.issues });
      return;
    }

    const { username, password } = validation.data;
    const clientIp = req.ip ?? '0.0.0.0';

    try {
      const { token, adminId } = await authService.authenticate(username, password, clientIp);

      // Req 2.5 — httpOnly, Secure, SameSite=Strict, 7-day max-age
      res.cookie(cookieName, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: expiryDays * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({ admin: { id: adminId, username } });
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.startsWith('Too many login attempts')) {
          // Req 1.6 — Retry-After: 900 seconds (15 minutes)
          res.set('Retry-After', '900');
          res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
          return;
        }
        if (err.message === 'Invalid credentials') {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── POST /logout ───────────────────────────────────────────────────────────

  /**
   * Invalidates the session and clears the session cookie (Req 5.2).
   * Auth middleware guards this route.
   *
   * @example
   *   fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
   */
  router.post(
    '/logout',
    authMiddleware,
    async (req: Request, res: Response): Promise<void> => {
      const token: string | undefined = req.cookies[cookieName] as string | undefined;

      if (token) {
        await authService.invalidateSession(token);
      }

      // Req 5.2 — clear cookie with Max-Age=0
      res.cookie(cookieName, '', { maxAge: 0, httpOnly: true, secure: true, sameSite: 'strict' });
      res.status(204).end();
    },
  );

  // ─── GET /me ────────────────────────────────────────────────────────────────

  /**
   * Returns the identity of the currently authenticated admin.
   * Auth middleware guards this route and attaches req.adminId.
   *
   * @example
   *   fetch('/api/auth/me', { credentials: 'include' })
   */
  router.get('/me', authMiddleware, (req: Request, res: Response): void => {
    // req.adminId is guaranteed by auth middleware (Req 3.5)
    res.status(200).json({ admin: { id: req.adminId } });
  });

  return router;
}
