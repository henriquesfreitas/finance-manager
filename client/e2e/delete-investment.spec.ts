import { test, expect } from '@playwright/test';
import { resetDatabase, seedInvestment, gotoHomePage } from './helpers';

/**
 * Task 4.4 — E2E: Delete Investment Flow
 */
test.beforeEach(async () => {
  await resetDatabase();
  await seedInvestment({ ticker: 'VALE3', quantity: 50, averagePrice: 65.0 });
});

test('Delete button opens the confirmation dialog', async ({ page }) => {
  await gotoHomePage(page);

  const row = page.getByRole('row', { name: /VALE3/i });
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.getByRole('button', { name: /delete VALE3/i }).click();

  // AlertDialog should appear with the ticker in the title
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: /delete VALE3/i })).toBeVisible();
});

test('Cancel keeps the row in the table', async ({ page }) => {
  await gotoHomePage(page);

  const row = page.getByRole('row', { name: /VALE3/i });
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.getByRole('button', { name: /delete VALE3/i }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();

  // Click Cancel
  await page.getByRole('button', { name: /cancel/i }).click();
  await expect(page.getByRole('alertdialog')).not.toBeVisible();

  // Row should still be there
  await expect(page.getByRole('cell', { name: 'VALE3', exact: true })).toBeVisible();
});

test('Confirm deletes the row from the table', async ({ page }) => {
  await gotoHomePage(page);

  const row = page.getByRole('row', { name: /VALE3/i });
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.getByRole('button', { name: /delete VALE3/i }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();

  // Click Delete (the confirm action)
  await page.getByRole('button', { name: /^delete$/i }).click();
  await expect(page.getByRole('alertdialog')).not.toBeVisible({ timeout: 10_000 });

  // Row should be gone, empty state shown
  await expect(page.getByRole('cell', { name: 'VALE3' })).not.toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/no investments yet/i)).toBeVisible();
});
