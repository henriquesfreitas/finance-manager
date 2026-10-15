import { defineConfig, devices } from '@playwright/test';

const previewUrl = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: previewUrl,
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx vite build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: previewUrl,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_API_BASE_URL: '' },
  },
});
