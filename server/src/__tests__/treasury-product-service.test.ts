import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTreasuryProductService } from '../services/treasury-product-service.js';
import type { PrismaClient } from '@prisma/client';

/** Builds a minimal fake Prisma client scoped to treasuryProduct. */
function makeFakePrisma(overrides: Partial<{
  findMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    treasuryProduct: {
      findMany: overrides.findMany ?? vi.fn().mockResolvedValue([]),
      findUnique: overrides.findUnique ?? vi.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaClient;
}

function makeProductRow(partial: Partial<{
  id: string;
  name: string;
  slug: string;
}> = {}) {
  return {
    id: partial.id ?? 'prod-uuid-1',
    name: partial.name ?? 'Tesouro IPCA+ 2026',
    slug: partial.slug ?? 'TESOURO-IPCA-2026',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
}

describe('listProducts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an empty array when no products exist', async () => {
    const db = makeFakePrisma({ findMany: vi.fn().mockResolvedValue([]) });
    const svc = createTreasuryProductService(db);

    const result = await svc.listProducts();

    expect(result).toEqual([]);
  });

  it('returns serialised product records ordered alphabetically', async () => {
    const rows = [
      makeProductRow({ name: 'Tesouro IPCA+ 2026', slug: 'TESOURO-IPCA-2026' }),
      makeProductRow({ id: 'prod-uuid-2', name: 'Tesouro Prefixado 2029', slug: 'TESOURO-PREFIXADO-2029' }),
    ];
    const db = makeFakePrisma({ findMany: vi.fn().mockResolvedValue(rows) });
    const svc = createTreasuryProductService(db);

    const result = await svc.listProducts();

    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe('Tesouro IPCA+ 2026');
    expect(result[0]?.slug).toBe('TESOURO-IPCA-2026');
    expect(result[1]?.name).toBe('Tesouro Prefixado 2029');
  });

  it('queries with orderBy name asc', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = makeFakePrisma({ findMany });
    const svc = createTreasuryProductService(db);

    await svc.listProducts();

    expect(findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
  });

  it('serialises createdAt to ISO string', async () => {
    const row = makeProductRow();
    const db = makeFakePrisma({ findMany: vi.fn().mockResolvedValue([row]) });
    const svc = createTreasuryProductService(db);

    const result = await svc.listProducts();

    expect(result[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('findById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the product record when found', async () => {
    const row = makeProductRow({ id: 'prod-uuid-1', name: 'Tesouro IPCA+ 2026', slug: 'TESOURO-IPCA-2026' });
    const db = makeFakePrisma({ findUnique: vi.fn().mockResolvedValue(row) });
    const svc = createTreasuryProductService(db);

    const result = await svc.findById('prod-uuid-1');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('prod-uuid-1');
    expect(result?.slug).toBe('TESOURO-IPCA-2026');
  });

  it('returns null when the product does not exist', async () => {
    const db = makeFakePrisma({ findUnique: vi.fn().mockResolvedValue(null) });
    const svc = createTreasuryProductService(db);

    const result = await svc.findById('nonexistent');

    expect(result).toBeNull();
  });

  it('queries by id', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const db = makeFakePrisma({ findUnique });
    const svc = createTreasuryProductService(db);

    await svc.findById('prod-uuid-1');

    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'prod-uuid-1' } });
  });
});
