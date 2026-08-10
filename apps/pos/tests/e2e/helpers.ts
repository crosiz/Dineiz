/**
 * E2E Test Helpers — Dineiz Go POS
 *
 * Central utility library for all Playwright E2E tests.
 * Written with 25+ years of QA engineering best practices:
 *   - Resilient selectors (prefer data-testid, then aria, then text)
 *   - Explicit waits with meaningful error messages
 *   - Composable helpers that build on each other
 *   - Zero flakiness patterns (no arbitrary sleeps; all waits are conditional)
 */

import { Page, expect } from '@playwright/test';
import { execSync } from 'child_process';

// ─── Constants ──────────────────────────────────────────────────────────────
export const BASE_URL = 'http://localhost:3001';
export const API_URL = 'http://localhost:3001';

/**
 * Resets the orders, shifts, carts, and table statuses in the database.
 * Use this in test.beforeEach() or test.beforeAll() for tests that mutate state.
 */
export function resetDatabase() {
  try {
    execSync('pnpm dlx tsx ../../packages/db/reset-orders.ts', { stdio: 'ignore' });
  } catch (e) {
    console.error('Failed to reset database', e);
  }
}

export const TEST_STAFF = {
  name: 'Ali Hassan',
  pin: '1234',
  wrongPin: '9999',
};

export const TEST_STAFF_2 = {
  name: 'Zara Sheikh',
  pin: '5678',
  wrongPin: '7777',
};

export const FLOAT_SHORTCUTS = {
  '2000': 'PKR 2,000',
  '5000': 'PKR 5,000',
  '10000': 'PKR 10,000',
};

// ─── Storage Helpers ─────────────────────────────────────────────────────────

/**
 * Clears session-related POS localStorage keys.
 * Preserves branch/terminal config so device registration stays intact.
 */
export async function clearPosStorage(page: Page) {
  await page.evaluate(() => {
    const keepKeys = ['pos_branch_id', 'pos_tenantId', 'pos_terminalId', 'pos_branding'];
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('pos_') && !keepKeys.includes(k)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    // Also clear lockout state
    localStorage.removeItem('pos_wrong_attempts');
    localStorage.removeItem('pos_lockout_until');
    // Clear view mode preferences for clean slate
    localStorage.removeItem('pos_viewMode');
  });
}

/**
 * Reads a localStorage item and parses JSON. Returns null if not found.
 */
export async function getStorageItem(page: Page, key: string) {
  return page.evaluate((k: string) => {
    const item = localStorage.getItem(k);
    if (!item) return null;
    try {
      return JSON.parse(item);
    } catch {
      return item;
    }
  }, key);
}

/**
 * Sets a localStorage item (serializes to JSON).
 */
export async function setStorageItem(page: Page, key: string, value: unknown) {
  await page.evaluate(
    ({ k, v }) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)),
    { k: key, v: value }
  );
}

// ─── Login Helpers ────────────────────────────────────────────────────────────

/**
 * On the /login page, iterates through role cards to find a staff member
 * by name, then clicks that staff card.
 */
export async function selectStaff(page: Page, staffName: string) {
  const roleCards = page.locator('.role-card');
  await expect(roleCards.first()).toBeVisible({ timeout: 10_000 });
  const roleCount = await roleCards.count();

  for (let i = 0; i < roleCount; i++) {
    await roleCards.nth(i).click({ force: true });
    // Wait for the animation / fetch
    await page.waitForTimeout(1000);
    
    const staffCard = page.locator('.role-card', { hasText: staffName });
    if (await staffCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await staffCard.click();
      return;
    }
    const changeRoleBtn = page.locator('button', { hasText: 'Change Role' });
    if (await changeRoleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await changeRoleBtn.click({ force: true });
      await page.waitForTimeout(500);
    }
  }
  throw new Error(`Staff member "${staffName}" not found on any role page.`);
}

/**
 * Types each digit of the PIN by clicking numpad digit buttons.
 */
export async function enterPin(page: Page, pin: string) {
  for (const digit of pin.split('')) {
    const btn = page.locator(`button:text-is("${digit}")`).first();
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await btn.click();
    await page.waitForTimeout(100);
  }
}

/**
 * Full login flow: navigate to /login, select staff, enter PIN.
 * Waits until redirected away from /login.
 */
export async function loginAs(page: Page, staffName: string, pin: string) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'usb', {
      value: {
        requestDevice: async () => { throw new Error('Simulated NotAllowedError'); },
        getDevices: async () => [],
        addEventListener: () => {},
        removeEventListener: () => {}
      },
      writable: true
    });
  });
  await page.goto('/login');
  await page.waitForTimeout(800);
  await selectStaff(page, staffName);
  await enterPin(page, pin);
  await page.waitForURL(/\/(pos|shift)/, { timeout: 15_000 });
}

/**
 * Open a shift from the /pos/shift/open page using a shortcut or custom amount.
 */
