import type { OrderType } from '../types/order.js';

/**
 * A single order entry consumed by the calculator.
 * Mirrors the subset of OrderRecord fields needed for position computation.
 */
export interface OrderEntry {
  type: OrderType;
  /** Must be > 0 */
  quantity: number;
  /** Unit price; must be > 0 */
  price: number;
}

/**
 * Computed position derived from a sequence of orders.
 * Values are rounded to 8 decimal places.
 */
export interface PositionState {
  quantity: number;
  averagePrice: number;
}

const DECIMAL_PLACES = 8;

/**
 * Rounds a number to DECIMAL_PLACES using the "round half away from zero"
 * strategy, which matches standard Brazilian financial rounding.
 */
function round8(value: number): number {
  const factor = Math.pow(10, DECIMAL_PLACES);
  return Math.round(value * factor) / factor;
}

/**
 * Applies a single BUY order to the running position.
 * Formula: newAvg = (prevQty × prevAvg + orderQty × orderPrice) / (prevQty + orderQty)
 * When prevQty is zero (fresh or reset position), avg becomes the order price directly.
 */
function applyBuy(state: PositionState, order: OrderEntry): PositionState {
  const newQuantity = state.quantity + order.quantity;
  const totalCost = state.quantity * state.averagePrice + order.quantity * order.price;
  const newAverage = round8(totalCost / newQuantity);
  return { quantity: newQuantity, averagePrice: newAverage };
}

/**
 * Applies a single SELL order to the running position.
 * Quantity is reduced; average price is preserved.
 * When quantity reaches zero the average is reset to zero.
 */
function applySell(state: PositionState, order: OrderEntry): PositionState {
  const newQuantity = state.quantity - order.quantity;
  const newAverage = newQuantity === 0 ? 0 : state.averagePrice;
  return { quantity: newQuantity, averagePrice: newAverage };
}

/**
 * Computes the running position from a chronological sequence of orders.
 * Uses the Brazilian "preço médio ponderado" method.
 *
 * Behaviours:
 * - BUY:  newAvg = (prevQty × prevAvg + orderQty × orderPrice) / (prevQty + orderQty)
 * - SELL: quantity decreases, average price unchanged
 * - Zero position: average resets to zero; the next BUY sets average to that order's price
 * - All results are rounded to 8 decimal places
 *
 * This function is pure — it produces no side effects and always returns the
 * same result for the same input.
 *
 * @example
 *   const calc = createWeightedAverageCalculator();
 *   calc.computePosition([
 *     { type: 'BUY',  quantity: 100, price: 10 },
 *     { type: 'BUY',  quantity: 50,  price: 20 },
 *   ]);
 *   // → { quantity: 150, averagePrice: 13.33333333 }
 */
/**
 * Applies a SPLIT order to the running position.
 * The quantity field stores the split factor (e.g. 2 for a 2:1 split).
 * Quantity is multiplied by the factor; average price is divided.
 * Total cost (quantity × averagePrice) remains unchanged.
 */
function applySplit(state: PositionState, order: OrderEntry): PositionState {
  if (state.quantity === 0) return state;
  const factor = order.quantity;
  const newQuantity = round8(state.quantity * factor);
  const newAverage = round8(state.averagePrice / factor);
  return { quantity: newQuantity, averagePrice: newAverage };
}

function computePosition(orders: OrderEntry[]): PositionState {
  const initial: PositionState = { quantity: 0, averagePrice: 0 };
  return orders.reduce((state, order) => {
    if (order.type === 'BUY' || order.type === 'BONUS') return applyBuy(state, order);
    if (order.type === 'SPLIT') return applySplit(state, order);
    return applySell(state, order);
  }, initial);
}

/**
 * Factory that returns the weighted average calculator.
 * Follows the project DI convention — callers receive a plain object with
 * methods so they can be injected and replaced in tests.
 *
 * @example
 *   const calculator = createWeightedAverageCalculator();
 *   const position = calculator.computePosition(orders);
 */
export function createWeightedAverageCalculator() {
  return { computePosition };
}

export type WeightedAverageCalculator = ReturnType<typeof createWeightedAverageCalculator>;
