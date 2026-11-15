import { Router, type Request, type Response } from 'express';
import {
  getClassifiedNewsFeed,
  getFilteredNewsFeed,
  type FeedChannelIdentity,
} from '../services/news-feed-service.js';

/**
 * Public news routes.
 *
 * The RSS feed is served at /news/feed (outside /api) so feed readers
 * subscribe to a clean public URL. The JSON endpoint stays at /api/news
 * because the /news page is a client SPA route, so both the /api/news JSON
 * and /news/feed XML must reach the server through nginx. Registered before
 * the global /api auth middleware because /news is an open page that does
 * not require a session.
 */
export function createNewsRouter(): Router {
  const router = Router();

  /** Identity derived from the incoming request, used to rebrand the channel head. */
  function feedIdentity(req: Request): FeedChannelIdentity {
    const origin = `${req.protocol}://${req.get('host') ?? 'localhost'}`;
    return {
      siteUrl: `${origin}/`,
      selfUrl: new URL(req.originalUrl, origin).href,
    };
  }

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

  router.get('/api/news', async (req: Request, res: Response) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.json(await getClassifiedNewsFeed({}, feedIdentity(req)));
    } catch (error) {
      sendFeedError(error, res);
    }
  });

  router.get('/news/feed', async (req: Request, res: Response) => {
    try {
      const xml = await getFilteredNewsFeed({}, feedIdentity(req));
      res.set('Content-Type', 'application/rss+xml; charset=utf-8');
      res.set('Cache-Control', 'no-store');
      res.send(xml);
    } catch (error) {
      sendFeedError(error, res);
    }
  });

  return router;
}
