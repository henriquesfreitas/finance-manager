import { test, expect } from '@playwright/test';
import { resetDatabase, gotoHomePage } from './helpers';

/**
 * Task 4.1 — Full Stack Integration: app loads and shows correct empty state.
 */
test.beforeEach(async () => {
  await resetDatabase();
});

test('app loads and renders title', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Finance Investment Manager')).toBeVisible();
});

test('shows empty state when no investments exist', async ({ page }) => {
  await gotoHomePage(page);
  await expect(page.getByText(/no investments yet/i)).toBeVisible();
});
