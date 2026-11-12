import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma-client.js';
import { createNewsService, NewsServiceError } from '../services/news-service.js';

export function createNewsRouter(): Router {
  const router = Router();
  const newsService = createNewsService({ db: prisma });

  router.get('/news', async (_req: Request, res: Response) => {
    res.json(await newsService.getNews());
  });

  router.get('/news/:id/original-text', async (req: Request, res: Response) => {
    const params = z.object({ id: z.string().min(1).max(64) }).safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'Invalid news item id' });
      return;
    }
    const articleText = await newsService.getOriginalText(params.data.id);
    if (articleText === null) {
      res.status(404).json({ error: 'News article not found' });
      return;
    }
    res.json(articleText);
  });

  router.post('/news/:id/summary', async (req: Request, res: Response) => {
    const params = z.object({ id: z.string().min(1).max(64) }).safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'Invalid news item id' });
      return;
    }
    try {
      const result = await newsService.summarize(params.data.id);
      if (result === null) {
        res.status(404).json({ error: 'News article not found' });
        return;
      }
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'ARTICLE_CONTENT_UNAVAILABLE') {
        res.status(409).json({ error: 'Article text is not available yet' });
        return;
      }
      if (error instanceof Error && error.message === 'SUMMARY_IN_PROGRESS') {
        res.status(409).json({ error: 'Summary generation is already in progress' });
        return;
      }
      res.status(502).json({ error: 'Unable to generate the summary' });
    }
  });

  router.post('/news/sync', async (_req: Request, res: Response) => {
    try {
      res.json(await newsService.sync());
    } catch (error) {
      if (error instanceof NewsServiceError) {
        res.status(502).json({ error: 'Unable to read the InfoMoney news feed', code: error.code });
        return;
      }
      throw error;
    }
  });

  return router;
}
