import { type Page, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3000';

/**
 * Clears all investments from the DB via the test-only reset endpoint.
 * Call this in beforeEach/beforeAll to start each test from a clean slate.
 */
export async function resetDatabase(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/test/reset`, { method: 'POST' });
  if (!res.ok) throw new Error(`DB reset failed: ${res.status}`);
}

/**
 * Seeds a single investment via the API and returns the created record.
 */
export async function seedInvestment(data: {
  ticker: string;
  quantity: number;
  averagePrice: number;
}): Promise<{ id: string; ticker: string; quantity: string; averagePrice: string }> {
  const res = await fetch(`${API_BASE}/api/investments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Seed investment failed: ${res.status}`);
  return res.json() as Promise<{ id: string; ticker: string; quantity: string; averagePrice: string }>;
}

/**
 * Navigates to the home page and waits until the investment table is visible.
 */
export async function gotoHomePage(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Finance Investment Manager' })).toBeVisible();
}

/**
 * Opens the "Add Investment" modal.
 */
export async function openAddModal(page: Page): Promise<void> {
  await page.getByRole('button', { name: /add investment/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

/**
 * Fills and submits the investment form.
 * Waits for the dialog to close before returning.
 */
export async function fillAndSubmitForm(
  page: Page,
  data: { ticker: string; quantity: string; averagePrice: string },
): Promise<void> {
  await page.getByLabel(/ticker/i).fill(data.ticker);
  await page.getByLabel(/quantity/i).fill(data.quantity);
  await page.getByLabel(/average price/i).fill(data.averagePrice);
  await page.getByRole('button', { name: /^save$/i }).click();
  // Wait for the modal to close
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
}
