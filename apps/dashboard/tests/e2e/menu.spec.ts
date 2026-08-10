import { test, expect } from '@playwright/test';

test.describe('Admin Menu Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@kababjees.pk');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
    await page.click('text=Menu');
    await expect(page).toHaveURL(/.*\/dashboard\/menu/);
  });

  test('5.1 Add new menu item', async ({ page }) => {
    const uniqueItemName = `Test Chapli Kabab - ${Date.now()}`;
    await page.waitForSelector('select.appearance-none', { timeout: 10000 });
    await page.selectOption('select.appearance-none', { index: 1 });
    await page.waitForTimeout(500); // Give the button a moment to enable
    await page.click('button:has-text("Add Item")');
    await page.waitForSelector('select[name="categoryId"]', { timeout: 10000 });
    await page.locator('select[name="categoryId"]').selectOption({ index: 1 });
    await page.fill('input[name="name"]', uniqueItemName);
    await page.fill('input[name="basePrice"]', '750');
    // Save item
    await page.click('button:has-text("Save")');
    
    // Verify it appeared in the list
    await expect(page.locator(`text=${uniqueItemName}`)).toBeVisible();
  });
});
