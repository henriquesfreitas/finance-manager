import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __cspViolations: string[];
    __unexpectedInlineScriptRan?: boolean;
  }
}

const nginxConfig = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf8');
const productionCsp = nginxConfig.match(/^\s*add_header Content-Security-Policy "([^"]+)" always;/m)?.[1];

if (!productionCsp) {
  throw new Error('Content-Security-Policy header is missing from client/nginx.conf');
}

test('production CSP permits the app and blocks injected inline scripts', async ({ page }) => {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    window.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations.push(`${event.violatedDirective}: ${event.blockedURI} (${event.sourceFile}:${event.lineNumber})`);
    });
  });

  const browserTestCsp = productionCsp;
  await page.route('**/*', async (route) => {
    if (!route.request().isNavigationRequest()) {
      await route.continue();
      return;
    }

    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': browserTestCsp,
      },
    });
  });

  await page.route('**/api/**', (route) => route.fulfill({
    status: 401,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ error: 'Authentication required' }),
  }));

  const response = await page.goto('/login');
  expect(response?.headers()['content-security-policy']).toBe(browserTestCsp);
  await expect(page.getByRole('heading', { name: 'Finance Manager' })).toBeVisible();
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);

  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__unexpectedInlineScriptRan = true;';
    document.head.append(script);
  });

  await expect.poll(() => page.evaluate(() => (
    window.__cspViolations.some((violation) => violation.startsWith('script-src'))
  ))).toBe(true);
  expect(await page.evaluate(() => window.__unexpectedInlineScriptRan)).toBeUndefined();
});
