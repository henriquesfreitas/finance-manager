import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma-client.js';
import { createPortfolioCommentService } from '../services/portfolio-comment-service.js';
import { validatePortfolioCommentInput } from '../validators/portfolio-comment-validator.js';

function isMissingRecordError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'P2025';
}

export function createPortfolioCommentRouter(): Router {
  const router = Router();
  const service = createPortfolioCommentService(prisma);

  router.get('/investments/plan-comments', async (_req: Request, res: Response) => {
    res.json(await service.listComments());
  });

  router.post('/investments/plan-comments', async (req: Request, res: Response) => {
    const validation = validatePortfolioCommentInput(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.errors });
      return;
    }
    res.status(201).json(await service.createComment(validation.data));
  });

  router.put('/investments/plan-comments/:commentId', async (req: Request, res: Response) => {
    const validation = validatePortfolioCommentInput(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.errors });
      return;
    }
    try {
      res.json(await service.updateComment(req.params['commentId'] as string, validation.data));
    } catch (error) {
      if (isMissingRecordError(error)) {
        res.status(404).json({ error: 'Portfolio comment not found' });
        return;
      }
      throw error;
    }
  });

  router.delete('/investments/plan-comments/:commentId', async (req: Request, res: Response) => {
    try {
      await service.deleteComment(req.params['commentId'] as string);
      res.status(204).send();
    } catch (error) {
      if (isMissingRecordError(error)) {
        res.status(404).json({ error: 'Portfolio comment not found' });
        return;
      }
      throw error;
    }
  });

  return router;
}
