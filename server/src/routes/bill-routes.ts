import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma-client.js';

const createBillSchema = z.object({
  amount: z.number().finite().positive(),
  type: z.enum(['INTERNET', 'CLEANING', 'CONDOMINIO', 'ENERGY', 'OTHER']),
  billDate: z.iso.date(),
  paidBy: z.enum(['HENRIQUE', 'AMANDA']).nullable().optional(),
  isPaid: z.boolean(),
});

const updatePaidSchema = z.object({ isPaid: z.boolean() });
const settlementPaidSchema = z.object({ settlementPaid: z.boolean() });
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

function billMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}

async function resetSettlement(month: string): Promise<void> {
  await prisma.billMonthSettlement.updateMany({
    where: { month, settlementPaid: true },
    data: { settlementPaid: false },
  });
}

export function createBillRouter(): Router {
  const router = Router();

  router.get('/bills', async (_req: Request, res: Response) => {
    const bills = await prisma.bill.findMany({
      orderBy: [{ billDate: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(bills);
  });

  router.get('/bills/settlements', async (_req: Request, res: Response) => {
    const settlements = await prisma.billMonthSettlement.findMany({ orderBy: { month: 'desc' } });
    res.json(settlements);
  });

  router.patch('/bills/settlements/:month', async (req: Request, res: Response) => {
    const month = req.params['month'] as string;
    if (!monthSchema.safeParse(month).success) {
      res.status(400).json({ error: 'Month must use YYYY-MM format' });
      return;
    }
    const result = settlementPaidSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.issues });
      return;
    }
    const settlement = await prisma.billMonthSettlement.upsert({
      where: { month },
      create: { month, settlementPaid: result.data.settlementPaid },
      update: { settlementPaid: result.data.settlementPaid },
    });
    res.json(settlement);
  });

  router.post('/bills', async (req: Request, res: Response) => {
    const result = createBillSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.issues });
      return;
    }

    const { amount, type, billDate, paidBy, isPaid } = result.data;
    const bill = await prisma.bill.create({
      data: {
        amount,
        type,
        billDate: new Date(`${billDate}T00:00:00.000Z`),
        paidBy: paidBy ?? null,
        isPaid,
      },
    });
    await resetSettlement(billMonth(bill.billDate));
    res.status(201).json(bill);
  });

  router.put('/bills/:id', async (req: Request, res: Response) => {
    const result = createBillSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.issues });
      return;
    }
    const id = req.params['id'] as string;
    const existing = await prisma.bill.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Bill not found' });
      return;
    }
    const { amount, type, billDate, paidBy, isPaid } = result.data;
    const bill = await prisma.bill.update({
      where: { id },
      data: { amount, type, billDate: new Date(`${billDate}T00:00:00.000Z`), paidBy: paidBy ?? null, isPaid },
    });
    await resetSettlement(billMonth(existing.billDate));
    await resetSettlement(billMonth(bill.billDate));
    res.json(bill);
  });

  router.delete('/bills/:id', async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const existing = await prisma.bill.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Bill not found' });
      return;
    }
    await prisma.bill.delete({ where: { id } });
    await resetSettlement(billMonth(existing.billDate));
    res.status(204).end();
  });

  router.patch('/bills/:id/paid', async (req: Request, res: Response) => {
    const result = updatePaidSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.issues });
      return;
    }
    const id = req.params['id'] as string;
    const existing = await prisma.bill.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Bill not found' });
      return;
    }
    const bill = await prisma.bill.update({ where: { id }, data: { isPaid: result.data.isPaid } });
    await resetSettlement(billMonth(bill.billDate));
    res.json(bill);
  });

  return router;
}
