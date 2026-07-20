import { Router, type Request, type Response } from 'express';
import { createInvestmentService } from '../services/investment-service.js';
import {
  validateInvestmentInput,
  validateUpdateSectorInput,
  validateUpdateTargetPricesInput,
  validateCreateTreasuryInvestmentInput,
  validateUpdateCurrentValueInput,
} from '../validators/investment-validator.js';
import { prisma } from '../lib/prisma-client.js';

/**
 * Creates and returns the investments router (v3).
 * Supports both STOCK and TREASURY asset types.
 * Creation is dispatched by the `type` field in the request body:
 *   - type: "STOCK"    → requires ticker + sector
 *   - type: "TREASURY" → requires treasuryProductId
 *
 * @example
 *   app.use('/api', createInvestmentRouter());
 */
export function createInvestmentRouter(): Router {
  const router = Router();
  const service = createInvestmentService(prisma);

  // GET /api/investments — list active investments enriched with quotes/currentValue
  router.get('/investments', async (_req: Request, res: Response) => {
    const investments = await service.listActiveInvestments();
    res.json(investments);
  });

  // GET /api/investments/archived — list archived investments
  router.get('/investments/archived', async (_req: Request, res: Response) => {
    const investments = await service.listArchivedInvestments();
    res.json(investments);
  });

  // POST /api/investments — create a STOCK or TREASURY investment
  // Body must include `type: "STOCK" | "TREASURY"` to select the creation path.
  router.post('/investments', async (req: Request, res: Response) => {
    const { type } = req.body as { type?: unknown };

    if (type === 'TREASURY') {
      const validation = validateCreateTreasuryInvestmentInput(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.errors });
        return;
      }
      try {
        const investment = await service.createTreasuryInvestment(validation.data);
        res.status(201).json(investment);
      } catch (err) {
        if (err instanceof Error) {
          if (err.message.includes('not found')) {
            res.status(404).json({ error: err.message });
            return;
          }
          if (err.message.includes('already registered')) {
            res.status(409).json({ error: err.message });
            return;
          }
        }
        throw err;
      }
      return;
    }

    // Default path: STOCK (also handles missing type for backwards compatibility)
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
    res.status(405).json({
      error: 'PUT method not allowed. Investments are now order-derived and cannot be manually updated',
    });
  });

  // PATCH /api/investments/:id/target-prices — update target sell/buy prices
  router.patch('/investments/:id/target-prices', async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const validation = validateUpdateTargetPricesInput(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.errors });
      return;
    }
    try {
      const investment = await service.updateTargetPrices(id, validation.data);
      res.json(investment);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  // PATCH /api/investments/:id/current-value — update manual current value (TREASURY)
  router.patch('/investments/:id/current-value', async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const validation = validateUpdateCurrentValueInput(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.errors });
      return;
    }
    try {
      const investment = await service.updateCurrentValue(id, validation.data);
      res.json(investment);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      throw err;
    }
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
