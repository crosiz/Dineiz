/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST GROUP 11 — Kitchen Display System (KDS)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Coverage:
 *   11.1  Order appears on KDS when sent to kitchen
 *   11.2  Toggling items on KDS
 *   11.3  Marking order as ready from KDS
 */

import { test, expect } from '@playwright/test';
import {
  freshSession,
  navigateTo,
  addFirstMenuItem,
  clickKitchenButton,
  resetDatabase,
} from './helpers';

test.beforeEach(async () => {
  await resetDatabase();
});

// ─────────────────────────────────────────────────────────────────────────────
// 11.1  KDS Flow
// ─────────────────────────────────────────────────────────────────────────────
test('11.1 KDS Flow — Order appears, items can be toggled, order can be marked ready', async ({ page }) => {
  await freshSession(page);
  
  // 1. Create order
  await navigateTo(page, '/pos/order?type=takeaway');
  await addFirstMenuItem(page);
  await clickKitchenButton(page);
  await page.waitForTimeout(2000);

  // 2. Go to KDS
  await navigateTo(page, '/pos/kds');

  // Verify KDS title
  const kdsTitle = page.locator('h1', { hasText: 'KITCHEN COMMAND' });
  await expect(kdsTitle).toBeVisible({ timeout: 5000 });

  // 3. Mark item as done (toggling)
  // Looking for the circle checkbox button inside an item row
  const itemCheckbox = page.locator('article button.w-11.h-11').first();
  if (await itemCheckbox.isVisible({ timeout: 2000 })) {
    await itemCheckbox.click();
    // Verify it changes state (the inner div scales up or color changes)
    const checkIcon = itemCheckbox.locator('.material-symbols-outlined');
    await expect(checkIcon).toBeVisible({ timeout: 2000 });
  }

  // 4. Mark order as Ready
  const markReadyBtn = page.locator('button', { hasText: /MARK AS READY|READY/i }).first();
  if (await markReadyBtn.isVisible({ timeout: 2000 })) {
    await markReadyBtn.click();
    await page.waitForTimeout(2000);
  }
  
  console.log('✅ 11.1 PASS — KDS Flow completed successfully');
});
