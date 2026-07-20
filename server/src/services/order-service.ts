import type { PrismaClient } from '@prisma/client';
import type { CreateOrderInput, UpdateOrderInput, OrderRecord, OrderType, OrderWithTicker, ComputedPosition } from '../types/order.js';
import { validateCreateOrderInput, validateUpdateOrderInput } from '../validators/order-validator.js';
import { createWeightedAverageCalculator } from './weighted-average-calculator.js';
import type { OrderEntry } from './weighted-average-calculator.js';

/**
 * Converts a Prisma Order record to the plain OrderRecord shape.
 * Decimal fields are serialised to strings; dates to ISO strings.
 */
function toOrderRecord(record: {
  id: string;
  investmentId: string;
  type: 'BUY' | 'SELL';
  quantity: { toString(): string };
  price: { toString(): string };
  contractedRate?: { toString(): string } | null;
  orderDate: Date;
  createdAt: Date;
  updatedAt: Date;
}): OrderRecord {
  return {
    id: record.id,
    investmentId: record.investmentId,
    type: record.type,
    quantity: record.quantity.toString(),
    price: record.price.toString(),
    contractedRate: record.contractedRate ? record.contractedRate.toString() : null,
    // orderDate is stored as date-only; slice to YYYY-MM-DD
    orderDate: record.orderDate.toISOString().slice(0, 10),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Order service — all order-related database access goes through here.
 * Dependencies are injected so tests can supply fakes.
 *
 * @example
 *   const svc = createOrderService(prisma);
 *   const position = await svc.createOrder(investmentId, input);
 */
export function createOrderService(db: PrismaClient) {
  const calculator = createWeightedAverageCalculator();

  return {
    /**
     * Validates input, verifies the investment exists and is active (not archived),
     * checks SELL does not exceed current position, persists the order, and returns
     * the updated computed position (including the new order).
     *
     * Throws with a descriptive message on any business rule violation.
     */
    async createOrder(
      investmentId: string,
      input: CreateOrderInput,
    ): Promise<ComputedPosition> {
      // 1. Re-validate the input (routes call this too, but service is the authority)
      const validation = validateCreateOrderInput(input);
      if (!validation.success) {
        const first = Object.values(validation.errors)[0]?.[0] ?? 'Invalid input';
        throw new Error(first);
      }

      // 2. Verify investment exists and is not archived
      const investment = await db.investment.findUnique({ where: { id: investmentId } });
      if (!investment) {
        throw new Error(`Investment with id "${investmentId}" not found`);
      }
      if (investment.archivedAt !== null) {
        throw new Error(`Investment "${investment.ticker}" is already archived`);
      }

      // 3. For SELL orders: fetch existing orders and validate against current position
      if (input.type === 'SELL') {
        const existingOrders = await db.order.findMany({
          where: { investmentId },
          orderBy: [{ orderDate: 'asc' }, { createdAt: 'asc' }],
        });

        const entries: OrderEntry[] = existingOrders.map((o) => ({
          type: o.type as OrderType,
          quantity: o.quantity.toNumber(),
          price: o.price.toNumber(),
        }));

        const currentPosition = calculator.computePosition(entries);

        if (input.quantity > currentPosition.quantity) {
          throw new Error(
            `Sell quantity (${input.quantity}) exceeds available position (${currentPosition.quantity})`,
          );
        }
      }

      // 4. Persist the new order
      await db.order.create({
        data: {
          investmentId,
          type: input.type,
          quantity: input.quantity,
          price: input.price,
          contractedRate: input.contractedRate ?? null,
          // Prisma expects a DateTime for @db.Date fields; noon UTC avoids TZ drift
          orderDate: new Date(`${input.orderDate}T12:00:00.000Z`),
        },
      });

      // 5. Re-fetch all orders (including the new one) sorted chronologically for position
      const allOrders = await db.order.findMany({
        where: { investmentId },
        orderBy: [{ orderDate: 'asc' }, { createdAt: 'asc' }],
      });

      const allEntries: OrderEntry[] = allOrders.map((o) => ({
        type: o.type as OrderType,
        quantity: o.quantity.toNumber(),
        price: o.price.toNumber(),
      }));

      const updatedPosition = calculator.computePosition(allEntries);

      return {
        quantity: updatedPosition.quantity.toString(),
        averagePrice: updatedPosition.averagePrice.toString(),
      };
    },

    /**
     * Fetches all orders for an investment, sorted by orderDate DESC then createdAt DESC.
     * Returns an empty array when the investment has no orders.
     */
    async listOrders(investmentId: string): Promise<OrderRecord[]> {
      const orders = await db.order.findMany({
        where: { investmentId },
        orderBy: [{ orderDate: 'desc' }, { createdAt: 'desc' }],
      });

      return orders.map(toOrderRecord);
    },

    /**
     * Fetches all orders across all investments, enriched with the display name.
     * For STOCK investments this is the ticker (e.g. "ITUB3").
     * For TREASURY investments this is the product short name (e.g. "IPCA+ 2026").
     * Sorted by orderDate DESC then createdAt DESC (latest first).
     */
    async listAllOrders(): Promise<OrderWithTicker[]> {
      const orders = await db.order.findMany({
        include: {
          investment: {
            select: {
              ticker: true,
              treasuryProduct: { select: { name: true } },
            },
          },
        },
        orderBy: [{ orderDate: 'desc' }, { createdAt: 'desc' }],
      });

      return orders.map((o) => ({
        ...toOrderRecord(o),
        // Treasury investments show the product short name; stocks show the ticker
        ticker: o.investment.treasuryProduct?.name ?? o.investment.ticker,
      }));
    },

    /**
     * Updates an existing order's fields (type, quantity, price, and/or orderDate).
     * After the update it re-validates that no SELL order exceeds the position at
     * the time it was placed (chronological order integrity).
     *
     * Throws with a descriptive message when:
     * - the order is not found
     * - the owning investment is archived
     * - the edit would leave the position in an invalid state (e.g. selling more than held)
     *
     * @example
     *   await svc.updateOrder(investmentId, orderId, { price: 30.00 });
     */
    async updateOrder(
      investmentId: string,
      orderId: string,
      input: UpdateOrderInput,
    ): Promise<ComputedPosition> {
      // 1. Validate input
      const validation = validateUpdateOrderInput(input);
      if (!validation.success) {
        const first = Object.values(validation.errors)[0]?.[0] ?? 'Invalid input';
        throw new Error(first);
      }

      // 2. Verify order exists and belongs to this investment
      const order = await db.order.findUnique({ where: { id: orderId } });
      if (!order || order.investmentId !== investmentId) {
        throw new Error(`Order with id "${orderId}" not found for this investment`);
      }

      // 3. Verify investment is not archived
      const investment = await db.investment.findUnique({ where: { id: investmentId } });
      if (!investment) {
        throw new Error(`Investment with id "${investmentId}" not found`);
      }
      if (investment.archivedAt !== null) {
        throw new Error(`Investment "${investment.ticker}" is already archived`);
      }

      // 4. Persist the update
      await db.order.update({
        where: { id: orderId },
        data: {
          ...(validation.data.type !== undefined && { type: validation.data.type }),
          ...(validation.data.quantity !== undefined && { quantity: validation.data.quantity }),
          ...(validation.data.price !== undefined && { price: validation.data.price }),
          ...(validation.data.contractedRate !== undefined && { contractedRate: validation.data.contractedRate }),
          ...(validation.data.orderDate !== undefined && {
            orderDate: new Date(`${validation.data.orderDate}T12:00:00.000Z`),
          }),
        },
      });

      // 5. Re-fetch all orders chronologically and validate SELL integrity
      const allOrders = await db.order.findMany({
        where: { investmentId },
        orderBy: [{ orderDate: 'asc' }, { createdAt: 'asc' }],
      });

      const allEntries: OrderEntry[] = allOrders.map((o) => ({
        type: o.type as OrderType,
        quantity: o.quantity.toNumber(),
        price: o.price.toNumber(),
      }));

      // Validate that the updated order history never produces a negative position
      let runningQuantity = 0;
      for (const entry of allEntries) {
        if (entry.type === 'BUY' || entry.type === 'BONUS') {
          runningQuantity += entry.quantity;
        } else if (entry.type === 'SPLIT') {
          runningQuantity *= entry.quantity;
        } else {
          runningQuantity -= entry.quantity;
          if (runningQuantity < 0) {
            // Roll back the update by reverting to the original values
            await db.order.update({
              where: { id: orderId },
              data: {
                type: order.type,
                quantity: order.quantity,
                price: order.price,
                orderDate: order.orderDate,
              },
            });
            throw new Error(
              `This edit would result in a negative position. A SELL order exceeds the available quantity at that point in time.`,
            );
          }
        }
      }

      const updatedPosition = calculator.computePosition(allEntries);
      return {
        quantity: updatedPosition.quantity.toString(),
        averagePrice: updatedPosition.averagePrice.toString(),
      };
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
