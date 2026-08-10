/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST GROUP 3 & 4 — Order Flows (Dine-In, Takeaway, Delivery)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Coverage:
 *   3.1  Dine-in: Home → Tables → Items → KITCHEN → Success toast
 *   3.2  Table map turns occupied (red) after order sent
 *   3.3  Order appears in /pos/tickets with IN_KITCHEN status
 *   3.4  Adding items to existing un-paid table order
 *   3.5  Takeaway order from home dashboard → KITCHEN
 *   3.6  Delivery order creation
 *   3.7  Table conflict (another user opens table)
 */

import { test, expect } from '@playwright/test';
import {
  freshSession,
  clickFreeTable,
  addFirstMenuItem,
  addNthMenuItem,
  clickKitchenButton,
  expectToast,
  navigateTo,
  resetDatabase
} from './helpers';

test.beforeEach(async () => {
  await resetDatabase();
});

// ─────────────────────────────────────────────────────────────────────────────
// 3.1  New dine-in order end-to-end
// ─────────────────────────────────────────────────────────────────────────────
test('3.1 Dine-in order — table → items → KITCHEN → success toast', async ({ page }) => {
  await freshSession(page);
  
  // ── STEP: Tap "New Order" (Dine-In) quick action card ───────────────────
  const newOrderCard = page.locator('.hero-card', { hasText: 'New Order' }).first();
  await expect(newOrderCard).toBeVisible({ timeout: 8000 });
  await newOrderCard.click();

  // ── EXPECT: Navigated to /pos/tables ────────────────────────────────────
  await page.waitForURL(/pos\/tables/, { timeout: 10_000 });

  // ── STEP: Click a free table ────────────────────────────────────────────
  await clickFreeTable(page);

  // ── EXPECT: Navigated to order screen (/pos/order) ──────────────────────
  await page.waitForURL(/pos\/order/, { timeout: 10_000 });

  // ── STEP: Add first available menu item ─────────────────────────────────
  await addFirstMenuItem(page);

  // ── EXPECT: Item appears in cart list ───────────────────────────────────
  const orderTotal = page.locator('text=Order Total').first();
  await expect(orderTotal, 'Order Total section should appear when items are in cart').toBeVisible({ timeout: 5000 });

  // ── STEP: Add a second item ─────────────────────────────────────────────
  await addNthMenuItem(page, 1);

  // ── STEP: Click KITCHEN ─────────────────────────────────────────────────
  await clickKitchenButton(page);

  // ── EXPECT: Success toast appears ───────────────────────────────────────
  await expectToast(page);

  console.log('✅ 3.1 PASS — Order sent to kitchen with success toast');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3.2  Table turns occupied after order sent to kitchen
// ─────────────────────────────────────────────────────────────────────────────
test('3.2 Table status — turns occupied (red border) after order sent to kitchen', async ({ page }) => {
  await freshSession(page);

  await navigateTo(page, '/pos/tables');
  await clickFreeTable(page);
  
  // Note the table ID from the URL if possible, but let's just check if ANY table is occupied
  await page.waitForURL(/pos\/order/, { timeout: 10_000 });
  await addFirstMenuItem(page);
  await clickKitchenButton(page);
  await page.waitForTimeout(2000); // Wait for API and socket sync

  // ── STEP: Navigate back to /pos/tables ──────────────────────────────────
  await navigateTo(page, '/pos/tables');

  // ── EXPECT: At least one table has occupied status ──────────────────────
  const occupiedTable = page.locator('[data-testid="table-node"][data-table-status="occupied"]').first();
  await expect(occupiedTable, 'At least one table should be occupied after order').toBeVisible({ timeout: 10_000 });

  console.log('✅ 3.2 PASS — Table is occupied after order sent to kitchen');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3.3  Order appears in /pos/tickets with IN_KITCHEN status
// ─────────────────────────────────────────────────────────────────────────────
test('3.3 Tickets — IN_KITCHEN badge visible in tickets dashboard', async ({ page }) => {
  await freshSession(page);

  await navigateTo(page, '/pos/tables');
  await clickFreeTable(page);
  await page.waitForURL(/pos\/order/, { timeout: 10_000 });
  await addFirstMenuItem(page);
  await clickKitchenButton(page);
  await page.waitForTimeout(2000);

  // ── STEP: Navigate to /pos/tickets ──────────────────────────────────────
  await navigateTo(page, '/pos/tickets');

  // ── EXPECT: Badge with "IN KITCHEN" text is visible ─────────────────────
  const inKitchenBadge = page.locator('text=/IN KITCHEN/i').first();
  await expect(inKitchenBadge, '"IN KITCHEN" status badge must be visible').toBeVisible({ timeout: 10_000 });

  console.log('✅ 3.3 PASS — IN KITCHEN order visible in /pos/tickets');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3.4  Adding items to existing un-paid order
// ─────────────────────────────────────────────────────────────────────────────
test('3.4 Modify order — add items to existing IN_KITCHEN table order', async ({ page }) => {
  await freshSession(page);

  // 1. Create initial order
  await navigateTo(page, '/pos/tables');
  await clickFreeTable(page);
  await page.waitForURL(/pos\/order/, { timeout: 10_000 });
  await addFirstMenuItem(page);
  await clickKitchenButton(page);
  await page.waitForTimeout(2000);

  // 2. Go back to tables, click the occupied table
  await navigateTo(page, '/pos/tables');
  const occupiedTable = page.locator('[data-testid="table-node"][data-table-status="occupied"]').first();
  await occupiedTable.click();

  // Wait for popup and click Add Items
  const addItemsBtn = page.locator('button', { hasText: 'Add Items' }).first();
  await expect(addItemsBtn).toBeVisible({ timeout: 5000 });
  await addItemsBtn.click();

  await page.waitForURL(/pos\/order/, { timeout: 10_000 });
  
  // 3. Add another item
  await addNthMenuItem(page, 2);
  
  // 4. Send to kitchen again
  await clickKitchenButton(page);
  await expectToast(page);

  console.log('✅ 3.4 PASS — Added items to existing order');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3.5  Takeaway order creation
// ─────────────────────────────────────────────────────────────────────────────
test('3.5 Takeaway order — created from home dashboard', async ({ page }) => {
  await freshSession(page);

  // ── STEP: Click "Takeaway" quick action card ────────────────────────────
  const takeawayCard = page.locator('.hero-card', { hasText: 'Takeaway' }).first();
  await expect(takeawayCard).toBeVisible({ timeout: 8000 });
  await takeawayCard.click();

  // ── EXPECT: Navigated to /pos/order?type=takeaway ───────────────────────
  await page.waitForURL(/pos\/order.*type=takeaway/, { timeout: 10_000 });

  // ── EXPECT: Order type shows TAKEAWAY ───────────────────────────────────
  const takeawayLabel = page.locator('text=/takeaway/i').first();
  await expect(takeawayLabel).toBeVisible({ timeout: 5000 });

  await addFirstMenuItem(page);
  await clickKitchenButton(page);
  await page.waitForTimeout(2000);

  // Verify in tickets
  await navigateTo(page, '/pos/tickets');
  const takeawayTicketLabel = page.locator('text=/takeaway/i').first();
  await expect(takeawayTicketLabel).toBeVisible({ timeout: 10_000 });

  console.log('✅ 3.5 PASS — Takeaway order created successfully');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3.6  Delivery order creation
// ─────────────────────────────────────────────────────────────────────────────
test('3.6 Delivery order — created and visible in tickets', async ({ page }) => {
  await freshSession(page);
  await navigateTo(page, '/pos/order?type=dine-in');

  // ── STEP: Change order type to Delivery ─────────────────────────────────
  const deliveryBtn = page.locator('button', { hasText: 'Delivery' });
  if (await deliveryBtn.isVisible()) {
      await deliveryBtn.click();
  } else {
      // If there's an order type selector dropdown/menu
      const orderTypeSelect = page.locator('text=/Order Type/i').first();
      if(await orderTypeSelect.isVisible()) {
          await orderTypeSelect.click();
          await page.locator('text=Delivery').click();
      }
  }

  await addFirstMenuItem(page);
  await clickKitchenButton(page);
  await page.waitForTimeout(2000);

  await navigateTo(page, '/pos/tickets');
  const deliveryTicketLabel = page.locator('text=/delivery/i').first();
  await expect(deliveryTicketLabel).toBeVisible({ timeout: 10_000 });

  console.log('✅ 3.6 PASS — Delivery order created successfully');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3.7  Active Orders Strip on Home Dashboard
// ─────────────────────────────────────────────────────────────────────────────
test('3.7 Active orders strip — order appears on home dashboard', async ({ page }) => {
  await freshSession(page);
  
  // Create order
  await navigateTo(page, '/pos/order?type=takeaway');
  await addFirstMenuItem(page);
  await clickKitchenButton(page);
  await expectToast(page, /Order #/);

  // Go home
  await navigateTo(page, '/pos/home');

  // Verify it appears in active orders strip
  const activeOrderChip = page.locator('.active-order-chip').first();
  await expect(activeOrderChip).toBeVisible({ timeout: 10_000 });

  console.log('✅ 3.7 PASS — Order appears in active orders strip on home');
});
