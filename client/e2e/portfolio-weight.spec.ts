import { test, expect } from '@playwright/test';
import { resetDatabase, gotoHomePage, openAddModal, fillAndSubmitForm } from './helpers';

/**
 * Portfolio % column — verifies that each row shows its share of the total portfolio
 * by current market value, with an invested-basis tooltip on hover.
 *
 * Column order (0-indexed):
 * 0  Ticker
 * 1  Quantity
 * 2  Avg Price
 * 3  Current Price
 * 4  Daily Change %
 * 5  Total Invested
 * 6  Current Total
 * 7  Profit
 * 8  Variation %
 * 9  Portfolio %   ← new
 * 10 Actions
 */
test.beforeEach(async () => {
  await resetDatabase();
});

test('Portfolio % cell is present in the table header', async ({ page }) => {
  await gotoHomePage(page);
  await expect(page.getByRole('columnheader', { name: /portfolio %/i })).toBeVisible();
});

test('single investment shows 100% or N/A in Portfolio % column', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);
  await fillAndSubmitForm(page, { ticker: 'ITUB3', quantity: '100', averagePrice: '28.35' });

  const row = page.getByRole('row', { name: /ITUB3/i });
  await expect(row).toBeVisible({ timeout: 10_000 });

  const portfolioCell = row.getByRole('cell').nth(9);
  const text = await portfolioCell.textContent();

  // With a single investment, it must be 100.0% (when price available) or N/A
  const isValid = text?.includes('100.0%') || text?.includes('N/A');
  expect(isValid).toBe(true);
});

test('Portfolio % cell shows N/A for a ticker with no real price', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);
  await fillAndSubmitForm(page, {
    ticker: 'FAKEX99',
    quantity: '100',
    averagePrice: '10.00',
  });

  const row = page.getByRole('row', { name: /FAKEX99/i });
  await expect(row).toBeVisible({ timeout: 10_000 });

  const portfolioCell = row.getByRole('cell').nth(9);
  await expect(portfolioCell).toContainText('N/A');
});

test('Portfolio % tooltip shows invested-basis percentage on hover', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);
  await fillAndSubmitForm(page, { ticker: 'ITUB3', quantity: '100', averagePrice: '28.35' });

  const row = page.getByRole('row', { name: /ITUB3/i });
  await expect(row).toBeVisible({ timeout: 10_000 });

  const portfolioCell = row.getByRole('cell').nth(9);
  const weightSpan = portfolioCell.locator('span[title]');

  // If price is available, the span with title attribute must exist
  const count = await weightSpan.count();
  if (count > 0) {
    const title = await weightSpan.getAttribute('title');
    expect(title).toMatch(/by invested:/i);
    expect(title).toMatch(/\d+\.\d+%|N\/A/);
  } else {
    // Price unavailable — N/A is shown, no tooltip span
    await expect(portfolioCell).toContainText('N/A');
  }
});
