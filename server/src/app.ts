import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createInvestmentRouter } from './routes/investment-routes.js';
import { createOrderRouter } from './routes/order-routes.js';
import { createCommentRouter } from './routes/comment-routes.js';
import { createTreasuryProductRouter } from './routes/treasury-product-routes.js';
import { createAuthRouter } from './routes/auth-routes.js';
import { createAuthService } from './services/auth-service.js';
import { createAuthMiddleware } from './middleware/auth-middleware.js';
import { prisma } from './lib/prisma-client.js';

/**
 * Creates and configures the Express application.
 * Kept separate from the HTTP server bootstrap (index.ts) so tests
 * can import the app without binding to a port.
 */
export function createApp(): Application {
  const app = express();

  // ── Middleware ──────────────────────────────────────────────────────────────
  app.use(cors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());

  // ── Auth setup ──────────────────────────────────────────────────────────────
  const authService = createAuthService({ db: prisma });
  const authMiddleware = createAuthMiddleware({ authService });

  // ── Routes ──────────────────────────────────────────────────────────────────

  // /health is registered before any /api middleware — always exempt (Req 3.4)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth routes registered BEFORE the global auth middleware so /api/auth/login
  // is reachable without a session token (Req 3.4)
  app.use('/api/auth', createAuthRouter(authService));

  // Test-only reset route registered BEFORE global auth middleware so E2E tests
  // can reset DB state without needing a valid session (non-production only)
  if (process.env['NODE_ENV'] !== 'production') {
    app.post('/api/test/reset', async (_req: Request, res: Response) => {
      // Comments and orders must be deleted before investments (ON DELETE RESTRICT)
      await prisma.comment.deleteMany({});
      await prisma.order.deleteMany({});
      await prisma.investment.deleteMany({});
      res.json({ ok: true });
    });
  }

  // Global auth middleware — applies to all /api/* routes registered after this
  // point. Routes above (/api/auth, /api/test/reset) are already matched by
  // Express before reaching this middleware (Req 3.4)
  app.use('/api', authMiddleware);

  app.use('/api', createInvestmentRouter());
  app.use('/api', createOrderRouter());
  app.use('/api', createCommentRouter());
  app.use('/api', createTreasuryProductRouter());

  // ── Error handler (must be last) ─────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(JSON.stringify({ level: 'error', message, err }));
    res.status(500).json({ error: message });
  });

  return app;
}
