import type { PrismaClient } from '@prisma/client';
import { fetchQuotes } from './yahoo-finance-quote-service.js';
import { createWeightedAverageCalculator } from './weighted-average-calculator.js';
import type {
  CreateInvestmentInput,
  CreateTreasuryInvestmentInput,
  UpdateTargetPricesInput,
  UpdateCurrentValueInput,
  InvestmentRecord,
} from '../types/investment.js';
import type { EnrichedInvestment, ArchivedInvestment, ComputedPosition } from '../types/order.js';

const calculator = createWeightedAverageCalculator();

/** Minimal row shape accepted by toRecord. */
type InvestmentRow = {
  id: string;
  ticker: string;
  type: 'STOCK' | 'TREASURY';
  sector: string | null;
  archivedAt: Date | null;
  targetSellPrice?: { toString(): string } | null;
  targetBuyPrice?: { toString(): string } | null;
  currentValue?: { toString(): string } | null;
  treasuryProductId: string | null;
  treasuryProduct?: { name: string } | null;
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

/** Shared query options: include orders in chronological order + treasury product name. */
const includeOrdersAndProduct = {
  orders: {
    orderBy: [
      { orderDate: 'asc' as const },
      { createdAt: 'asc' as const },
    ],
  },
  treasuryProduct: { select: { name: true } },
};

/** Converts a Prisma investment row to the plain InvestmentRecord shape. */
function toRecord(row: InvestmentRow): InvestmentRecord {
  return {
    id: row.id,
    ticker: row.ticker,
    type: row.type,
    sector: row.sector,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    targetSellPrice: row.targetSellPrice ? row.targetSellPrice.toString() : null,
    targetBuyPrice: row.targetBuyPrice ? row.targetBuyPrice.toString() : null,
    currentValue: row.currentValue ? row.currentValue.toString() : null,
    treasuryProductId: row.treasuryProductId,
    treasuryProductName: row.treasuryProduct?.name ?? null,
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
 * Investment service (v3) — supports both STOCK and TREASURY asset types.
 * STOCK investments use Yahoo Finance for live quotes.
 * TREASURY investments use a manually-entered currentValue instead.
 *
 * @example
 *   const svc = createInvestmentService(prisma);
 *   const investments = await svc.listActiveInvestments();
 */
export function createInvestmentService(db: PrismaClient) {
  return {
    /**
     * Creates a new STOCK investment with ticker and sector.
     * Throws with a 409-friendly message when the ticker already exists.
     */
    async createInvestment(data: CreateInvestmentInput): Promise<InvestmentRecord> {
      const existing = await db.investment.findUnique({ where: { ticker: data.ticker } });
      if (existing) {
        throw new Error(`Ticker "${data.ticker}" is already registered`);
      }
      const record = await db.investment.create({
        data: { ticker: data.ticker, sector: data.sector, type: 'STOCK' },
        include: { treasuryProduct: { select: { name: true } } },
      });
      return toRecord(record);
    },

    /**
     * Creates a new TREASURY investment from a treasury product catalog entry.
     * Uses the product's slug as the ticker (unique, URL-safe).
     * Sector is set to "Renda Fixa" automatically.
     * Throws 404 when product not found, 409 when already registered.
     */
    async createTreasuryInvestment(data: CreateTreasuryInvestmentInput): Promise<InvestmentRecord> {
      const product = await db.treasuryProduct.findUnique({
        where: { id: data.treasuryProductId },
      });
      if (!product) {
        throw new Error(`Treasury product with id "${data.treasuryProductId}" not found`);
      }
      const existing = await db.investment.findUnique({ where: { ticker: product.slug } });
      if (existing) {
        throw new Error(`"${product.name}" is already registered`);
      }
      const record = await db.investment.create({
        data: {
          ticker: product.slug,
          sector: 'Renda Fixa',
          type: 'TREASURY',
          treasuryProductId: product.id,
        },
        include: { treasuryProduct: { select: { name: true } } },
      });
      return toRecord(record);
    },

    /**
     * Returns all active (non-archived) investments enriched with computed
     * positions. STOCK investments get live Yahoo Finance quotes;
     * TREASURY investments get null quotes (they use currentValue instead).
     */
    async listActiveInvestments(): Promise<EnrichedInvestment[]> {
      const rows = await db.investment.findMany({
        where: { archivedAt: null },
        include: includeOrdersAndProduct,
        orderBy: { createdAt: 'asc' },
      });
      if (rows.length === 0) return [];

      // Only fetch quotes for STOCK investments — Treasury has no Yahoo ticker.
      const stockTickers = rows
        .filter((r) => r.type === 'STOCK')
        .map((r) => r.ticker);

      const quoteMap = stockTickers.length > 0
        ? await fetchQuotes(stockTickers)
        : new Map();

      return rows.map((row) => ({
        ...toRecord(row),
        position: computeSerializedPosition(row.orders),
        quote: row.type === 'STOCK' ? (quoteMap.get(row.ticker) ?? null) : null,
      }));
    },

    /**
     * Returns all archived investments with their final computed position.
     * No live quote is fetched for any type — archived investments are read-only.
     */
    async listArchivedInvestments(): Promise<ArchivedInvestment[]> {
      const rows = await db.investment.findMany({
        where: { archivedAt: { not: null } },
        include: includeOrdersAndProduct,
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
        include: { treasuryProduct: { select: { name: true } } },
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
        include: { treasuryProduct: { select: { name: true } } },
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
        include: { treasuryProduct: { select: { name: true } } },
      });
      return toRecord(record);
    },

    /**
     * Updates the manually-entered current value of a non-STOCK investment.
     * Pass null to clear the value (UI will show N/A).
     * Throws 404 when the investment does not exist.
     *
     * @example
     *   await svc.updateCurrentValue('uuid', { currentValue: 30882.59 });
     *   await svc.updateCurrentValue('uuid', { currentValue: null }); // clears it
     */
    async updateCurrentValue(id: string, data: UpdateCurrentValueInput): Promise<InvestmentRecord> {
      const existing = await db.investment.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Investment with id "${id}" not found`);
      }
      const record = await db.investment.update({
        where: { id },
        data: { currentValue: data.currentValue },
        include: { treasuryProduct: { select: { name: true } } },
      });
      return toRecord(record);
    },
  };
}

export type InvestmentService = ReturnType<typeof createInvestmentService>;
