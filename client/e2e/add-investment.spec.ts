import { test, expect } from '@playwright/test';
import { resetDatabase, gotoHomePage, openAddModal, fillAndSubmitForm } from './helpers';

/**
 * Task 4.2 — E2E: Add Investment Flow
 */
test.beforeEach(async () => {
  await resetDatabase();
});

test('Add Investment button opens the modal', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);
  await expect(page.getByRole('heading', { name: /add investment/i })).toBeVisible();
});

test('fills and saves a new investment, row appears in table', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);
  await fillAndSubmitForm(page, { ticker: 'ITUB3', quantity: '100', averagePrice: '28.35' });

  // Row should appear with the ticker
  await expect(page.getByRole('cell', { name: 'ITUB3', exact: true })).toBeVisible({ timeout: 10_000 });
});

test('new row shows correct stored values', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);
  await fillAndSubmitForm(page, { ticker: 'VALE3', quantity: '50', averagePrice: '65.00' });

  const row = page.getByRole('row', { name: /VALE3/i });
  await expect(row).toBeVisible({ timeout: 10_000 });
  // Quantity should appear
  await expect(row.getByRole('cell').nth(1)).toContainText('50');
});

test('new row shows current price or N/A', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);
  await fillAndSubmitForm(page, { ticker: 'PETR4', quantity: '200', averagePrice: '35.00' });

  const row = page.getByRole('row', { name: /PETR4/i });
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Current price cell: either a formatted value or "N/A"
  const currentPriceCell = row.getByRole('cell').nth(3);
  const text = await currentPriceCell.textContent();
  const isValidPrice = text?.includes('R$') || text === 'N/A';
  expect(isValidPrice).toBe(true);
});

test('Total Invested is calculated correctly', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);
  // 100 × 28.35 = 2835.00
  await fillAndSubmitForm(page, { ticker: 'ITUB3', quantity: '100', averagePrice: '28.35' });

  const row = page.getByRole('row', { name: /ITUB3/i });
  await expect(row).toBeVisible({ timeout: 10_000 });
  // Total Invested column (index 5)
  const totalInvestedCell = row.getByRole('cell').nth(5);
  await expect(totalInvestedCell).toContainText('2.835');
});

test('cancel button does not persist data', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);

  await page.getByLabel(/ticker/i).fill('CANCEL3');
  await page.getByRole('button', { name: /cancel/i }).click();

  // Dialog should close
  await expect(page.getByRole('dialog')).not.toBeVisible();
  // No row for CANCEL3
  await expect(page.getByRole('cell', { name: 'CANCEL3' })).not.toBeVisible();
});
