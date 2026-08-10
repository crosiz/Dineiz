import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard Home', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@kababjees.pk');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
  });

  test('2.1 KPI cards show real data', async ({ page }) => {
    await expect(page.locator('text=Revenue')).toBeVisible();
    await expect(page.locator('text=Active Orders')).toBeVisible();
    await expect(page.locator('text=Total Orders')).toBeVisible();
    await expect(page.locator('text=Avg Order Value')).toBeVisible();
  });

  test('2.3 Recent orders section', async ({ page }) => {
    await expect(page.locator('text=Recent Orders')).toBeVisible();
  });
});
