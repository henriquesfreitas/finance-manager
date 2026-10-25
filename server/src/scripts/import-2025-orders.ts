/**
 * Preview or import the requested stock orders and normalize BUY dates.
 *
 * Preview (default): npm run orders:import-2025 --prefix server
 * Apply:            npm run orders:import-2025 --prefix server -- --apply
 *
 * The script requires the investments to exist, refuses duplicate imports, and
 * updates the existing SANB11 BUY before adding its SELL.
 */
import { Prisma } from '../generated/prisma/client.js';
import { createPrismaClient } from '../lib/create-prisma-client.js';

const prisma = createPrismaClient();
const apply = process.argv.includes('--apply');

const orders = [
  { ticker: 'XPIN11', type: 'BUY', quantity: 150, price: 77.4, orderDate: '2025-07-19' },
  { ticker: 'RECR11', type: 'BUY', quantity: 80, price: 85.02, orderDate: '2025-07-19' },
  { ticker: 'UGPA3', type: 'BUY', quantity: 200, price: 18.2, orderDate: '2025-07-19' },
  { ticker: 'ABEV3', type: 'BUY', quantity: 600, price: 13.27, orderDate: '2025-07-19' },
  { ticker: 'XPIN11', type: 'SELL', quantity: 150, price: 76.81, orderDate: '2025-11-21' },
  { ticker: 'RECR11', type: 'SELL', quantity: 80, price: 81.19, orderDate: '2026-02-10' },
  { ticker: 'UGPA3', type: 'SELL', quantity: 200, price: 26.76, orderDate: '2026-02-12' },
  { ticker: 'SANB11', type: 'SELL', quantity: 100, price: 35.68, orderDate: '2026-02-12' },
  { ticker: 'ABEV3', type: 'SELL', quantity: 600, price: 13.69, orderDate: '2025-12-08' },
] as const;

const sourceBuyDates = ['2025-07-19', '2026-07-19'] as const;
const normalizedBuyDate = '2025-01-01';
const sanb11BuyToEdit = { ticker: 'SANB11', price: 29.73, quantity: 400 };

type Position = { quantity: number; averagePrice: number };
type PlannedOrder = {
  ticker: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderDate: string;
};

function round8(value: number): number {
  return Math.round(value * 100_000_000) / 100_000_000;
}

