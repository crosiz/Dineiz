import { defineConfig } from '@playwright/test';

// Isolated API fixtures only. Never imports the legacy database-reset helpers.
export default defineConfig({
  testDir: './tests/audit',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://localhost:3001', headless: true, channel: 'chrome', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  reporter: [['list']],
});
