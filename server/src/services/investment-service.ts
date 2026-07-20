import type { PrismaClient } from '@prisma/client';
import { fetchQuotes } from './yahoo-finance-quote-service.js';
import { createWeightedAverageCalculator } from './weighted-average-calculator.js';
import type { CreateInvestmentInput, UpdateTargetPricesInput, InvestmentRecord } from '../types/investment.js';
import type { EnrichedInvestment, ArchivedInvestment, ComputedPosition } from '../types/order.js';

const calculator = createWeightedAverageCalculator();

/** Minimal row shape accepted by toRecord — covers both direct queries and joined queries.
 *  targetSellPrice/targetBuyPrice are optional because the Prisma-generated type
 *  won't include them until the migration runs and the client is regenerated.
 */
type InvestmentRow = {
  id: string;
  ticker: string;
  sector: string | null;
  archivedAt: Date | null;
  targetSellPrice?: { toString(): string } | null;
  targetBuyPrice?: { toString(): string } | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Shape returned by Prisma when fetching an investment with its orders. */
type InvestmentWithOrders = InvestmentRow & {
  orders: Array<{
    type: 'BUY' | 'SELL' | 'BONUS' | 'SPLIT';
    quantity: { toNumber(): number };
    price: { toNumber(): number };
  }>;
};

/** Shared query options: include orders in chronological order. */
const includeOrdersChronological = {
  orders: {
    orderBy: [
      { orderDate: 'asc' as const },
      { createdAt: 'asc' as const },
    ],
  },
};

/** Converts a Prisma investment row to the plain InvestmentRecord shape. */
function toRecord(row: InvestmentRow): InvestmentRecord {
  return {
    id: row.id,
    ticker: row.ticker,
    sector: row.sector,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    targetSellPrice: row.targetSellPrice ? row.targetSellPrice.toString() : null,
    targetBuyPrice: row.targetBuyPrice ? row.targetBuyPrice.toString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Computes the position from order rows and serialises to Decimal strings. */
function computeSerializedPosition(orders: InvestmentWithOrders['orders']): ComputedPosition {
  const entries = orders.map((o) => ({
    type: o.type,
    quantity: o.quantity.toNumber(),
    price: o.price.toNumber(),
  }));
  const state = calculator.computePosition(entries);
  return {
    quantity: state.quantity.toFixed(8),
    averagePrice: state.averagePrice.toFixed(8),
  };
}

/**
 * Investment service (v2) — all investment database access goes through here.
 * Quantity and average price are never stored; they are computed at query time
 * from the associated orders via `computePosition`.
 *
 * @example
 *   const svc = createInvestmentService(prisma);
 *   const investments = await svc.listActiveInvestments();
 */
export function createInvestmentService(db: PrismaClient) {
  return {
    /**
     * Creates a new investment with ticker and sector.
     * Throws with a 409-friendly message when the ticker already exists.
     */
    async createInvestment(data: CreateInvestmentInput): Promise<InvestmentRecord> {
      const existing = await db.investment.findUnique({ where: { ticker: data.ticker } });
      if (existing) {
        throw new Error(`Ticker "${data.ticker}" is already registered`);
      }
      const record = await db.investment.create({
        data: { ticker: data.ticker, sector: data.sector },
      });
      return toRecord(record);
    },

    /**
     * Returns all active (non-archived) investments enriched with computed
     * positions and live Yahoo Finance quotes.
     */
    async listActiveInvestments(): Promise<EnrichedInvestment[]> {
      const rows = await db.investment.findMany({
        where: { archivedAt: null },
        include: includeOrdersChronological,
        orderBy: { createdAt: 'asc' },
      });
      if (rows.length === 0) return [];

      const tickers = rows.map((r) => r.ticker);
      const quoteMap = await fetchQuotes(tickers);

      return rows.map((row) => ({
        ...toRecord(row),
        position: computeSerializedPosition(row.orders),
        quote: quoteMap.get(row.ticker) ?? null,
      }));
    },

    /**
     * Returns all archived investments with their final computed position.
     * No live quote is fetched — archived investments are read-only history.
     */
    async listArchivedInvestments(): Promise<ArchivedInvestment[]> {
      const rows = await db.investment.findMany({
        where: { archivedAt: { not: null } },
        include: includeOrdersChronological,
        orderBy: { archivedAt: 'desc' },
      });

      return rows.map((row) => ({
        ...toRecord(row),
        position: computeSerializedPosition(row.orders),
      }));
    },

    /**
     * Soft-deletes an investment by setting archivedAt to the current timestamp.
     * Throws 404 when the investment does not exist, 409 when already archived.
     */
    async archiveInvestment(id: string): Promise<InvestmentRecord> {
      const existing = await db.investment.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Investment with id "${id}" not found`);
      }
      if (existing.archivedAt !== null) {
        throw new Error(`Investment "${existing.ticker}" is already archived`);
      }
      const record = await db.investment.update({
        where: { id },
        data: { archivedAt: new Date() },
      });
      return toRecord(record);
    },

    /**
     * Updates the sector of an existing investment.
     * Throws 404 when the investment does not exist.
     */
    async updateSector(id: string, sector: string): Promise<InvestmentRecord> {
      const existing = await db.investment.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Investment with id "${id}" not found`);
      }
      const record = await db.investment.update({
        where: { id },
        data: { sector },
      });
      return toRecord(record);
    },

    /**
     * Updates the target sell and/or buy prices of an existing investment.
     * Pass null for a field to explicitly clear it.
     * Throws 404 when the investment does not exist.
     *
     * @example
     *   await svc.updateTargetPrices('uuid', { targetSellPrice: 35.5, targetBuyPrice: null });
     */
    async updateTargetPrices(id: string, data: UpdateTargetPricesInput): Promise<InvestmentRecord> {
      const existing = await db.investment.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Investment with id "${id}" not found`);
      }
      const record = await db.investment.update({
        where: { id },
        data: {
          ...(data.targetSellPrice !== undefined && { targetSellPrice: data.targetSellPrice }),
          ...(data.targetBuyPrice !== undefined && { targetBuyPrice: data.targetBuyPrice }),
        },
      });
      return toRecord(record);
    },
  };
}

export type InvestmentService = ReturnType<typeof createInvestmentService>;