function positionAfter(
  position: Position,
  order: { type: string; quantity: number; price: number },
): Position {
  if (order.type === 'BUY' || order.type === 'BONUS') {
    const quantity = position.quantity + order.quantity;
    const averagePrice = round8(
      (position.quantity * position.averagePrice + order.quantity * order.price) / quantity,
    );
    return { quantity, averagePrice };
  }
  if (order.type === 'SELL') {
    if (order.quantity > position.quantity) {
      throw new Error(`SELL of ${order.quantity} exceeds available quantity ${position.quantity}`);
    }
    const quantity = position.quantity - order.quantity;
    return { quantity, averagePrice: quantity === 0 ? 0 : position.averagePrice };
  }
  if (order.type === 'SPLIT') {
    if (position.quantity === 0) return position;
    return {
      quantity: round8(position.quantity * order.quantity),
      averagePrice: round8(position.averagePrice / order.quantity),
    };
  }
  throw new Error(`Unsupported existing order type: ${order.type}`);
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dateAtNoonUtc(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

async function main(): Promise<void> {
  const importTickers = [...new Set([...orders.map((order) => order.ticker), sanb11BuyToEdit.ticker])];
  const importInvestments = await prisma.investment.findMany({
    where: { ticker: { in: importTickers } },
    select: { id: true, ticker: true },
  });
  const importInvestmentsByTicker = new Map(importInvestments.map((investment) => [investment.ticker, investment]));
  const missingTickers = importTickers.filter((ticker) => !importInvestmentsByTicker.has(ticker));
  if (missingTickers.length > 0) {
    throw new Error(`Create these investments before importing orders: ${missingTickers.join(', ')}`);
  }

  const sourceDates = sourceBuyDates.map(dateAtNoonUtc);
  const existingBuyOrdersToMove = await prisma.order.findMany({
    where: { type: 'BUY', orderDate: { in: sourceDates } },
    include: { investment: { select: { id: true, ticker: true, archivedAt: true } } },
  });

  const allInvestments = await prisma.investment.findMany({
    where: { ticker: { in: importTickers } },
    include: { orders: { orderBy: [{ orderDate: 'asc' }, { createdAt: 'asc' }] } },
  });
  const importInvestmentsWithOrders = new Map(allInvestments.map((investment) => [investment.ticker, investment]));
  const sanb11Investment = importInvestmentsWithOrders.get(sanb11BuyToEdit.ticker);
  if (!sanb11Investment) {
    throw new Error(`Investment ${sanb11BuyToEdit.ticker} was not found.`);
  }
  const sanb11BuysToEdit = sanb11Investment.orders.filter(
    (order) =>
      order.type === 'BUY' && order.price.equals(new Prisma.Decimal(sanb11BuyToEdit.price)),
  );
  if (sanb11BuysToEdit.length !== 1) {
    const availableBuys = sanb11Investment.orders
      .filter((order) => order.type === 'BUY')
      .map((order) => `${dateOnly(order.orderDate)} qty ${order.quantity.toString()} @ ${order.price.toString()}`);
    throw new Error(
      `Expected exactly one SANB11 BUY at R$ ${sanb11BuyToEdit.price}; found ${sanb11BuysToEdit.length}. ` +
        `Existing BUY orders: ${availableBuys.join('; ') || 'none'}`,
    );
  }
  const sanb11BuyToUpdate = sanb11BuysToEdit[0]!;

  const affectedInvestmentIds = [...new Set([
    ...allInvestments.map((investment) => investment.id),
    ...existingBuyOrdersToMove.map((order) => order.investmentId),
  ])];
  const affectedInvestments = await prisma.investment.findMany({
    where: { id: { in: affectedInvestmentIds } },
    include: { orders: { orderBy: [{ orderDate: 'asc' }, { createdAt: 'asc' }] } },
  });

  const archivedChanges = existingBuyOrdersToMove
    .filter((order) => order.investment.archivedAt !== null)
    .map((order) => order.investment.ticker);
  const archivedImports = affectedInvestments
    .filter((investment) => importTickers.includes(investment.ticker) && investment.archivedAt !== null)
    .map((investment) => investment.ticker);
  const archivedTickers = [...new Set([...archivedChanges, ...archivedImports])];
  if (archivedTickers.length > 0) {
    throw new Error(`Cannot change orders for archived investments: ${archivedTickers.join(', ')}`);
  }

  const correctedBuyIds = new Set(existingBuyOrdersToMove.map((order) => order.id));
  correctedBuyIds.add(sanb11BuyToUpdate.id);

  const plannedOrders: PlannedOrder[] = orders.map((order) => ({
    ticker: order.ticker,
    type: order.type,
    quantity: order.quantity,
    price: order.price,
    orderDate: order.type === 'BUY' ? normalizedBuyDate : order.orderDate,
  }));
  const ordersAlreadyPresent: PlannedOrder[] = [];
  const ordersToCreate = plannedOrders.filter((plannedOrder) => {
    const investment = affectedInvestments.find((row) => row.ticker === plannedOrder.ticker);
    if (!investment) throw new Error(`Investment ${plannedOrder.ticker} was not found.`);

    const matches = investment.orders.filter((existingOrder) => {
      const existingDate =
        existingOrder.type === 'BUY' && correctedBuyIds.has(existingOrder.id)
          ? normalizedBuyDate
          : dateOnly(existingOrder.orderDate);
      const existingQuantity =
        existingOrder.id === sanb11BuyToUpdate.id
          ? sanb11BuyToEdit.quantity
          : existingOrder.quantity.toNumber();
      return (
        existingDate === plannedOrder.orderDate &&
        existingOrder.type === plannedOrder.type &&
        existingQuantity === plannedOrder.quantity &&
        existingOrder.price.equals(new Prisma.Decimal(plannedOrder.price))
      );
    });
    if (matches.length > 1) {
      throw new Error(
        `${plannedOrder.ticker} has multiple matching ${plannedOrder.type} orders on ${plannedOrder.orderDate}.`,
      );
    }
    if (matches.length === 1) {
      ordersAlreadyPresent.push(plannedOrder);
      return false;
    }
    return true;
  });

  const rows = affectedInvestments.map((investment) => {
    const tickerOrders = ordersToCreate.filter((order) => order.ticker === investment.ticker);

    const timeline = [
      ...investment.orders.map((order) => ({
        ticker: investment.ticker,
        id: order.id,
        type: order.type,
        quantity:
          order.id === sanb11BuyToUpdate.id ? sanb11BuyToEdit.quantity : order.quantity.toNumber(),
        price: order.price.toNumber(),
        orderDate:
          correctedBuyIds.has(order.id) && order.type === 'BUY'
            ? normalizedBuyDate
            : dateOnly(order.orderDate),
        createdAt: order.createdAt.getTime(),
        planned: false,
      })),
      ...tickerOrders.map((order, index) => ({
        ...order,
        id: `planned-${investment.ticker}-${index}`,
        createdAt: Number.MAX_SAFE_INTEGER - tickerOrders.length + index,
        planned: true,
      })),
    ].sort((a, b) => a.orderDate.localeCompare(b.orderDate) || a.createdAt - b.createdAt);

    let position: Position = { quantity: 0, averagePrice: 0 };
    const sellAveragePrices = new Map<string, number>();
    for (const order of timeline) {
      if (order.planned && order.type === 'SELL') {
        sellAveragePrices.set(`${order.ticker}:${order.orderDate}`, position.averagePrice);
      }
      position = positionAfter(position, order);
    }

    const before = investment.orders.reduce<Position>(
      (current, order) =>
        positionAfter(current, {
          type: order.type,
          quantity: order.quantity.toNumber(),
          price: order.price.toNumber(),
        }),
      { quantity: 0, averagePrice: 0 },
    );
    const movedBuys = investment.orders.filter((order) => correctedBuyIds.has(order.id));
    return {
      investment,
      before,
      after: position,
      sellAveragePrices,
      movedBuys,
      updatedBuy:
        investment.ticker === sanb11BuyToEdit.ticker
          ? {
              previousDate: dateOnly(sanb11BuyToUpdate.orderDate),
              date: normalizedBuyDate,
              previousQuantity: sanb11BuyToUpdate.quantity.toNumber(),
              quantity: sanb11BuyToEdit.quantity,
            }
          : null,
    };
  });

  console.log(apply ? 'Applying order changes…' : 'Preview only; no database changes will be made.');
  console.log(
    `BUY orders to move to ${normalizedBuyDate}: ${existingBuyOrdersToMove.length} existing ` +
      `(${sourceBuyDates
        .map(
          (date) =>
            `${existingBuyOrdersToMove.filter((order) => dateOnly(order.orderDate) === date).length} from ${date}`,
        )
        .join(', ')}), ` +
      `${ordersToCreate.filter((order) => order.type === 'BUY').length} new; ` +
      `${ordersAlreadyPresent.filter((order) => order.type === 'BUY').length} already present.`,
  );
  console.log(
    `Planned orders: ${ordersToCreate.length} new, ${ordersAlreadyPresent.length} already present and skipped.`,
  );
  for (const order of existingBuyOrdersToMove) {
    console.log(
      `${order.investment.ticker}: BUY ${order.quantity.toString()} @ ${order.price.toString()}, ` +
        `${dateOnly(order.orderDate)} → ${normalizedBuyDate}`,
    );
  }
  for (const row of rows) {
    console.log(
      `${row.investment.ticker}: current ${row.before.quantity} @ ${row.before.averagePrice.toFixed(8)}; ` +
        (row.updatedBuy
          ? `edit SANB11 BUY ${row.updatedBuy.previousQuantity} → ${row.updatedBuy.quantity} ` +
            `shares and ${row.updatedBuy.previousDate} → ${row.updatedBuy.date}; `
          : '') +
        `${row.movedBuys.length} existing BUY date(s) normalized; ` +
        `after changes ${row.after.quantity} shares @ ${row.after.averagePrice.toFixed(8)}`,
    );
  }
  if (!apply) {
    console.log('Pass --apply to write these changes.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const order of existingBuyOrdersToMove) {
      await tx.order.update({
        where: { id: order.id },
        data: { orderDate: dateAtNoonUtc(normalizedBuyDate) },
      });
    }
    if (!correctedBuyIds.has(sanb11BuyToUpdate.id)) {
      throw new Error('The SANB11 BUY update was lost from the correction plan.');
    }
    await tx.order.update({
      where: { id: sanb11BuyToUpdate.id },
      data: {
        quantity: new Prisma.Decimal(sanb11BuyToEdit.quantity),
        orderDate: dateAtNoonUtc(normalizedBuyDate),
      },
    });

    for (const row of rows) {
      let remainingTargetSellQuantity = row.investment.targetSellQuantity?.toNumber() ?? null;
      for (const order of ordersToCreate.filter((plannedOrder) => plannedOrder.ticker === row.investment.ticker)) {
        await tx.order.create({
          data: {
            investmentId: row.investment.id,
            type: order.type,
            quantity: new Prisma.Decimal(order.quantity),
            price: new Prisma.Decimal(order.price),
            orderDate: dateAtNoonUtc(order.orderDate),
            averagePriceAtSell:
              order.type === 'SELL'
                ? new Prisma.Decimal(
                    row.sellAveragePrices.get(`${row.investment.ticker}:${order.orderDate}`) ?? 0,
                  )
                : null,
          },
        });
        if (order.type === 'BUY' && row.investment.targetBuyQuantity !== null) {
          const remainingTargetBuyQuantity = Math.max(
            0,
            row.investment.targetBuyQuantity.toNumber() - order.quantity,
          );
          await tx.investment.update({
            where: { id: row.investment.id },
            data: { targetBuyQuantity: new Prisma.Decimal(remainingTargetBuyQuantity) },
          });
        }
        if (order.type === 'SELL' && remainingTargetSellQuantity !== null) {
          remainingTargetSellQuantity = Math.max(
            0,
            remainingTargetSellQuantity - order.quantity,
          );
          await tx.investment.update({
            where: { id: row.investment.id },
            data: { targetSellQuantity: new Prisma.Decimal(remainingTargetSellQuantity) },
          });
        }
      }
    }
  });
  console.log('Order changes applied.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
