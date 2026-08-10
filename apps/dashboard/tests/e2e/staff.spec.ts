import { test, expect } from '@playwright/test';

test.describe('Admin Staff Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@kababjees.pk');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.click('a[href="/dashboard/staff"]', { force: true });
    await expect(page).toHaveURL(/.*\/dashboard\/staff/, { timeout: 10000 });
  });

  test('7.1 Create cashier with PIN', async ({ page }) => {
    const uniqueStaffName = `Test Cashier - ${Date.now()}`;
    await page.click('button:has-text("Add Staff Member")');
    await page.fill('input[name="name"]', uniqueStaffName);
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`);
    // Select role
    await page.getByText('Cashier', { exact: true }).click();
    // Select branch
    await page.locator('.fixed.inset-0 select').selectOption({ index: 1 });
    // Enter PIN
    await page.click('button:has-text("AUTOGENERATE")');
    
    await page.click('button:has-text("Create Staff Member")');
    await page.waitForLoadState('networkidle');
    
    // Verify it appeared in the list
    await expect(page.locator(`text=${uniqueStaffName}`)).toBeVisible({ timeout: 15000 });
  });
});
