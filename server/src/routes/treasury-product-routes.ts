import { Router, type Request, type Response } from 'express';
import { createTreasuryProductService } from '../services/treasury-product-service.js';
import { prisma } from '../lib/prisma-client.js';

/**
 * Creates and returns the treasury products router.
 * Provides the catalog of available Tesouro Direto products for the client dropdown.
 *
 * @example
 *   app.use('/api', createTreasuryProductRouter());
 */
export function createTreasuryProductRouter(): Router {
  const router = Router();
  const service = createTreasuryProductService(prisma);

  // GET /api/treasury-products — list all available treasury products
  router.get('/treasury-products', async (_req: Request, res: Response) => {
    const products = await service.listProducts();
    res.json(products);
  });

  return router;
}
