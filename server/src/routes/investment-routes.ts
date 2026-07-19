import { Router, type Request, type Response } from 'express';
import { createInvestmentService } from '../services/investment-service.js';
import {
  validateInvestmentInput,
  validateUpdateSectorInput,
} from '../validators/investment-validator.js';
import { prisma } from '../lib/prisma-client.js';

/**
 * Creates and returns the investments router (v2).
 * NOTE: This file is being rewritten in task 4.2. Until then it uses the
 * new service methods where possible and stubs removed endpoints.
 *
 * @example
 *   app.use('/api', createInvestmentRouter());
 */
export function createInvestmentRouter(): Router {
  const router = Router();
  const service = createInvestmentService(prisma);

  // GET /api/investments — list active investments enriched with quotes
  router.get('/investments', async (_req: Request, res: Response) => {
    const investments = await service.listActiveInvestments();
    res.json(investments);
  });

  // GET /api/investments/archived — list archived investments
  router.get('/investments/archived', async (_req: Request, res: Response) => {
    const investments = await service.listArchivedInvestments();
    res.json(investments);
  });

  // POST /api/investments — create (ticker-only in v2)
  router.post('/investments', async (req: Request, res: Response) => {
    const validation = validateInvestmentInput(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.errors });
      return;
    }

    try {
      const investment = await service.createInvestment(validation.data);
      res.status(201).json(investment);
    } catch (err) {
      if (err instanceof Error && err.message.includes('is already registered')) {
        res.status(409).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  // PATCH /api/investments/:id/archive — soft-delete
  router.patch('/investments/:id/archive', async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    try {
      const investment = await service.archiveInvestment(id);
      res.json(investment);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('not found')) {
          res.status(404).json({ error: err.message });
          return;
        }
        if (err.message.includes('already archived')) {
          res.status(409).json({ error: err.message });
          return;
        }
      }
      throw err;
    }
  });

  // PUT /api/investments/:id — removed in v2; return 405
  router.put('/investments/:id', (_req: Request, res: Response) => {
    res
      .status(405)
      .json({
        error:
          'PUT method not allowed. Investments are now order-derived and cannot be manually updated',
      });
  });

  // PATCH /api/investments/:id/sector — update the sector of an investment
  router.patch('/investments/:id/sector', async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const validation = validateUpdateSectorInput(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.errors });
      return;
    }
    try {
      const investment = await service.updateSector(id, validation.data.sector);
      res.json(investment);
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
