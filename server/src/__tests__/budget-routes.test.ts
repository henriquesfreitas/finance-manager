import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { AppPermission } from '@prisma/client';

const fakePrisma = {
  budget: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  budgetItem: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock('../lib/prisma-client.js', () => ({ prisma: fakePrisma }));

const { createBudgetRouter } = await import('../routes/budget-routes.js');
const { requirePermission } = await import('../middleware/permission-middleware.js');

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.adminId = req.header('x-admin-id') ?? 'admin-1';
    req.permissions = (req.header('x-permissions')?.split(',') ?? ['BUDGET']) as AppPermission[];
    next();
  });
  app.use('/api/budgets', requirePermission('BUDGET'));
  app.use('/api', createBudgetRouter());
  return app;
}

const itemPayload = {
  value: -12.5,
  itemDate: '2026-10-20',
  description: 'Refund',
  additionalInfo: 'Adjustment',
  isPaid: false,
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('budget routes', () => {
  it('requires the BUDGET permission', async () => {
    const response = await request(buildApp()).get('/api/budgets').set('x-permissions', 'INVESTMENTS');
    expect(response.status).toBe(403);
    expect(fakePrisma.budget.findMany).not.toHaveBeenCalled();
  });

  it('lists budgets scoped to the authenticated owner', async () => {
    fakePrisma.budget.findMany.mockResolvedValueOnce([]);
    const response = await request(buildApp()).get('/api/budgets').set('x-admin-id', 'owner-2');
    expect(response.status).toBe(200);
    expect(fakePrisma.budget.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 'owner-2' } }));
  });

  it('creates a budget using the session owner and a trimmed name', async () => {
    fakePrisma.budget.create.mockResolvedValueOnce({ id: 'budget-1', name: 'Travel', ownerId: 'owner-2' });
    const response = await request(buildApp()).post('/api/budgets').set('x-admin-id', 'owner-2').send({ name: ' Travel ' });
    expect(response.status).toBe(201);
    expect(fakePrisma.budget.create).toHaveBeenCalledWith({ data: { name: 'Travel', ownerId: 'owner-2' } });
  });

  it('does not return a budget owned by someone else', async () => {
    fakePrisma.budget.findFirst.mockResolvedValueOnce(null);
    const response = await request(buildApp()).get('/api/budgets/private-budget').set('x-admin-id', 'owner-2');
    expect(response.status).toBe(404);
    expect(fakePrisma.budget.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'private-budget', ownerId: 'owner-2' } }));
  });

  it('creates signed item values under a budget owned by the session user', async () => {
    fakePrisma.budget.findFirst.mockResolvedValueOnce({ id: 'budget-1' });
    fakePrisma.budgetItem.create.mockResolvedValueOnce({ id: 'item-1', budgetId: 'budget-1', ...itemPayload });
    const response = await request(buildApp()).post('/api/budgets/budget-1/items').set('x-admin-id', 'owner-2').send(itemPayload);
    expect(response.status).toBe(201);
    expect(fakePrisma.budget.findFirst).toHaveBeenCalledWith({ where: { id: 'budget-1', ownerId: 'owner-2' }, select: { id: true } });
    expect(fakePrisma.budgetItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ budgetId: 'budget-1', value: -12.5 }) }));
  });

  it('defaults a new item to unpaid and rejects invalid precision and dates', async () => {
    fakePrisma.budget.findFirst.mockResolvedValue({ id: 'budget-1' });
    fakePrisma.budgetItem.create.mockResolvedValue({ id: 'item-1' });
    const app = buildApp();
    const defaultPaidResponse = await request(app).post('/api/budgets/budget-1/items').send({ value: 0, itemDate: '2026-10-20' });
    expect(defaultPaidResponse.status).toBe(201);
    expect(fakePrisma.budgetItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isPaid: false }) }));
    const invalidValue = await request(app).post('/api/budgets/budget-1/items').send({ value: 1.234, itemDate: '2026-10-20' });
    const invalidDate = await request(app).post('/api/budgets/budget-1/items').send({ value: 1, itemDate: '2026-02-30' });
    expect(invalidValue.status).toBe(400);
    expect(invalidDate.status).toBe(400);
  });

  it('does not update or delete an item unless its budget belongs to the session user', async () => {
    fakePrisma.budgetItem.findFirst.mockResolvedValue(null);
    const app = buildApp();
    const update = await request(app).put('/api/budgets/budget-1/items/item-1').send(itemPayload);
    const remove = await request(app).delete('/api/budgets/budget-1/items/item-1');
    expect(update.status).toBe(404);
    expect(remove.status).toBe(404);
    expect(fakePrisma.budgetItem.update).not.toHaveBeenCalled();
    expect(fakePrisma.budgetItem.delete).not.toHaveBeenCalled();
  });
});
