import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma-client.js';

const createBudgetSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

const budgetItemSchema = z.object({
  value: z.number().finite()
    .refine((value) => Math.abs(value) < 1e16, 'Value is outside the supported range')
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7, 'Value may have at most two decimal places'),
  itemDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/).refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }),
  description: z.string().trim().max(500).nullable().optional(),
  additionalInfo: z.string().trim().max(2000).nullable().optional(),
  isPaid: z.boolean().optional().default(false),
});

function adminIdFromRequest(req: Request, res: Response): string | null {
  if (!req.adminId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return req.adminId;
}

function validationError(res: Response, error: z.ZodError): void {
  res.status(400).json({ error: 'Validation failed', details: error.issues });
}

function hasAdminPermission(req: Request): boolean {
  return req.permissions?.includes('ADMIN') ?? false;
}

export function createBudgetRouter(): Router {
  const router = Router();

  router.get('/budgets/users', async (req: Request, res: Response) => {
    if (!hasAdminPermission(req)) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }
    const users = await prisma.adminUser.findMany({
      where: { budgets: { some: {} } },
      select: {
        id: true,
        username: true,
        budgets: {
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          select: { id: true, name: true, createdAt: true },
        },
      },
      orderBy: { username: 'asc' },
    });
    res.json(users);
  });

  router.get('/budgets', async (req: Request, res: Response) => {
    const ownerId = adminIdFromRequest(req, res);
    if (!ownerId) return;
    const budgets = await prisma.budget.findMany({
      where: { ownerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    res.json(budgets);
  });

  router.post('/budgets', async (req: Request, res: Response) => {
    const ownerId = adminIdFromRequest(req, res);
    if (!ownerId) return;
    const result = createBudgetSchema.safeParse(req.body);
    if (!result.success) {
      validationError(res, result.error);
      return;
    }
    const budget = await prisma.budget.create({ data: { ...result.data, ownerId } });
    res.status(201).json(budget);
  });

  router.get('/budgets/:budgetId', async (req: Request, res: Response) => {
    const ownerId = adminIdFromRequest(req, res);
    if (!ownerId) return;
    const budget = await prisma.budget.findFirst({
      where: { id: req.params['budgetId'] as string, ...(hasAdminPermission(req) ? {} : { ownerId }) },
      include: { items: { orderBy: [{ itemDate: 'desc' }, { createdAt: 'desc' }] } },
    });
    if (!budget) {
      res.status(404).json({ error: 'Budget not found' });
      return;
    }
    res.json(budget);
  });

  router.post('/budgets/:budgetId/items', async (req: Request, res: Response) => {
    const ownerId = adminIdFromRequest(req, res);
    if (!ownerId) return;
    const result = budgetItemSchema.safeParse(req.body);
    if (!result.success) {
      validationError(res, result.error);
      return;
    }
    const budgetId = req.params['budgetId'] as string;
    const budget = await prisma.budget.findFirst({ where: { id: budgetId, ...(hasAdminPermission(req) ? {} : { ownerId }) }, select: { id: true } });
    if (!budget) {
      res.status(404).json({ error: 'Budget not found' });
      return;
    }
    const item = await prisma.budgetItem.create({
      data: {
        budgetId,
        value: result.data.value,
        itemDate: new Date(`${result.data.itemDate}T00:00:00.000Z`),
        description: result.data.description || null,
        additionalInfo: result.data.additionalInfo || null,
        isPaid: result.data.isPaid,
      },
    });
    res.status(201).json(item);
  });

  router.put('/budgets/:budgetId/items/:itemId', async (req: Request, res: Response) => {
    const ownerId = adminIdFromRequest(req, res);
    if (!ownerId) return;
    const result = budgetItemSchema.safeParse(req.body);
    if (!result.success) {
      validationError(res, result.error);
      return;
    }
    const budgetId = req.params['budgetId'] as string;
    const itemId = req.params['itemId'] as string;
    const existing = await prisma.budgetItem.findFirst({
      where: { id: itemId, budgetId, ...(hasAdminPermission(req) ? {} : { budget: { ownerId } }) },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Budget item not found' });
      return;
    }
    const item = await prisma.budgetItem.update({
      where: { id: itemId },
      data: {
        value: result.data.value,
        itemDate: new Date(`${result.data.itemDate}T00:00:00.000Z`),
        description: result.data.description || null,
        additionalInfo: result.data.additionalInfo || null,
        isPaid: result.data.isPaid,
      },
    });
    res.json(item);
  });

  router.delete('/budgets/:budgetId/items/:itemId', async (req: Request, res: Response) => {
    const ownerId = adminIdFromRequest(req, res);
    if (!ownerId) return;
    const budgetId = req.params['budgetId'] as string;
    const itemId = req.params['itemId'] as string;
    const existing = await prisma.budgetItem.findFirst({
      where: { id: itemId, budgetId, ...(hasAdminPermission(req) ? {} : { budget: { ownerId } }) },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Budget item not found' });
      return;
    }
    await prisma.budgetItem.delete({ where: { id: itemId } });
    res.status(204).end();
  });

  return router;
}
