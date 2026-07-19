import { Router, type Request, type Response } from 'express';
import { createOrderService } from '../services/order-service.js';
import { validateCreateOrderInput, validateUpdateOrderInput } from '../validators/order-validator.js';
import { prisma } from '../lib/prisma-client.js';

/**
 * Creates and returns the orders router.
 * Mounts nested order routes under the investments resource.
 *
 * @example
 *   app.use('/api', createOrderRouter());
 */
export function createOrderRouter(): Router {
  const router = Router();
  const service = createOrderService(prisma);

  // POST /api/investments/:id/orders — create a new order for an investment
  router.post('/investments/:id/orders', async (req: Request, res: Response) => {
    const id = req.params['id'] as string;

    const validation = validateCreateOrderInput(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.errors });
      return;
    }

    try {
      const position = await service.createOrder(id, validation.data);
      res.status(201).json(position);
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
        if (err.message.includes('exceeds available position')) {
          res.status(422).json({ error: err.message });
          return;
        }
      }
      throw err;
    }
  });

  // GET /api/orders — list all orders across all investments (latest first)
  router.get('/orders', async (_req: Request, res: Response) => {
    const orders = await service.listAllOrders();
    res.json(orders);
  });

  // GET /api/investments/:id/orders — list all orders for an investment
  router.get('/investments/:id/orders', async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const orders = await service.listOrders(id);
    res.json(orders);
  });

  // PUT /api/investments/:id/orders/:orderId — update an existing order
  router.put('/investments/:id/orders/:orderId', async (req: Request, res: Response) => {
    const investmentId = req.params['id'] as string;
    const orderId = req.params['orderId'] as string;

    const validation = validateUpdateOrderInput(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.errors });
      return;
    }

    try {
      const position = await service.updateOrder(investmentId, orderId, validation.data);
      res.json(position);
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
        if (err.message.includes('negative position')) {
          res.status(422).json({ error: err.message });
          return;
        }
      }
      throw err;
    }
  });

  return router;
}
