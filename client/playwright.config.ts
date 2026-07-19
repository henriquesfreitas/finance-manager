import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_URL = 'http://localhost:3000';
const CLIENT_URL = 'http://localhost:5173';
const serverRoot = path.resolve(__dirname, '../server');

/**
 * Playwright E2E configuration.
 *
 * Both the Express API server and the Vite dev server are listed as webServer
 * entries with reuseExistingServer=true so they can be pre-started manually
 * during development, avoiding a cold-start on every test run.
 *
 * For a clean run from scratch: start both servers manually first:
 *   cd server && npx tsx src/index.ts
 *   cd client && npm run dev
 * Then: npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // serial — tests share DB state via reset endpoint
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: CLIENT_URL,
    trace: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // Express API server — start from the server directory
      command: `node --import tsx/esm "${serverRoot}/src/index.ts"`,
      url: `${SERVER_URL}/health`,
      reuseExistingServer: true,
      timeout: 30_000,
      env: { NODE_ENV: 'development', DATABASE_URL: process.env['DATABASE_URL'] ?? 'postgresql://finance:finance@localhost:5432/finance_manager' },
    },
    {
      // Vite dev server
      command: 'npm run dev',
      url: CLIENT_URL,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
