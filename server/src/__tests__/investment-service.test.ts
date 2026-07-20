import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInvestmentService } from '../services/investment-service.js';
import type { PrismaClient } from '@prisma/client';
import type { MarketQuote } from '../types/investment.js';

// Mock the Yahoo Finance quote service — tests must not hit the real API
vi.mock('../services/yahoo-finance-quote-service.js', () => ({
  fetchQuotes: vi.fn(),
  fetchQuote: vi.fn(),
}));

import { fetchQuotes } from '../services/yahoo-finance-quote-service.js';
const mockedFetchQuotes = vi.mocked(fetchQuotes);

// ─── Prisma fake ─────────────────────────────────────────────────────────────

/** Factory for a minimal Prisma fake scoped to the investment model. */
function makeFakePrisma(overrides: Partial<{
  findMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    investment: {
      findMany: overrides.findMany ?? vi.fn().mockResolvedValue([]),
      findUnique: overrides.findUnique ?? vi.fn().mockResolvedValue(null),
      create: overrides.create ?? vi.fn(),
      update: overrides.update ?? vi.fn(),
    },
  } as unknown as PrismaClient;
}

/** Builds a minimal Prisma v3 investment row (no orders). */
function makeRow(partial: Partial<{
  id: string;
  ticker: string;
  type: 'STOCK' | 'TREASURY';
  sector: string | null;
  archivedAt: Date | null;
}> = {}) {
  return {
    id: partial.id ?? 'uuid-1',
    ticker: partial.ticker ?? 'ITUB3',
    type: partial.type ?? 'STOCK',
    sector: partial.sector ?? null,
    archivedAt: partial.archivedAt ?? null,
    targetSellPrice: null,
    targetBuyPrice: null,
    currentValue: null,
    treasuryProductId: null,
    treasuryProduct: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    orders: [] as Array<{
      type: 'BUY' | 'SELL';
      quantity: { toNumber(): number };
      price: { toNumber(): number };
    }>,
  };
}

/** Builds a Prisma order row with Decimal-like quantity and price. */
function makeOrderRow(type: 'BUY' | 'SELL', quantity: number, price: number) {
  return {
    type,
    quantity: { toNumber: () => quantity },
    price: { toNumber: () => price },
  };
}

const MOCK_QUOTE: MarketQuote = { currentPrice: 29.5, dailyChangePercent: 1.2 };

// ─── createInvestment ─────────────────────────────────────────────────────────

describe('createInvestment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates and returns the investment record when ticker is new', async () => {
    const row = makeRow();
    const db = makeFakePrisma({
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(row),
    });
    const svc = createInvestmentService(db);

    const result = await svc.createInvestment({ ticker: 'ITUB3', sector: 'Bancos' });

    expect(result.ticker).toBe('ITUB3');
    expect(result.archivedAt).toBeNull();
    expect(db.investment.create).toHaveBeenCalledWith({
      data: { ticker: 'ITUB3', sector: 'Bancos', type: 'STOCK' },
      include: { treasuryProduct: { select: { name: true } } },
    });
  });

  it('throws with a 409-friendly message when ticker is already registered', async () => {
    const existing = makeRow({ ticker: 'ITUB3' });
    const db = makeFakePrisma({
      findUnique: vi.fn().mockResolvedValue(existing),
    });
    const svc = createInvestmentService(db);

    await expect(svc.createInvestment({ ticker: 'ITUB3', sector: 'Bancos' })).rejects.toThrow(
      'Ticker "ITUB3" is already registered',
    );
    expect(db.investment.create).not.toHaveBeenCalled();
  });
});

// ─── listActiveInvestments ────────────────────────────────────────────────────

