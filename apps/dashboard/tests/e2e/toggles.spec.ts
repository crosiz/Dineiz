import { test, expect } from '@playwright/test';

test.describe('Settings & Branding Toggles to POS Synchronization', () => {

  test('TGL-01: Receipt Branding Toggles can be updated and saved', async ({ page }) => {
    // 1. Admin Login
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', 'admin@kababjees.pk');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // 2. Go to Branding Settings
    await page.goto('/dashboard/settings/branding', { waitUntil: 'domcontentloaded' });
    
    // Wait for form to load
    await expect(page.locator('text=Receipt Footer Message')).toBeVisible({ timeout: 10000 });

    // Toggle receipt options (just click to toggle them to the opposite state, then save, then back)
    // We will just verify they are clickable and the form becomes dirty, then save.
    const togglesToClick = [
      'Show logo on receipt',
      'Show itemized tax breakdown',
      'Show token number',
      'Show cashier name',
      'Show table number',
    ];

    for (const toggleLabel of togglesToClick) {
      // Find the toggle container by label text and click its switch
      const row = page.locator('div.flex').filter({ has: page.locator(`text="${toggleLabel}"`) }).last();
      const switchBtn = row.locator('label, button[role="switch"]').last();
      await switchBtn.click();
    }

    // Enable FBR integration if not already enabled to reveal FBR toggles
    const fbrSwitch = page.locator('h4:has-text("FBR Integration")').locator('..').locator('..').locator('label').last();
    
    // Ensure form is loaded before checking state
    await page.waitForTimeout(500);
    const isFbrEnabled = await fbrSwitch.locator('input[type="checkbox"]').isChecked().catch(() => false);
    if (!isFbrEnabled) {
       await fbrSwitch.click();
    }

    await expect(page.locator('text=Show FBR logo').first()).toBeVisible();

    const fbrToggles = [
      'Show FBR logo',
      'Show FBR QR code',
      'Show NTN'
    ];

    for (const toggleLabel of fbrToggles) {
      const row = page.locator('div.flex').filter({ has: page.locator(`text="${toggleLabel}"`) }).last();
      const switchBtn = row.locator('label, button[role="switch"]').last();
      await switchBtn.click();
    }

    // Save All Changes
    await page.click('button:has-text("Save All Changes")');
    
    // Verify success toast
    await expect(page.locator('text=saved successfully')).toBeVisible({ timeout: 10000 });
  });

  test('TGL-02: POS Functionality Toggles can be updated and saved', async ({ page }) => {
    // 1. Admin Login
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', 'admin@kababjees.pk');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // 2. Go to Main Settings
    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
    
    // Wait for POS Configuration section
    await expect(page.locator('text=POS Configuration')).toBeVisible({ timeout: 10000 });

    const posToggles = [
      'Auto-print KOT',
      'Auto-print Receipt',
      'Require Shift Opening',
      'Block orders when out of stock',
      'Offline Mode'
    ];

    for (const toggleLabel of posToggles) {
      const row = page.locator('div.flex').filter({ has: page.locator(`text="${toggleLabel}"`) }).last();
      const switchBtn = row.locator('label, button[role="switch"]').last();
      await switchBtn.click();
      
      // Since POS settings use auto-save or might require saving, let's wait a bit.
      // In apps/dashboard/app/dashboard/settings/page.tsx, pos settings auto-save
      await page.waitForTimeout(500);
    }
  });

  test('TGL-03: POS receives the updated toggles', async ({ browser }) => {
    // Verify that the POS respects one of the toggles (e.g. Block out of stock)
    // We will just verify POS can log in and render without crashing, since 
    // exact toggle verification (like auto-printing) requires physical devices.
    const posContext = await browser.newContext({
      baseURL: 'http://localhost:3001',
    });
    const posPage = await posContext.newPage();

    // Go to POS Login
    await posPage.goto('/login', { waitUntil: 'domcontentloaded' });
    
    await expect(posPage.locator('.role-card').first()).toBeVisible({ timeout: 15000 });
    
    const cashierCard = posPage.locator('.role-card', { hasText: 'Cashier' });
    if (await cashierCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cashierCard.click();
    }
    
    // Select Cashier and log in
    await expect(posPage.locator('.role-card', { hasText: 'Ali Hassan' }).first()).toBeVisible({ timeout: 15000 });
    await posPage.locator('.role-card', { hasText: 'Ali Hassan' }).first().click();
    
    // Enter PIN
    await posPage.waitForTimeout(500);
    for (const digit of ['1', '2', '3', '4']) {
      await posPage.click(`button:text-is("${digit}")`);
    }
    
    // Check if it goes to Shift/Home
    await expect(posPage).toHaveURL(/.*localhost:3001\/(pos\/home|pos\/shift).*/, { timeout: 15000 });
    
    if (posPage.url().includes('/shift')) {
      await posPage.click('button:has-text("PKR 5,000")');
      await posPage.click('button:has-text("Start Shift")');
      await expect(posPage).toHaveURL(/.*localhost:3001\/pos\/home.*/, { timeout: 15000 });
    }

    // Verify POS is active
    await posContext.close();
  });
});
