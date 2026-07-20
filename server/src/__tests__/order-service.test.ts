import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOrderService } from '../services/order-service.js';
import type { PrismaClient } from '@prisma/client';

// ─── Prisma fake helpers ────────────────────────────────────────────────────

function makeDecimal(value: number) {
  return { toNumber: () => value, toString: () => value.toFixed(8) };
}

function makeOrderRow(overrides: Partial<{
  id: string;
  investmentId: string;
  type: string;
  quantity: number;
  price: number;
  orderDate: Date;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  const now = new Date('2026-01-15T12:00:00Z');
  return {
    id: overrides.id ?? 'order-1',
    investmentId: overrides.investmentId ?? 'inv-1',
    type: overrides.type ?? 'BUY',
    quantity: makeDecimal(overrides.quantity ?? 100),
    price: makeDecimal(overrides.price ?? 28.35),
    orderDate: overrides.orderDate ?? now,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function makeInvestmentRow(overrides: Partial<{
  id: string;
  ticker: string;
  archivedAt: Date | null;
}> = {}) {
  return {
    id: overrides.id ?? 'inv-1',
    ticker: overrides.ticker ?? 'ITUB3',
    archivedAt: overrides.archivedAt ?? null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

function makeFakePrisma(overrides: {
  investmentFindUnique?: ReturnType<typeof vi.fn>;
  orderFindMany?: ReturnType<typeof vi.fn>;
  orderFindUnique?: ReturnType<typeof vi.fn>;
  orderCreate?: ReturnType<typeof vi.fn>;
  orderUpdate?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    investment: {
      findUnique: overrides.investmentFindUnique ?? vi.fn().mockResolvedValue(null),
    },
    order: {
      findMany: overrides.orderFindMany ?? vi.fn().mockResolvedValue([]),
      findUnique: overrides.orderFindUnique ?? vi.fn().mockResolvedValue(null),
      create: overrides.orderCreate ?? vi.fn().mockResolvedValue({}),
      update: overrides.orderUpdate ?? vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaClient;
}

// ─── createOrder ────────────────────────────────────────────────────────────

describe('createOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a BUY order and returns the computed position', async () => {
    const investment = makeInvestmentRow();
    const newOrder = makeOrderRow({ quantity: 100, price: 28.35 });
    const db = makeFakePrisma({
      investmentFindUnique: vi.fn().mockResolvedValue(investment),
      orderCreate: vi.fn().mockResolvedValue(newOrder),
      orderFindMany: vi.fn().mockResolvedValue([newOrder]),
    });

    const svc = createOrderService(db);
    const result = await svc.createOrder('inv-1', {
      type: 'BUY',
      quantity: 100,
      price: 28.35,
      orderDate: '2025-01-15',
    });

    expect(result.quantity).toBe('100');
    expect(result.averagePrice).toBe('28.35');
    expect(db.order.create).toHaveBeenCalled();
  });

  it('throws when the investment does not exist', async () => {
    const db = makeFakePrisma({
      investmentFindUnique: vi.fn().mockResolvedValue(null),
    });

    const svc = createOrderService(db);
    await expect(
      svc.createOrder('nonexistent', {
        type: 'BUY',
        quantity: 100,
        price: 10,
        orderDate: '2025-01-01',
      }),
    ).rejects.toThrow('not found');
  });

  it('throws when the investment is archived', async () => {
    const archived = makeInvestmentRow({ archivedAt: new Date('2026-01-01') });
    const db = makeFakePrisma({
      investmentFindUnique: vi.fn().mockResolvedValue(archived),
    });

    const svc = createOrderService(db);
    await expect(
      svc.createOrder('inv-1', {
        type: 'BUY',
        quantity: 100,
        price: 10,
        orderDate: '2025-01-01',
      }),
    ).rejects.toThrow('archived');
  });

  it('throws when SELL quantity exceeds current position', async () => {
    const investment = makeInvestmentRow();
    const existingOrder = makeOrderRow({ quantity: 50, price: 10 });
    const db = makeFakePrisma({
      investmentFindUnique: vi.fn().mockResolvedValue(investment),
      orderFindMany: vi.fn().mockResolvedValue([existingOrder]),
    });

    const svc = createOrderService(db);
    await expect(
      svc.createOrder('inv-1', {
        type: 'SELL',
        quantity: 100,
        price: 15,
        orderDate: '2025-06-01',
      }),
    ).rejects.toThrow('exceeds');
  });

  it('allows SELL when quantity equals current position', async () => {
    const investment = makeInvestmentRow();
    const existingBuy = makeOrderRow({ quantity: 100, price: 10 });
    const afterSell = [
      makeOrderRow({ type: 'BUY', quantity: 100, price: 10 }),
      makeOrderRow({ id: 'order-2', type: 'SELL', quantity: 100, price: 15 }),
    ];
    const db = makeFakePrisma({
      investmentFindUnique: vi.fn().mockResolvedValue(investment),
      orderCreate: vi.fn().mockResolvedValue({}),
      orderFindMany: vi.fn()
        .mockResolvedValueOnce([existingBuy]) // for SELL validation
        .mockResolvedValueOnce(afterSell),     // for position computation
    });

    const svc = createOrderService(db);
    const result = await svc.createOrder('inv-1', {
      type: 'SELL',
      quantity: 100,
      price: 15,
      orderDate: '2025-06-01',
    });

    expect(result.quantity).toBe('0');
    expect(result.averagePrice).toBe('0');
  });

  it('auto-populates averagePriceAtSell from computed position on SELL create', async () => {
    const investment = makeInvestmentRow();
    // Two BUY orders: avg = (100*10 + 100*20) / 200 = 15
    const existingOrders = [
      makeOrderRow({ id: 'o1', type: 'BUY', quantity: 100, price: 10 }),
      makeOrderRow({ id: 'o2', type: 'BUY', quantity: 100, price: 20 }),
    ];
    const afterSellOrders = [
      ...existingOrders,
      makeOrderRow({ id: 'o3', type: 'SELL', quantity: 50, price: 25 }),
    ];
    const orderCreate = vi.fn().mockResolvedValue({});
    const db = makeFakePrisma({
      investmentFindUnique: vi.fn().mockResolvedValue(investment),
      orderCreate,
      orderFindMany: vi.fn()
        .mockResolvedValueOnce(existingOrders)  // for SELL validation + PM computation
        .mockResolvedValueOnce(afterSellOrders), // for updated position
    });

    const svc = createOrderService(db);
    await svc.createOrder('inv-1', {
      type: 'SELL',
      quantity: 50,
      price: 25,
      orderDate: '2025-06-01',
    });

    // averagePriceAtSell should be the weighted average: 15
    const createCall = orderCreate.mock.calls[0]?.[0] as { data: { averagePriceAtSell: number } };
    expect(createCall.data.averagePriceAtSell).toBeCloseTo(15);
  });

  it('uses caller-supplied averagePriceAtSell when provided on SELL create', async () => {
    const investment = makeInvestmentRow();
    const existingBuy = makeOrderRow({ quantity: 100, price: 10 });
    const afterSell = [existingBuy, makeOrderRow({ id: 'o2', type: 'SELL', quantity: 50, price: 15 })];
    const orderCreate = vi.fn().mockResolvedValue({});
    const db = makeFakePrisma({
      investmentFindUnique: vi.fn().mockResolvedValue(investment),
      orderCreate,
      orderFindMany: vi.fn()
        .mockResolvedValueOnce([existingBuy])
        .mockResolvedValueOnce(afterSell),
    });

    const svc = createOrderService(db);
    await svc.createOrder('inv-1', {
      type: 'SELL',
      quantity: 50,
      price: 15,
      orderDate: '2025-06-01',
      averagePriceAtSell: 9.99, // user override
    });

    const createCall = orderCreate.mock.calls[0]?.[0] as { data: { averagePriceAtSell: number } };
    expect(createCall.data.averagePriceAtSell).toBeCloseTo(9.99);
  });

  it('sets averagePriceAtSell to null for BUY orders', async () => {
    const investment = makeInvestmentRow();
    const newOrder = makeOrderRow({ quantity: 100, price: 28.35 });
    const orderCreate = vi.fn().mockResolvedValue({});
    const db = makeFakePrisma({
      investmentFindUnique: vi.fn().mockResolvedValue(investment),
      orderCreate,
      orderFindMany: vi.fn().mockResolvedValue([newOrder]),
    });

    const svc = createOrderService(db);
    await svc.createOrder('inv-1', {
      type: 'BUY',
      quantity: 100,
      price: 28.35,
      orderDate: '2025-01-15',
    });

    const createCall = orderCreate.mock.calls[0]?.[0] as { data: { averagePriceAtSell: null } };
    expect(createCall.data.averagePriceAtSell).toBeNull();
  });

  it('rejects invalid input (e.g. negative quantity)', async () => {
    const db = makeFakePrisma();
    const svc = createOrderService(db);

    await expect(
      svc.createOrder('inv-1', {
        type: 'BUY',
        quantity: -5,
        price: 10,
        orderDate: '2025-01-01',
      }),
    ).rejects.toThrow();
  });
});

// ─── listOrders ─────────────────────────────────────────────────────────────

describe('listOrders', () => {
  it('returns serialised order records sorted by date DESC', async () => {
    const orders = [
      makeOrderRow({ id: 'o2', orderDate: new Date('2025-06-01T12:00:00Z') }),
      makeOrderRow({ id: 'o1', orderDate: new Date('2025-01-01T12:00:00Z') }),
    ];
    const db = makeFakePrisma({
      orderFindMany: vi.fn().mockResolvedValue(orders),
    });

    const svc = createOrderService(db);
    const result = await svc.listOrders('inv-1');

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('o2');
    expect(result[0]?.orderDate).toBe('2025-06-01');
  });

  it('returns empty array when no orders exist', async () => {
    const db = makeFakePrisma({ orderFindMany: vi.fn().mockResolvedValue([]) });
    const svc = createOrderService(db);

    const result = await svc.listOrders('inv-1');
    expect(result).toEqual([]);
  });
});

// ─── listAllOrders ──────────────────────────────────────────────────────────

describe('listAllOrders', () => {
  it('returns orders enriched with ticker from investment', async () => {
    const orderWithInvestment = {
      ...makeOrderRow(),
      investment: { ticker: 'PETR4' },
    };
    const db = makeFakePrisma({
      orderFindMany: vi.fn().mockResolvedValue([orderWithInvestment]),
    });

    const svc = createOrderService(db);
    const result = await svc.listAllOrders();

    expect(result).toHaveLength(1);
    expect(result[0]?.ticker).toBe('PETR4');
  });
});

// ─── updateOrder ────────────────────────────────────────────────────────────

describe('updateOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates the order and returns the new position', async () => {
    const investment = makeInvestmentRow();
    const existingOrder = makeOrderRow({ quantity: 100, price: 28.35 });
    const updatedOrder = makeOrderRow({ quantity: 100, price: 30 });
    const db = makeFakePrisma({
      investmentFindUnique: vi.fn().mockResolvedValue(investment),
      orderFindUnique: vi.fn().mockResolvedValue({ ...existingOrder, investmentId: 'inv-1' }),
      orderUpdate: vi.fn().mockResolvedValue(updatedOrder),
      orderFindMany: vi.fn().mockResolvedValue([updatedOrder]),
    });

    const svc = createOrderService(db);
    const result = await svc.updateOrder('inv-1', 'order-1', { price: 30 });

    expect(result.quantity).toBe('100');
    expect(result.averagePrice).toBe('30');
    expect(db.order.update).toHaveBeenCalled();
  });

  it('throws when the order is not found', async () => {
    const db = makeFakePrisma({
      orderFindUnique: vi.fn().mockResolvedValue(null),
    });

    const svc = createOrderService(db);
    await expect(
      svc.updateOrder('inv-1', 'nonexistent', { price: 30 }),
    ).rejects.toThrow('not found');
  });

  it('throws when the investment is archived', async () => {
    const archived = makeInvestmentRow({ archivedAt: new Date() });
    const order = { ...makeOrderRow(), investmentId: 'inv-1' };
    const db = makeFakePrisma({
      investmentFindUnique: vi.fn().mockResolvedValue(archived),
      orderFindUnique: vi.fn().mockResolvedValue(order),
    });

    const svc = createOrderService(db);
    await expect(
      svc.updateOrder('inv-1', 'order-1', { price: 30 }),
    ).rejects.toThrow('archived');
  });

  it('rolls back and throws when edit would result in negative position', async () => {
    const investment = makeInvestmentRow();
    const originalOrder = {
      ...makeOrderRow({ type: 'BUY', quantity: 100, price: 10 }),
      investmentId: 'inv-1',
    };
    // After update, the order becomes a SELL of 200, but there's nothing to sell
    const afterUpdateOrders = [
      makeOrderRow({ id: 'order-1', type: 'SELL', quantity: 200, price: 15 }),
    ];

    const orderUpdate = vi.fn().mockResolvedValue({});
    const db = makeFakePrisma({
      investmentFindUnique: vi.fn().mockResolvedValue(investment),
      orderFindUnique: vi.fn().mockResolvedValue(originalOrder),
      orderUpdate,
      orderFindMany: vi.fn().mockResolvedValue(afterUpdateOrders),
    });

    const svc = createOrderService(db);
    await expect(
      svc.updateOrder('inv-1', 'order-1', { type: 'SELL', quantity: 200 }),
    ).rejects.toThrow('negative position');

    // Should have been called twice: once for the update, once for the rollback
    expect(orderUpdate).toHaveBeenCalledTimes(2);
  });
});