describe('listActiveInvestments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an empty array and skips quote fetch when no active investments exist', async () => {
    const db = makeFakePrisma({ findMany: vi.fn().mockResolvedValue([]) });
    const svc = createInvestmentService(db);

    const result = await svc.listActiveInvestments();

    expect(result).toEqual([]);
    expect(mockedFetchQuotes).not.toHaveBeenCalled();
  });

  it('returns enriched investments with computed position and live quote', async () => {
    const row = {
      ...makeRow({ ticker: 'ITUB3' }),
      orders: [
        makeOrderRow('BUY', 100, 28.35),
        makeOrderRow('BUY', 50, 30.0),
      ],
    };
    const db = makeFakePrisma({ findMany: vi.fn().mockResolvedValue([row]) });
    mockedFetchQuotes.mockResolvedValueOnce(new Map([['ITUB3', MOCK_QUOTE]]));

    const svc = createInvestmentService(db);
    const result = await svc.listActiveInvestments();

    expect(result).toHaveLength(1);
    expect(result[0]?.ticker).toBe('ITUB3');
    expect(result[0]?.quote).toEqual(MOCK_QUOTE);
    expect(result[0]?.position).toBeDefined();
    expect(result[0]?.position.quantity).toBe('150.00000000');
  });

  it('sets quote to null when Yahoo Finance is unavailable', async () => {
    const row = makeRow({ ticker: 'PETR4' });
    const db = makeFakePrisma({ findMany: vi.fn().mockResolvedValue([row]) });
    mockedFetchQuotes.mockResolvedValueOnce(new Map([['PETR4', null]]));

    const svc = createInvestmentService(db);
    const result = await svc.listActiveInvestments();

    expect(result[0]?.quote).toBeNull();
  });

  it('only queries investments where archivedAt IS NULL', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = makeFakePrisma({ findMany });
    const svc = createInvestmentService(db);

    await svc.listActiveInvestments();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { archivedAt: null },
      }),
    );
  });
});

// ─── listArchivedInvestments ──────────────────────────────────────────────────

describe('listArchivedInvestments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an empty array when no investments are archived', async () => {
    const db = makeFakePrisma({ findMany: vi.fn().mockResolvedValue([]) });
    const svc = createInvestmentService(db);

    const result = await svc.listArchivedInvestments();

    expect(result).toEqual([]);
  });

  it('returns archived investments with their final computed position', async () => {
    const archivedAt = new Date('2026-06-01T10:00:00Z');
    const row = {
      ...makeRow({ ticker: 'VALE3', archivedAt }),
      orders: [makeOrderRow('BUY', 200, 75.0)],
    };
    const db = makeFakePrisma({ findMany: vi.fn().mockResolvedValue([row]) });
    const svc = createInvestmentService(db);

    const result = await svc.listArchivedInvestments();

    expect(result).toHaveLength(1);
    expect(result[0]?.ticker).toBe('VALE3');
    expect(result[0]?.archivedAt).toBe(archivedAt.toISOString());
    expect(result[0]?.position.quantity).toBe('200.00000000');
    // No quote on archived investments — interface does not include it
    expect('quote' in (result[0] ?? {})).toBe(false);
  });

  it('only queries investments where archivedAt IS NOT NULL', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = makeFakePrisma({ findMany });
    const svc = createInvestmentService(db);

    await svc.listArchivedInvestments();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { archivedAt: { not: null } },
      }),
    );
  });
});

// ─── archiveInvestment ────────────────────────────────────────────────────────

describe('archiveInvestment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets archivedAt and returns the updated record on success', async () => {
    const archivedAt = new Date('2026-06-15T08:00:00Z');
    const existing = makeRow({ ticker: 'ITUB3' });
    const updated = { ...existing, archivedAt };
    const db = makeFakePrisma({
      findUnique: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue(updated),
    });
    const svc = createInvestmentService(db);

    const result = await svc.archiveInvestment('uuid-1');

    expect(result.archivedAt).toBe(archivedAt.toISOString());
    expect(db.investment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'uuid-1' } }),
    );
  });

  it('throws a not-found error when the investment does not exist', async () => {
    const db = makeFakePrisma({
      findUnique: vi.fn().mockResolvedValue(null),
    });
    const svc = createInvestmentService(db);

    await expect(svc.archiveInvestment('nonexistent')).rejects.toThrow(
      'Investment with id "nonexistent" not found',
    );
    expect(db.investment.update).not.toHaveBeenCalled();
  });

  it('throws an already-archived error when the investment is already archived', async () => {
    const existing = makeRow({ ticker: 'ITUB3', archivedAt: new Date('2026-05-01') });
    const db = makeFakePrisma({
      findUnique: vi.fn().mockResolvedValue(existing),
    });
    const svc = createInvestmentService(db);

    await expect(svc.archiveInvestment('uuid-1')).rejects.toThrow(
      'Investment "ITUB3" is already archived',
    );
    expect(db.investment.update).not.toHaveBeenCalled();
  });
});

