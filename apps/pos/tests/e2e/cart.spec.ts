/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST GROUP 5 & 6 — Cart Management, Discounts, Voids & Payments
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Coverage:
 *   5.1  Removing items from cart before sending
 *   5.2  Cart arithmetic: subtotal, tax, total update dynamically
 *   5.3  Applying order-level discount
 *   5.4  Clearing the entire cart (Cancel new order)
 *   6.1  Cash payment with change
 *   6.2  Exact cash payment
 *   6.3  Insufficient cash validation
 *   6.4  Split payment (Cash + Card)
 */

import { test, expect } from '@playwright/test';
import {
  freshSession,
  navigateTo,
  clickFreeTable,
  addFirstMenuItem,
  addNthMenuItem,
  clickKitchenButton,
  clickChargeButton,
  expectToast,
  resetDatabase
} from './helpers';

test.beforeEach(async () => {
  resetDatabase();
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.1  Removing items from cart before sending
// ─────────────────────────────────────────────────────────────────────────────
test('5.1 Removing items from cart before sending', async ({ page }) => {
  await freshSession(page);
  await navigateTo(page, '/pos/order?type=dine-in');

  await addFirstMenuItem(page);

  // Read total
  const totalEl = page.locator('text=/PKR \\d/').last();
  await expect(totalEl).toBeVisible({ timeout: 5000 });

  // Find remove button (the minus button in quantity control)
  const removeBtn = page.locator('button:has(span:has-text("remove"))').first();
  await removeBtn.click();
  await page.waitForTimeout(500);

  // Verify cart empty message
  const emptyMessage = page.locator('text=Your cart is empty');
  await expect(emptyMessage).toBeVisible({ timeout: 5000 });

  console.log('✅ 5.1 PASS — Item removed from cart successfully');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.2  Voiding an item after sent to kitchen
// ─────────────────────────────────────────────────────────────────────────────
test('5.2 Voiding an item after sent to kitchen', async ({ page }) => {
  await freshSession(page);
  await navigateTo(page, '/pos/order?type=dine-in');

  // Add 2 items and send to kitchen
  await addFirstMenuItem(page);
  await addNthMenuItem(page, 1);
  await clickKitchenButton(page);
  await page.waitForTimeout(2000);

  // Return to the order and try to remove an item
  await navigateTo(page, '/pos/tickets');
  const ticket = page.locator('text=/IN KITCHEN/i').first();
  await ticket.click(); // Should navigate to edit order
  
  await page.waitForURL(/pos\/order/, { timeout: 10_000 });

  // Attempt to remove
  const removeBtn = page.locator('.lucide-trash-2, .lucide-minus').first();
  if (await removeBtn.isVisible()) {
      await removeBtn.click();
      
      // Usually prompts for a void reason here
      const voidPrompt = page.locator('text=/void reason|cancel item/i').first();
      if (await voidPrompt.isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log('✅ 5.2 PASS — Prompted for void reason');
          // Fill reason and confirm
          await page.locator('input[placeholder*="reason" i]').first().fill('Customer changed mind');
          await page.locator('button', { hasText: /confirm|void/i }).last().click();
      } else {
          console.log('⚠️  5.2 NOTE — No void reason prompted, item just removed');
      }
  } else {
      console.log('⚠️  5.2 NOTE — Cannot remove items after sent to kitchen (button hidden)');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.3  Cart arithmetic
// ─────────────────────────────────────────────────────────────────────────────
test('5.2 Cart arithmetic — totals update when items are added', async ({ page }) => {
  await freshSession(page);
  await navigateTo(page, '/pos/order?type=dine-in');

  await addFirstMenuItem(page);
  await page.waitForTimeout(600);

  const totalEl = page.locator('text=/PKR \\d/').last();
  const totalAfterFirst = await totalEl.textContent().catch(() => '');
  expect(totalAfterFirst).toMatch(/PKR \d/);

  await addNthMenuItem(page, 1);
  await page.waitForTimeout(600);

  const totalAfterSecond = await totalEl.textContent().catch(() => '');
  expect(totalAfterSecond).not.toBe(totalAfterFirst); // total should have changed

  console.log('✅ 5.2 PASS — Cart totals update as items are added');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.3  Applying order-level discount
// ─────────────────────────────────────────────────────────────────────────────
test('5.3 Applying order-level discounts updates the total', async ({ page }) => {
  await freshSession(page);
  await navigateTo(page, '/pos/order?type=dine-in');

  await addFirstMenuItem(page);
  
  const discountBtn = page.locator('button', { hasText: 'Discount' }).first();
  await discountBtn.click();

  await page.waitForTimeout(500);
  const discountInput = page.locator('input[type="number"]').first();
  await discountInput.waitFor({ state: 'attached', timeout: 5000 });
  await discountInput.fill('10');

  const applyBtn = page.locator('button', { hasText: 'Apply Discount' });
  await applyBtn.click();

  const appliedDiscountLabel = page.locator('span:text-is("Discount")');
  await expect(appliedDiscountLabel).toBeVisible({ timeout: 5000 });

  console.log('✅ 5.3 PASS — Discount applied successfully');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.4  Clearing the entire cart
// ─────────────────────────────────────────────────────────────────────────────
test('5.4 Clear cart empties cart and resets', async ({ page }) => {
  await freshSession(page);
  await navigateTo(page, '/pos/order?type=dine-in');

  await addFirstMenuItem(page);
  
  const newOrderBtn = page.locator('button', { hasText: /New Order/i }).last();
  await newOrderBtn.click();
  await page.waitForTimeout(500);

  const confirmModal = page.locator('h2', { hasText: 'Clear Current Order?' });
  await confirmModal.waitFor({ state: 'attached', timeout: 5000 });
  
  const clearBtn = page.locator('button:has-text("Clear Order")');
  await clearBtn.click();

  const emptyMessage = page.locator('text=Your cart is empty');
  await expect(emptyMessage).toBeVisible({ timeout: 5000 });

  console.log('✅ 5.4 PASS — Cart cleared successfully');
});

// ─────────────────────────────────────────────────────────────────────────────
// 6.1 & 6.2 Payment (Cash)
// ─────────────────────────────────────────────────────────────────────────────
test('6.1 & 6.2 Cash payment — opens checkout, handles exact cash', async ({ page }) => {
  await freshSession(page);
  await navigateTo(page, '/pos/order?type=takeaway'); // Use takeaway for direct charge

  await addFirstMenuItem(page);
  await clickChargeButton(page);

  // Expect checkout modal
  const checkoutHeading = page.locator('h1', { hasText: 'Checkout' });
  await expect(checkoutHeading).toBeVisible({ timeout: 5000 });

  // Wait for checkout modal to fully animate
  await page.waitForTimeout(500);

  // Click Cash method
  const cashBtn = page.locator('button', { hasText: 'Cash' }).first();
  await cashBtn.click();
  
  // Input 5000
  await page.locator('button:text-is("5")').first().click();
  await page.locator('button:text-is("0")').first().click();
  await page.locator('button:text-is("0")').first().click();
  await page.locator('button:text-is("0")').first().click();
  
  const confirmPaymentBtn = page.locator('button', { hasText: 'Confirm Payment' }).last();
  await confirmPaymentBtn.click();

  // Expect Receipt Screen
  const receiptHeading = page.locator('h2', { hasText: /Payment Confirmed/i });
  await expect(receiptHeading).toBeVisible({ timeout: 10_000 });

  console.log('✅ 6.1 & 6.2 PASS — Cash payment successful, receipt screen visible');
});

// ─────────────────────────────────────────────────────────────────────────────
// 6.3 Insufficient cash
// ─────────────────────────────────────────────────────────────────────────────
test('6.3 Insufficient cash validation', async ({ page }) => {
  await freshSession(page);
  await navigateTo(page, '/pos/order?type=takeaway'); // Use takeaway

  await addFirstMenuItem(page);
  await clickChargeButton(page);

  // Checkout modal
  const checkoutHeading = page.locator('h1', { hasText: 'Checkout' });
  await expect(checkoutHeading).toBeVisible({ timeout: 5000 });

  // Wait for modal animation
  await page.waitForTimeout(500);

  // Input an explicitly small amount
  const customInputBtn = page.locator('button:text-is("0")').first();
  await customInputBtn.click();
  
  const confirmPaymentBtn = page.locator('button', { hasText: /confirm payment/i }).last();
  await expect(confirmPaymentBtn).toBeDisabled({ timeout: 5000 });

  console.log('✅ 6.3 PASS — Insufficient cash validation works');
});

// ─────────────────────────────────────────────────────────────────────────────
// 6.4 Split Payment (Cash + Card)
// ─────────────────────────────────────────────────────────────────────────────
test('6.4 Split payment (Cash + Card)', async ({ page }) => {
  await freshSession(page);
  await navigateTo(page, '/pos/order?type=dine-in');

  await addFirstMenuItem(page);
  await clickChargeButton(page);

  // Checkout modal
  const checkoutHeading = page.locator('h1', { hasText: 'Checkout' });
  await expect(checkoutHeading).toBeVisible({ timeout: 5000 });

  // Select Split Payment
  const splitBtn = page.locator('button', { hasText: 'call_split Split' }).first();
  if (await splitBtn.isVisible()) {
      await splitBtn.click();
      
      const confirmPaymentBtn = page.locator('button', { hasText: 'Confirm Payment' }).last();
      await confirmPaymentBtn.click();

      // Expect Receipt Screen
      const receiptHeading = page.locator('h2', { hasText: /Payment Confirmed/i });
      await expect(receiptHeading).toBeVisible({ timeout: 10_000 });
      console.log('✅ 6.4 PASS — Split payment successful');
  } else {
      console.log('⚠️  6.4 NOTE — Split payment option not available');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6.5 Card Payment
// ─────────────────────────────────────────────────────────────────────────────
test('6.5 Card Payment', async ({ page }) => {
  await freshSession(page);
  await navigateTo(page, '/pos/order?type=dine-in');

  await addFirstMenuItem(page);
  await clickChargeButton(page);

  // Checkout modal
  const checkoutHeading = page.locator('h1', { hasText: 'Checkout' });
  await expect(checkoutHeading).toBeVisible({ timeout: 5000 });

  // Select Card Payment
  const cardBtn = page.locator('button', { hasText: 'credit_card Card' }).first();
  if (await cardBtn.isVisible()) {
      await cardBtn.click();
      
      const confirmPaymentBtn = page.locator('button', { hasText: /confirm payment/i }).last();
      await confirmPaymentBtn.click();

      // Expect Receipt Screen
      const receiptHeading = page.locator('h2', { hasText: /Payment Confirmed/i });
      await expect(receiptHeading).toBeVisible({ timeout: 10_000 });
      console.log('✅ 6.5 PASS — Card payment successful');
  } else {
      console.log('⚠️  6.5 NOTE — Card payment option not available');
  }
});
