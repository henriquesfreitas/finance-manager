import { Router, type Request, type Response } from 'express';
import { createCommentService } from '../services/comment-service.js';
import {
  validateCreateCommentInput,
  validateUpdateCommentInput,
} from '../validators/comment-validator.js';
import { prisma } from '../lib/prisma-client.js';

/**
 * Creates and returns the comments router.
 * Mounts nested comment routes under the investments resource.
 *
 * @example
 *   app.use('/api', createCommentRouter());
 */
export function createCommentRouter(): Router {
  const router = Router();
  const service = createCommentService(prisma);

  // GET /api/investments/:id/comments — list all comments (newest first)
  router.get('/investments/:id/comments', async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const comments = await service.listComments(id);
    res.json(comments);
  });

  // POST /api/investments/:id/comments — create a comment
  router.post('/investments/:id/comments', async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const validation = validateCreateCommentInput(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.errors });
      return;
    }
    try {
      const comment = await service.createComment(id, validation.data);
      res.status(201).json(comment);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  // PUT /api/investments/:id/comments/:commentId — update a comment
  router.put('/investments/:id/comments/:commentId', async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const commentId = req.params['commentId'] as string;
    const validation = validateUpdateCommentInput(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.errors });
      return;
    }
    try {
      const comment = await service.updateComment(id, commentId, validation.data);
      res.json(comment);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  // DELETE /api/investments/:id/comments/:commentId — delete a comment
  router.delete('/investments/:id/comments/:commentId', async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const commentId = req.params['commentId'] as string;
    try {
      await service.deleteComment(id, commentId);
      res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  return router;
}