// ─── updateTargetPrices ───────────────────────────────────────────────────────

describe('updateTargetPrices', () => {
  beforeEach(() => vi.clearAllMocks());

  /** Builds a Decimal-like stub as Prisma would return. */
  function decimalStub(value: number) {
    return { toString: () => String(value) };
  }

  it('updates targetSellPrice and returns the updated record', async () => {
    const existing = makeRow({ ticker: 'ITUB3' });
    const updated = {
      ...existing,
      targetSellPrice: decimalStub(35.5),
      targetBuyPrice: null,
    };
    const db = makeFakePrisma({
      findUnique: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue(updated),
    });
    const svc = createInvestmentService(db);

    const result = await svc.updateTargetPrices('uuid-1', { targetSellPrice: 35.5 });

    expect(result.targetSellPrice).toBe('35.5');
    expect(result.targetBuyPrice).toBeNull();
    expect(db.investment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'uuid-1' } }),
    );
  });

  it('updates targetBuyPrice and returns the updated record', async () => {
    const existing = makeRow({ ticker: 'ITUB3' });
    const updated = {
      ...existing,
      targetSellPrice: null,
      targetBuyPrice: decimalStub(28.0),
    };
    const db = makeFakePrisma({
      findUnique: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue(updated),
    });
    const svc = createInvestmentService(db);

    const result = await svc.updateTargetPrices('uuid-1', { targetBuyPrice: 28.0 });

    expect(result.targetBuyPrice).toBe('28');
    expect(db.investment.update).toHaveBeenCalled();
  });

  it('clears targetSellPrice when null is passed', async () => {
    const existing = makeRow({ ticker: 'ITUB3' });
    const updated = { ...existing, targetSellPrice: null, targetBuyPrice: null };
    const db = makeFakePrisma({
      findUnique: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue(updated),
    });
    const svc = createInvestmentService(db);

    const result = await svc.updateTargetPrices('uuid-1', { targetSellPrice: null });

    expect(result.targetSellPrice).toBeNull();
  });

  it('throws a not-found error when the investment does not exist', async () => {
    const db = makeFakePrisma({ findUnique: vi.fn().mockResolvedValue(null) });
    const svc = createInvestmentService(db);

    await expect(
      svc.updateTargetPrices('nonexistent', { targetSellPrice: 35.5 }),
    ).rejects.toThrow('Investment with id "nonexistent" not found');
    expect(db.investment.update).not.toHaveBeenCalled();
  });
});

// ─── createTreasuryInvestment ─────────────────────────────────────────────────

