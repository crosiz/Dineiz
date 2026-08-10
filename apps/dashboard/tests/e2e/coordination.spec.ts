import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('Admin and POS Coordination', () => {
  test.beforeEach(async () => {
    try {
      execSync('pnpm dlx tsx ../../packages/db/reset-orders.ts', { stdio: 'ignore' });
    } catch (e) {
      console.error('Failed to reset database', e);
    }
  });

  test('15.1 Complete end-to-end order lifecycle (POS -> Admin)', async ({ browser }) => {
    test.setTimeout(120000); // Admin and POS flow takes longer
    // We need two browser contexts: one for POS, one for Admin
    const adminContext = await browser.newContext({ baseURL: 'http://localhost:3000' });
    const posContext = await browser.newContext({ baseURL: 'http://localhost:3001' });

    const adminPage = await adminContext.newPage();
    const posPage = await posContext.newPage();

    // 1. Admin Login
    await adminPage.goto('/login');
    await adminPage.fill('input[type="email"]', 'admin@kababjees.pk');
    await adminPage.fill('input[type="password"]', 'Admin@123456');
    await adminPage.click('button:has-text("Sign In")');
    await expect(adminPage).toHaveURL('/dashboard', { timeout: 15000 });

    // 2. Open Admin Live Orders
    await adminPage.click('text=Live Orders');
    await expect(adminPage).toHaveURL(/.*\/dashboard\/orders\/live/);

    // 3. POS Login
    await posPage.goto('http://localhost:3001/login');
    // Clear localStorage for a fresh POS session
    await posPage.evaluate(() => localStorage.clear());
    await posPage.reload();
    
    // Wait for role cards
    await expect(posPage.locator('.role-card').first()).toBeVisible({ timeout: 15000 });
    
    // Click on Cashier role card
    const cashierCard = posPage.locator('.role-card', { hasText: 'Cashier' });
    if (await cashierCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cashierCard.click();
    }
    
    // Now wait for staff members to load
    await expect(posPage.locator('.role-card', { hasText: 'Ali Hassan' }).first()).toBeVisible({ timeout: 15000 });
    await posPage.locator('.role-card', { hasText: 'Ali Hassan' }).first().click();
    
    // Enter PIN: 1234
    await posPage.waitForTimeout(500);
    await posPage.click('button:text-is("1")');
    await posPage.click('button:text-is("2")');
    await posPage.click('button:text-is("3")');
    await posPage.click('button:text-is("4")');
    
    // Wait for redirect to /shift/open or /pos/home
    await posPage.waitForURL(/.*localhost:3001\/(pos|shift)/, { timeout: 15000 });
    
    // If it goes to shift open, open the shift
    if (posPage.url().includes('/shift')) {
      await posPage.click('button:has-text("PKR 5,000")');
      await posPage.click('button:has-text("Start Shift")');
      await posPage.waitForURL(/.*localhost:3001\/pos\/home/, { timeout: 15000 });
    }
    
    // 4. Create an order on POS
    await posPage.goto('http://localhost:3001/pos/order?type=dine-in');
    
    // Add item (use data-testid for POS menu items)
    await posPage.waitForSelector('[data-testid="menu-item"]', { timeout: 15_000 });
    const availableItem = posPage.locator('[data-testid="menu-item"]').filter({ hasNot: posPage.locator('text=SOLD OUT') }).first();
    await availableItem.click();
    
    // Handle variants if any
    const confirmVariant = posPage.locator('button', { hasText: /add to order|add to cart|confirm|select/i }).first();
    if (await confirmVariant.isVisible({ timeout: 1500 }).catch(() => false)) {
      const variantOption = posPage.locator('text="Choose Size"').locator('..').locator('label').first();
      if (await variantOption.isVisible({ timeout: 500 }).catch(() => false)) {
        await variantOption.click();
      }
      await confirmVariant.click();
    }
    
    // Send to Kitchen (Text is 'local_fire_department KITCHEN')
    await posPage.locator('button', { hasText: 'KITCHEN' }).click();

    // Admin updates state optimistically, so wait for the actual PUT request to complete
    const [response] = await Promise.all([
      adminPage.waitForResponse(res => res.url().includes('/api/orders/') && res.request().method() === 'PUT'),
      adminPage.locator('button:has-text("Mark Ready")').first().click()
    ]);
    expect(response.status()).toBe(200);

    // Wait for Admin to update to next state before checking POS
    await expect(adminPage.locator('button:has-text("Complete")').first()).toBeVisible({ timeout: 15000 });

    // 7. Verify order updates on POS Tickets
    await posPage.click('a[href="/pos/tickets"]');
    await expect(posPage.locator('button', { hasText: /Collect/i }).first()).toBeVisible({ timeout: 15000 });

    // 8. POS collects payment
    await posPage.click('a[href="/pos/home"]');
    await posPage.locator('.active-order-chip').first().click(); // Click active order strip
    
    await posPage.click('button:has-text("CHARGE")');
    await expect(posPage.locator('h1', { hasText: 'Checkout' })).toBeVisible({ timeout: 5000 });
    
    // Cash payment
    // Choose cash
    await posPage.locator('button', { hasText: 'Cash' }).first().click();
    
    // Enter amount tendered so Confirm Payment becomes enabled
    await posPage.locator('button', { hasText: '+5000' }).click();
    
    const confirmPaymentBtn = posPage.locator('button', { hasText: 'Confirm Payment' }).last();
    await confirmPaymentBtn.click();

    // 9. Verify order moves to COMPLETED in Admin Live Orders
    await expect(adminPage.locator('span', { hasText: /Served/i }).first()).toBeVisible({ timeout: 15000 });

    await adminContext.close();
    await posContext.close();
  });
});
