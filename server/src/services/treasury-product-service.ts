import type { PrismaClient } from '@prisma/client';
import type { TreasuryProductRecord } from '../types/investment.js';

/** Converts a Prisma TreasuryProduct row to the plain serialisable record. */
function toRecord(row: { id: string; name: string; slug: string; createdAt: Date }): TreasuryProductRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Service for the treasury product catalog.
 * Products are stored in the DB so new ones can be added without a code deploy.
 *
 * @example
 *   const svc = createTreasuryProductService(prisma);
 *   const products = await svc.listProducts();
 */
export function createTreasuryProductService(db: PrismaClient) {
  return {
    /** Returns all treasury products ordered alphabetically by name. */
    async listProducts(): Promise<TreasuryProductRecord[]> {
      const rows = await db.treasuryProduct.findMany({
        orderBy: { name: 'asc' },
      });
      return rows.map(toRecord);
    },

    /**
     * Finds a single product by id. Returns null when not found.
     * Used by the investment service to resolve the slug for a new treasury investment.
     */
    async findById(id: string): Promise<TreasuryProductRecord | null> {
      const row = await db.treasuryProduct.findUnique({ where: { id } });
      return row ? toRecord(row) : null;
    },
  };
}

export type TreasuryProductService = ReturnType<typeof createTreasuryProductService>;
