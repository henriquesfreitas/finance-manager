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

/** Builds a minimal Prisma v2 investment row (no orders). */
function makeRow(partial: Partial<{
  id: string;
  ticker: string;
  archivedAt: Date | null;
}> = {}) {
  return {
    id: partial.id ?? 'uuid-1',
    ticker: partial.ticker ?? 'ITUB3',
    archivedAt: partial.archivedAt ?? null,
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

    const result = await svc.createInvestment({ ticker: 'ITUB3' });

    expect(result.ticker).toBe('ITUB3');
    expect(result.archivedAt).toBeNull();
    expect(db.investment.create).toHaveBeenCalledWith({ data: { ticker: 'ITUB3' } });
  });

  it('throws with a 409-friendly message when ticker is already registered', async () => {
    const existing = makeRow({ ticker: 'ITUB3' });
    const db = makeFakePrisma({
      findUnique: vi.fn().mockResolvedValue(existing),
    });
    const svc = createInvestmentService(db);

    await expect(svc.createInvestment({ ticker: 'ITUB3' })).rejects.toThrow(
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
