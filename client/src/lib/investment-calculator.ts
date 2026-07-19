/**
 * Pure financial calculation functions for the investment portfolio.
 * All functions accept plain numbers; callers are responsible for
 * parsing string decimals from the API before calling these.
 *
 * Each function returns null when the required inputs aren't available
 * (e.g. currentPrice is null because Yahoo Finance is down).
 */

/**
 * Total amount invested = quantity × averagePrice.
 *
 * @example calculateTotalInvested(100, 28.35) → 2835
 */
export function calculateTotalInvested(quantity: number, averagePrice: number): number {
  return quantity * averagePrice;
}

/**
 * Current market value of the position = quantity × currentPrice.
 * Returns null when currentPrice is unavailable.
 *
 * @example calculateCurrentTotal(100, 29.50) → 2950
 */
export function calculateCurrentTotal(
  quantity: number,
  currentPrice: number | null,
): number | null {
  if (currentPrice === null) return null;
  return quantity * currentPrice;
}

/**
 * Profit (or loss) = currentTotal − totalInvested.
 * Returns null when currentTotal is null (price unavailable).
 *
 * @example calculateProfit(2950, 2835) → 115
 * @example calculateProfit(null, 2835) → null
 */
export function calculateProfit(
  currentTotal: number | null,
  totalInvested: number,
): number | null {
  if (currentTotal === null) return null;
  return currentTotal - totalInvested;
}

/**
 * Total variation percentage = (profit / totalInvested) × 100.
 * Returns null when profit is null or totalInvested is 0 (avoids division by zero).
 *
 * @example calculateTotalVariation(115, 2835) → 4.056...
 * @example calculateTotalVariation(null, 2835) → null
 * @example calculateTotalVariation(100, 0) → null
 */
export function calculateTotalVariation(
  profit: number | null,
  totalInvested: number,
): number | null {
  if (profit === null) return null;
  if (totalInvested === 0) return null;
  return (profit / totalInvested) * 100;
}

/**
 * Portfolio weight by current market value = (positionCurrentTotal / portfolioCurrentTotal) × 100.
 * Returns null when either value is null or portfolioCurrentTotal is 0.
 *
 * @example calculatePortfolioWeight(2950, 20000) → 14.75
 * @example calculatePortfolioWeight(null, 20000) → null
 */
export function calculatePortfolioWeight(
  positionCurrentTotal: number | null,
  portfolioCurrentTotal: number | null,
): number | null {
  if (positionCurrentTotal === null || portfolioCurrentTotal === null) return null;
  if (portfolioCurrentTotal === 0) return null;
  return (positionCurrentTotal / portfolioCurrentTotal) * 100;
}

/**
 * Portfolio weight by total invested = (positionTotalInvested / portfolioTotalInvested) × 100.
 * Returns null when portfolioTotalInvested is 0 (avoids division by zero).
 *
 * @example calculatePortfolioWeightByInvested(2835, 18000) → 15.75
 * @example calculatePortfolioWeightByInvested(2835, 0) → null
 */
export function calculatePortfolioWeightByInvested(
  positionTotalInvested: number,
  portfolioTotalInvested: number,
): number | null {
  if (portfolioTotalInvested === 0) return null;
  return (positionTotalInvested / portfolioTotalInvested) * 100;
}
