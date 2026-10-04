import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma-client.js';

const createBillSchema = z.object({
  amount: z.number().finite().positive(),
  type: z.enum(['INTERNET', 'CLEANING', 'CONDOMINIO', 'ENERGY', 'OTHER']),
  detail: z.string().trim().max(500).nullable().optional(),
  billMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  paidBy: z.enum(['HENRIQUE', 'AMANDA']).nullable().optional(),
  isPaid: z.boolean(),
});

const updatePaidSchema = z.object({ isPaid: z.boolean() });
const settlementPaidSchema = z.object({ settlementPaid: z.boolean() });
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

function monthForDate(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function lastDayOfBillMonth(month: string): Date {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return new Date(`${month}-${String(lastDay).padStart(2, '0')}T00:00:00.000Z`);
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

    const { amount, type, detail, billMonth, paidBy, isPaid } = result.data;
    const bill = await prisma.bill.create({
      data: {
        amount,
        type,
        detail: type === 'OTHER' ? detail || null : null,
        billDate: lastDayOfBillMonth(billMonth),
        paidBy: paidBy ?? null,
        isPaid,
      },
    });
    await resetSettlement(monthForDate(bill.billDate));
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
    const { amount, type, detail, billMonth, paidBy, isPaid } = result.data;
    const bill = await prisma.bill.update({
      where: { id },
      data: {
        amount,
        type,
        detail: type === 'OTHER' ? detail || null : null,
        billDate: lastDayOfBillMonth(billMonth),
        paidBy: paidBy ?? null,
        isPaid,
      },
    });
    await resetSettlement(monthForDate(existing.billDate));
    await resetSettlement(monthForDate(bill.billDate));
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
    await resetSettlement(monthForDate(existing.billDate));
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
    await resetSettlement(monthForDate(bill.billDate));
    res.json(bill);
  });

  return router;
}
