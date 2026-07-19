import { test, expect } from '@playwright/test';
import { resetDatabase, seedInvestment, gotoHomePage } from './helpers';

/**
 * Task 4.3 — E2E: Edit Investment Flow
 */
test.beforeEach(async () => {
  await resetDatabase();
  await seedInvestment({ ticker: 'ITUB3', quantity: 100, averagePrice: 28.35 });
});

test('Edit button opens modal pre-filled with current data', async ({ page }) => {
  await gotoHomePage(page);

  const row = page.getByRole('row', { name: /ITUB3/i });
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Click the edit (pencil) button on the ITUB3 row
  await row.getByRole('button', { name: /edit ITUB3/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Ticker field should be pre-filled and disabled
  const tickerInput = dialog.getByLabel(/ticker/i);
  await expect(tickerInput).toHaveValue('ITUB3');
  await expect(tickerInput).toBeDisabled();

  // Quantity should be pre-filled
  await expect(dialog.getByLabel(/quantity/i)).toHaveValue('100');
});

test('modifying quantity updates the calculated fields in the table', async ({ page }) => {
  await gotoHomePage(page);

  const row = page.getByRole('row', { name: /ITUB3/i });
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.getByRole('button', { name: /edit ITUB3/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Change quantity from 100 to 200
  const quantityInput = dialog.getByLabel(/quantity/i);
  await quantityInput.clear();
  await quantityInput.fill('200');

  await dialog.getByRole('button', { name: /^save$/i }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  // Total Invested should now be 200 × 28.35 = 5670
  const updatedRow = page.getByRole('row', { name: /ITUB3/i });
  await expect(updatedRow).toBeVisible({ timeout: 10_000 });
  const totalInvestedCell = updatedRow.getByRole('cell').nth(5);
  await expect(totalInvestedCell).toContainText('5.670');
});
