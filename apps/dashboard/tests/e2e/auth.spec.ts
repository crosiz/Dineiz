import { test, expect } from '@playwright/test';

test.describe('Admin Authentication and Roles', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
  });

  test('1.1 Business Owner first login', async ({ page }) => {
    // Using test credentials from the checklist
    await page.fill('input[type="email"]', 'admin@kababjees.pk');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button:has-text("Sign In")');

    // Verify successful login
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
    
    // Verify enterprise management badge and sidebar items
    await expect(page.locator('text=Operations')).toBeVisible();
    await expect(page.locator('text=Business')).toBeVisible();
    await expect(page.locator('a[href="/dashboard/settings"]')).toBeVisible();
  });

  test('1.4 Session persistence across browser refresh', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', 'admin@kababjees.pk');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // Refresh page
    await page.reload();
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
  });
});
