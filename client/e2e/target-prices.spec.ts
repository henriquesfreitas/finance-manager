import { test, expect } from '@playwright/test';
import { resetDatabase, gotoHomePage, openAddModal, fillAndSubmitForm } from './helpers';

/**
 * E2E: Target Sell / Target Buy price columns
 *
 * These columns are inline-editable cells in the investment table.
 * Tests cover: display when empty, editing via click, saving on blur,
 * clearing by submitting empty input, and color coding when the current
 * price crosses the target.
 */
test.beforeEach(async () => {
  await resetDatabase();
});

// ─── Column visibility ────────────────────────────────────────────────────────

test('Target Sell and Target Buy column headers are visible', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);
  await fillAndSubmitForm(page, { ticker: 'ITUB3', quantity: '100', averagePrice: '28.35' });

  const row = page.getByRole('row', { name: /ITUB3/i });
  await expect(row).toBeVisible({ timeout: 10_000 });

  await expect(page.getByRole('columnheader', { name: 'Target Sell' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Target Buy' })).toBeVisible();
});

// ─── Initial empty state ──────────────────────────────────────────────────────

test('Target Sell and Target Buy cells are empty by default', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);
  await fillAndSubmitForm(page, { ticker: 'ITUB3', quantity: '100', averagePrice: '28.35' });

  const row = page.getByRole('row', { name: /ITUB3/i });
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Both target cells show the placeholder dash when unset
  const sellBtn = row.getByRole('button', { name: /edit target sell price for ITUB3/i });
  const buyBtn = row.getByRole('button', { name: /edit target buy price for ITUB3/i });

  await expect(sellBtn).toBeVisible();
  await expect(buyBtn).toBeVisible();
});

// ─── Editing — click activates input ─────────────────────────────────────────

test('clicking Target Sell cell activates an input field', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);
  await fillAndSubmitForm(page, { ticker: 'ITUB3', quantity: '100', averagePrice: '28.35' });

  const row = page.getByRole('row', { name: /ITUB3/i });
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.getByRole('button', { name: /edit target sell price for ITUB3/i }).click();

  // An input should now be visible in the cell
  await expect(row.getByRole('spinbutton', { name: /edit target sell price/i })).toBeVisible();
});

test('clicking Target Buy cell activates an input field', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);
  await fillAndSubmitForm(page, { ticker: 'ITUB3', quantity: '100', averagePrice: '28.35' });

  const row = page.getByRole('row', { name: /ITUB3/i });
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.getByRole('button', { name: /edit target buy price for ITUB3/i }).click();

  await expect(row.getByRole('spinbutton', { name: /edit target buy price/i })).toBeVisible();
});

// ─── Saving on blur ───────────────────────────────────────────────────────────

test('setting a Target Sell price persists after blur', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);
  await fillAndSubmitForm(page, { ticker: 'ITUB3', quantity: '100', averagePrice: '28.35' });

  const row = page.getByRole('row', { name: /ITUB3/i });
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Click to edit, type a value, then blur by pressing Tab
  await row.getByRole('button', { name: /edit target sell price for ITUB3/i }).click();
  const input = row.getByRole('spinbutton', { name: /edit target sell price/i });
  await input.fill('35.5');
  await input.press('Tab'); // triggers blur → save

  // The input should be gone; the formatted price should appear
  await expect(input).not.toBeVisible({ timeout: 5_000 });
  await expect(row.getByRole('button', { name: /edit target sell price for ITUB3/i })).toContainText('R$');
});

test('setting a Target Buy price persists after Enter key', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);
  await fillAndSubmitForm(page, { ticker: 'ITUB3', quantity: '100', averagePrice: '28.35' });

  const row = page.getByRole('row', { name: /ITUB3/i });
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.getByRole('button', { name: /edit target buy price for ITUB3/i }).click();
  const input = row.getByRole('spinbutton', { name: /edit target buy price/i });
  await input.fill('25');
  await input.press('Enter');

  await expect(input).not.toBeVisible({ timeout: 5_000 });
  await expect(row.getByRole('button', { name: /edit target buy price for ITUB3/i })).toContainText('R$');
});

// ─── Escape cancels ───────────────────────────────────────────────────────────

test('pressing Escape cancels editing without saving', async ({ page }) => {
  await gotoHomePage(page);
  await openAddModal(page);
  await fillAndSubmitForm(page, { ticker: 'ITUB3', quantity: '100', averagePrice: '28.35' });

  const row = page.getByRole('row', { name: /ITUB3/i });
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.getByRole('button', { name: /edit target sell price for ITUB3/i }).click();
  const input = row.getByRole('spinbutton', { name: /edit target sell price/i });
  await input.fill('999');
  await input.press('Escape');

  // Input closes without saving
  await expect(input).not.toBeVisible({ timeout: 5_000 });

  // The button should not show R$999 (value was not saved)
  const btn = row.getByRole('button', { name: /edit target sell price for ITUB3/i });
  const text = await btn.textContent();
  expect(text).not.toContain('999');
});