describe('createTreasuryInvestment', () => {
  beforeEach(() => vi.clearAllMocks());

  function makeTreasuryProductRow(partial: Partial<{ id: string; name: string; slug: string }> = {}) {
    return {
      id: partial.id ?? 'prod-uuid-1',
      name: partial.name ?? 'Tesouro IPCA+ 2026',
      slug: partial.slug ?? 'TESOURO-IPCA-2026',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
  }

  function makeFakePrismaWithTreasury(overrides: Partial<{
    investmentFindUnique: ReturnType<typeof vi.fn>;
    investmentCreate: ReturnType<typeof vi.fn>;
    productFindUnique: ReturnType<typeof vi.fn>;
  }> = {}) {
    return {
      investment: {
        findUnique: overrides.investmentFindUnique ?? vi.fn().mockResolvedValue(null),
        create: overrides.investmentCreate ?? vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
      treasuryProduct: {
        findUnique: overrides.productFindUnique ?? vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaClient;
  }

  it('creates a treasury investment using the product slug as ticker', async () => {
    const product = makeTreasuryProductRow();
    const created = {
      ...makeRow({ ticker: 'TESOURO-IPCA-2026', type: 'TREASURY' }),
      sector: 'Renda Fixa',
      treasuryProductId: 'prod-uuid-1',
      treasuryProduct: { name: 'Tesouro IPCA+ 2026' },
    };
    const db = makeFakePrismaWithTreasury({
      productFindUnique: vi.fn().mockResolvedValue(product),
      investmentFindUnique: vi.fn().mockResolvedValue(null),
      investmentCreate: vi.fn().mockResolvedValue(created),
    });
    const svc = createInvestmentService(db);

    const result = await svc.createTreasuryInvestment({ treasuryProductId: 'prod-uuid-1' });

    expect(result.ticker).toBe('TESOURO-IPCA-2026');
    expect(result.type).toBe('TREASURY');
    expect(result.treasuryProductName).toBe('Tesouro IPCA+ 2026');
    expect(result.sector).toBe('Renda Fixa');
  });

  it('throws 404 when the treasury product does not exist', async () => {
    const db = makeFakePrismaWithTreasury({
      productFindUnique: vi.fn().mockResolvedValue(null),
    });
    const svc = createInvestmentService(db);

    await expect(
      svc.createTreasuryInvestment({ treasuryProductId: 'nonexistent' }),
    ).rejects.toThrow('Treasury product with id "nonexistent" not found');
  });

  it('throws 409 when the treasury product is already registered', async () => {
    const product = makeTreasuryProductRow();
    const existing = makeRow({ ticker: 'TESOURO-IPCA-2026', type: 'TREASURY' });
    const db = makeFakePrismaWithTreasury({
      productFindUnique: vi.fn().mockResolvedValue(product),
      investmentFindUnique: vi.fn().mockResolvedValue(existing),
    });
    const svc = createInvestmentService(db);

    await expect(
      svc.createTreasuryInvestment({ treasuryProductId: 'prod-uuid-1' }),
    ).rejects.toThrow('"Tesouro IPCA+ 2026" is already registered');
  });
});

// ─── updateCurrentValue ───────────────────────────────────────────────────────

describe('updateCurrentValue', () => {
  beforeEach(() => vi.clearAllMocks());

  function decimalStub(value: number) {
    return { toString: () => String(value) };
  }

  it('sets currentValue and returns the updated record', async () => {
    const existing = makeRow({ ticker: 'TESOURO-IPCA-2026', type: 'TREASURY' });
    const updated = { ...existing, currentValue: decimalStub(30882.59) };
    const db = makeFakePrisma({
      findUnique: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue(updated),
    });
    const svc = createInvestmentService(db);

    const result = await svc.updateCurrentValue('uuid-1', { currentValue: 30882.59 });

    expect(result.currentValue).toBe('30882.59');
    expect(db.investment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'uuid-1' }, data: { currentValue: 30882.59 } }),
    );
  });

  it('clears currentValue when null is passed', async () => {
    const existing = makeRow({ ticker: 'TESOURO-IPCA-2026', type: 'TREASURY' });
    const updated = { ...existing, currentValue: null };
    const db = makeFakePrisma({
      findUnique: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue(updated),
    });
    const svc = createInvestmentService(db);

    const result = await svc.updateCurrentValue('uuid-1', { currentValue: null });

    expect(result.currentValue).toBeNull();
  });

  it('throws a not-found error when the investment does not exist', async () => {
    const db = makeFakePrisma({ findUnique: vi.fn().mockResolvedValue(null) });
    const svc = createInvestmentService(db);

    await expect(
      svc.updateCurrentValue('nonexistent', { currentValue: 100 }),
    ).rejects.toThrow('Investment with id "nonexistent" not found');
  });
});
