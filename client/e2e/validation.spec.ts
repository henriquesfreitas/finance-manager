import { test, expect } from '@playwright/test';
import { resetDatabase, gotoHomePage, openAddModal } from './helpers';

/**
 * Task 4.5 — E2E: Validation
 */
test.beforeEach(async () => {
  await resetDatabase();
});

test('submitting empty form shows validation errors', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);

  // Submit without filling anything
  await page.getByRole('button', { name: /^save$/i }).click();

  // At least one validation error should appear
  const errors = page.locator('[role="alert"]');
  await expect(errors.first()).toBeVisible();
});

test('submitting negative quantity shows an error', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);

  await page.getByLabel(/ticker/i).fill('ITUB3');
  await page.getByLabel(/quantity/i).fill('-5');
  await page.getByLabel(/average price/i).fill('28.35');
  await page.getByRole('button', { name: /^save$/i }).click();

  await expect(page.locator('[role="alert"]').first()).toBeVisible();
  // Modal should still be open (not saved)
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('submitting zero quantity shows an error', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);

  await page.getByLabel(/ticker/i).fill('ITUB3');
  await page.getByLabel(/quantity/i).fill('0');
  await page.getByLabel(/average price/i).fill('28.35');
  await page.getByRole('button', { name: /^save$/i }).click();

  await expect(page.locator('[role="alert"]').first()).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('submitting empty ticker shows an error', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);

  // Leave ticker empty
  await page.getByLabel(/quantity/i).fill('100');
  await page.getByLabel(/average price/i).fill('28.35');
  await page.getByRole('button', { name: /^save$/i }).click();

  await expect(page.locator('[role="alert"]').first()).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('ticker auto-uppercases as user types', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);

  const tickerInput = page.getByLabel(/ticker/i);
  await tickerInput.fill('itub3');

  // Field value should be uppercased
  await expect(tickerInput).toHaveValue('ITUB3');
});
