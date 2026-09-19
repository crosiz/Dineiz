import { defineConfig } from '@playwright/test';

// Isolated API fixtures only. Never imports the legacy database-reset helpers.
export default defineConfig({
  testDir: './tests/audit',
  outputDir: './tests/.audit-results',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: { baseURL: process.env.POS_AUDIT_URL || 'http://localhost:3001', headless: true, channel: 'chrome', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  reporter: [['list']],
  webServer: process.env.POS_AUDIT_URL === 'http://localhost:3101' ? {
    command: 'pnpm exec next start --port 3101',
    url: 'http://localhost:3101',
    env: { POS_BUILD_DIR: '.next-audit' },
    reuseExistingServer: true,
    timeout: 120000,
  } : undefined,
});
