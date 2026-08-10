import { test, expect } from '@playwright/test';

test.describe('Admin Branches Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@kababjees.pk');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.click('a[href="/dashboard/branches"]', { force: true });
    await expect(page).toHaveURL(/.*\/dashboard\/branches/, { timeout: 10000 });
  });

  test('6.2 Add new branch', async ({ page }) => {
    const uniqueBranchName = `North Nazimabad - ${Date.now()}`;
    await page.click('button:has-text("Add Branch")');
    await page.fill('input[name="name"]', uniqueBranchName);
    await page.fill('input[name="address"]', '123 Test Road');
    await page.fill('input[name="city"]', 'Karachi');
    await page.fill('input[name="phone"]', '+923000000000');
    await page.click('button:has-text("Next Step")');
    await page.click('button:has-text("Next Step")');
    await page.click('button:has-text("Next Step")');
    await page.click('button:has-text("Create Branch")');
    
    // Verify it appeared in the list
    await expect(page.locator('h4', { hasText: uniqueBranchName })).toBeVisible({ timeout: 15000 });
  });
});
