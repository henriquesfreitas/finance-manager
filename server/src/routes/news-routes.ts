import { Router, type Request, type Response } from 'express';
import { getClassifiedNewsFeed, getFilteredNewsFeed } from '../services/news-feed-service.js';

/**
 * Public news routes. Registered before the global /api auth middleware
 * because /news is an open page that does not require a session.
 */
export function createNewsRouter(): Router {
  const router = Router();

  function sendFeedError(error: unknown, res: Response): void {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Failed to load the news feed',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    res.status(502).json({ error: 'Unable to load the news feed' });
  }

  router.get('/news', async (_req: Request, res: Response) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.json(await getClassifiedNewsFeed());
    } catch (error) {
      sendFeedError(error, res);
    }
  });

  router.get('/news/feed', async (_req: Request, res: Response) => {
    try {
      const xml = await getFilteredNewsFeed();
      res.set('Content-Type', 'application/rss+xml; charset=utf-8');
      res.set('Cache-Control', 'no-store');
      res.send(xml);
    } catch (error) {
      sendFeedError(error, res);
    }
  });

  return router;
}
