import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'tests/playwright-report', open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3001',
    headless: false,
    viewport: { width: 1400, height: 800 },
    actionTimeout: 10_000,
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Use system-installed Google Chrome — no download needed
    channel: 'chrome',
  },
  projects: [
    {
      name: 'Google Chrome',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
      },
    },
  ],
});
