import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { createInvestmentRouter } from './routes/investment-routes.js';
import { createOrderRouter } from './routes/order-routes.js';
import { createCommentRouter } from './routes/comment-routes.js';
import { prisma } from './lib/prisma-client.js';

/**
 * Creates and configures the Express application.
 * Kept separate from the HTTP server bootstrap (index.ts) so tests
 * can import the app without binding to a port.
 */
export function createApp(): Application {
  const app = express();

  // ── Middleware ──────────────────────────────────────────────────────────────
  app.use(cors());
  app.use(express.json());

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api', createInvestmentRouter());
  app.use('/api', createOrderRouter());
  app.use('/api', createCommentRouter());

  // ── Test-only routes (not available in production) ──────────────────────────
  // Used by Playwright E2E tests to reset DB state between test suites.
  if (process.env['NODE_ENV'] !== 'production') {
    app.post('/api/test/reset', async (_req: Request, res: Response) => {
      // Comments and orders must be deleted before investments (ON DELETE RESTRICT)
      await prisma.comment.deleteMany({});
      await prisma.order.deleteMany({});
      await prisma.investment.deleteMany({});
      res.json({ ok: true });
    });
  }

  // ── Error handler (must be last) ─────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(JSON.stringify({ level: 'error', message, err }));
    res.status(500).json({ error: message });
  });

  return app;
}
