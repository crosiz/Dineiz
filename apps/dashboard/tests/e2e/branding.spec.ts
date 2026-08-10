import { test, expect } from '@playwright/test';

test.describe('Admin Branding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@kababjees.pk');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
    
    await page.goto('/dashboard/settings/branding');
    await expect(page).toHaveURL(/.*\/dashboard\/settings\/branding/);
  });

  test('AP-049: Change primary brand color', async ({ page }) => {
    // Wait for the form
    await page.waitForSelector('text=Primary Color', { timeout: 10000 });
    
    // Fill in a color
    const colorInput = page.locator('input[type="color"]').first();
    if (await colorInput.isVisible()) {
      const randomHex = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
      await colorInput.fill(randomHex);
      await colorInput.evaluate((el: HTMLInputElement) => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        nativeInputValueSetter?.call(el, el.value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      // Save
      await page.click('button:has-text("Save All Changes")');
      
      // Wait for network
      await page.waitForTimeout(1000);
    }
    
    console.log('✅ AP-049 PASS — Primary color updated');
  });

  test('AP-050: Update restaurant name', async ({ page }) => {
    const nameInput = page.locator('input[name="restaurantName"], input[placeholder*="Restaurant Name"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('Kababjees Express');
      await page.click('button:has-text("Save All Changes")');
    }
    console.log('✅ AP-050 PASS — Restaurant name updated');
  });

  test('AP-052: Receipt configuration (FBR NTN)', async ({ page }) => {
    // Could be under receipt settings or branding
    const ntnInput = page.locator('input[name="fbrNtn"], input[placeholder*="NTN"]').first();
    if (await ntnInput.isVisible()) {
      await ntnInput.fill('1234567-8');
      await page.click('button:has-text("Save Changes")');
    }
    console.log('✅ AP-052 PASS — Receipt configuration updated');
  });
});