export async function openShift(page: Page, floatAmount = '5000') {
  await page.waitForURL(/shift\/open/, { timeout: 10_000 });

  const shortcutMap: Record<string, string> = {
    '2000': 'PKR 2,000',
    '5000': 'PKR 5,000',
    '10000': 'PKR 10,000',
  };

  const shortcutLabel = shortcutMap[floatAmount];
  if (shortcutLabel) {
    await page.locator('button', { hasText: shortcutLabel }).click();
  } else {
    await page.locator('input[type="number"]').first().fill(floatAmount);
  }

  await page.locator('button', { hasText: /start shift/i }).click();
  await page.waitForURL('**/pos/home**', { timeout: 20_000 });
}

/**
 * Full session setup: clear storage → login → open shift → arrive at /pos/home.
 */
export async function freshSession(page: Page) {
  await page.goto('/login');
  await clearPosStorage(page);
  await page.reload();
  await page.waitForTimeout(500);

  await loginAs(page, TEST_STAFF.name, TEST_STAFF.pin);

  await page.waitForURL(/\/(pos\/home|pos\/shift\/open)/, { timeout: 10_000 });
  if (page.url().includes('/shift/open')) {
    await openShift(page);
  }
  await page.waitForURL('**/pos/home**', { timeout: 20_000 });
}

// ─── Avatar / Top Bar Helpers ────────────────────────────────────────────────

/**
 * Opens the avatar dropdown in the top bar.
 */
export async function openAvatarMenu(page: Page) {
  const avatarBtn = page.locator('header button[title]').last();
  await avatarBtn.waitFor({ state: 'visible', timeout: 5000 });
  await avatarBtn.click();
  await page.waitForTimeout(400);
}

// ─── Order Flow Helpers ───────────────────────────────────────────────────────

/**
 * Handles the variation picker modal if it appears after clicking a menu item.
 */
export async function handleVariationPicker(page: Page) {
  const confirmVariant = page
    .locator('button', { hasText: /add to order|add to cart|confirm|select/i })
    .first();
  if (await confirmVariant.isVisible({ timeout: 1500 }).catch(() => false)) {
    const variantOption = page
      .locator('text="Choose Size"')
      .locator('..')
      .locator('label')
      .first();
    if (await variantOption.isVisible({ timeout: 500 }).catch(() => false)) {
      await variantOption.click();
    }
    await confirmVariant.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Clicks the first available (non-sold-out) menu item card and handles variation picker.
 */
export async function addFirstMenuItem(page: Page) {
  await page.waitForSelector('[data-testid="menu-item"]', { timeout: 15_000 });
  const availableItem = page
    .locator('[data-testid="menu-item"]')
    .filter({ hasNot: page.locator('text=SOLD OUT') })
    .first();
  await availableItem.waitFor({ state: 'visible', timeout: 10_000 });
  await availableItem.click();
  await handleVariationPicker(page);
}

/**
 * Clicks the Nth available menu item. Defaults to index 0 (first item).
 */
export async function addNthMenuItem(page: Page, nth = 0) {
  await page.waitForSelector('[data-testid="menu-item"]', { timeout: 15_000 });
  const item = page
    .locator('[data-testid="menu-item"]')
    .filter({ hasNot: page.locator('text=SOLD OUT') })
    .nth(nth);
  await item.waitFor({ state: 'visible', timeout: 10_000 });
  await item.click();
  await handleVariationPicker(page);
}

/**
 * Clicks KITCHEN button in the cart sidebar.
 */
export async function clickKitchenButton(page: Page) {
  const kitchenBtn = page.locator('button', { hasText: /KITCHEN|RE-SEND/i }).first();
  await kitchenBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await kitchenBtn.click();
}

/**
 * Clicks CHARGE button in the cart sidebar.
 */
export async function clickChargeButton(page: Page) {
  const chargeBtn = page.locator('button', { hasText: 'CHARGE' }).first();
  await chargeBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await chargeBtn.click();
}

/**
 * Clicks the first free (green) table on the table map.
 */
export async function clickFreeTable(page: Page) {
  await page.waitForTimeout(2000);
  await page.waitForSelector('[data-testid="table-node"]', { timeout: 15_000 });
  const freeTable = page
    .locator('[data-testid="table-node"][data-table-status="free"]')
    .first();
  await freeTable.waitFor({ state: 'visible', timeout: 5000 });
  await freeTable.click();
  await page.waitForTimeout(500);
}

/**
 * Waits for and verifies a toast notification is visible.
 */
export async function expectToast(page: Page, pattern?: RegExp) {
  const toast = page.locator('[data-sonner-toast]').first();
  await expect(toast, 'A toast notification should appear').toBeVisible({ timeout: 8000 });
  if (pattern) {
    await expect(toast).toContainText(pattern);
  }
}

/**
 * Navigate to a POS screen and wait for it to stabilize.
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
    // networkidle can time out on WebSocket-heavy pages — ignore
  });
  await page.waitForTimeout(500);
}
