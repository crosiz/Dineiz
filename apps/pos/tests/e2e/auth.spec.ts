/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST GROUP 1 — Authentication & Session Management
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Coverage:
 *   1.1  Fresh POS login — correct PIN → session stored + redirect
 *   1.2  Wrong PIN lockout — 5 failures lock numpad, timer visible
 *   1.3  Lockout persists across F5 page refresh (localStorage)
 *   1.4  Session survives page refresh — stays on /pos/home
 *   1.5  Logout via Sign Out → session cleared, redirect to /login
 *   1.6  Protected route guard — /pos/home without session → /login
 *   1.7  Break mode — "Take Break" locks screen, shift stays active
 *   1.8  Second staff member can login on same device (staff switch)
 */

import { test, expect } from '@playwright/test';
import {
  clearPosStorage,
  getStorageItem,
  selectStaff,
  enterPin,
  loginAs,
  openShift,
  freshSession,
  openAvatarMenu,
  TEST_STAFF,
  TEST_STAFF_2,
  resetDatabase,
} from './helpers';

test.beforeEach(async () => {
  await resetDatabase();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1.1  Fresh POS login — correct PIN
// ─────────────────────────────────────────────────────────────────────────────
test('1.1 Fresh POS login — correct PIN redirects and saves pos_session', async ({ page }) => {
  // ── PRECONDITION: completely clean slate ──────────────────────────────────
  await page.goto('/');
  await clearPosStorage(page);
  await page.goto('/login');
  await page.waitForTimeout(500);

  // ── STEP: Verify role-selection screen renders ────────────────────────────
  const roleCards = page.locator('.role-card');
  await expect(roleCards.first()).toBeVisible({ timeout: 10_000 });

  // ── STEP: Select staff member and enter correct PIN ───────────────────────
  await selectStaff(page, TEST_STAFF.name);
  await enterPin(page, TEST_STAFF.pin);

  // ── EXPECT: Redirected away from /login (to /pos or /shift/open) ──────────
  await page.waitForURL(/\/(pos|shift)/, { timeout: 15_000 });
  expect(page.url()).not.toContain('/login');

  // ── EXPECT: pos_session in localStorage contains userId and role ──────────
  const session = await getStorageItem(page, 'pos_session');
  expect(session, 'pos_session must exist in localStorage after login').not.toBeNull();
  expect(session).toHaveProperty('userId');
  expect(session).toHaveProperty('role');
  expect(String(session.userId)).toBeTruthy();

  console.log(`✅ 1.1 PASS — Session created: userId=${session.userId}, role=${session.role}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 1.2  Wrong PIN — 5 failures trigger lockout with countdown
// ─────────────────────────────────────────────────────────────────────────────
test('1.2 Wrong PIN lockout — 5 failures lock numpad with countdown timer', async ({ page }) => {
  // ── PRECONDITION: clean lockout state ────────────────────────────────────
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('pos_wrong_attempts');
    localStorage.removeItem('pos_lockout_until');
  });
  await page.reload();
  await page.waitForTimeout(500);

  await selectStaff(page, TEST_STAFF_2.name);

  // ── STEP: Enter wrong PIN 4 times — must NOT lock yet ────────────────────
  for (let attempt = 1; attempt <= 4; attempt++) {
    await enterPin(page, TEST_STAFF_2.wrongPin);
    await page.waitForTimeout(700);
    const lockoutText = page.locator('text=/Locked out/i');
    const isLocked = await lockoutText.isVisible().catch(() => false);
    expect(isLocked, `Should NOT be locked after ${attempt} wrong attempts`).toBe(false);
  }

  // ── STEP: 5th wrong PIN → triggers lockout ───────────────────────────────
  await enterPin(page, TEST_STAFF_2.wrongPin);
  await page.waitForTimeout(1000);

  // ── EXPECT: "Locked out for Xs" countdown visible ────────────────────────
  await expect(
    page.locator('text=/Locked out for/i').first(),
    'Lockout countdown should appear after 5th wrong attempt'
  ).toBeVisible({ timeout: 5000 });

  // ── EXPECT: pos_lockout_until set with a future timestamp ─────────────────
  const lockoutUntil = await page.evaluate(() => localStorage.getItem('pos_lockout_until'));
  expect(lockoutUntil, 'pos_lockout_until must be saved in localStorage').not.toBeNull();
  const remaining = parseInt(lockoutUntil!) - Date.now();
  expect(remaining, 'Lockout should have >55s remaining').toBeGreaterThan(55_000);

  // ── EXPECT: Numpad digit buttons are disabled ─────────────────────────────
  await expect(
    page.locator('button:text-is("1")').first(),
    'Digit "1" button must be disabled during lockout'
  ).toBeDisabled();

  console.log('✅ 1.2 PASS — Lockout correctly triggered after 5 wrong attempts');
});

// ─────────────────────────────────────────────────────────────────────────────
// 1.3  Lockout persists across F5 page refresh
// ─────────────────────────────────────────────────────────────────────────────
test('1.3 Lockout persists — survives F5 page refresh via localStorage', async ({ page }) => {
  // ── PRECONDITION: trigger lockout state ──────────────────────────────────
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('pos_wrong_attempts');
    localStorage.removeItem('pos_lockout_until');
  });
  await page.reload();
  await page.waitForTimeout(500);

  await selectStaff(page, TEST_STAFF_2.name);

  for (let i = 0; i < 5; i++) {
    await enterPin(page, TEST_STAFF_2.wrongPin);
    await page.waitForTimeout(600);
  }

  // Verify lockout is active
  await expect(page.locator('text=/Locked out for/i').first()).toBeVisible({ timeout: 5000 });

  // ── STEP: Refresh the page ───────────────────────────────────────────────
  await page.reload();
  await page.waitForTimeout(1500);

  // ── STEP: Re-select staff (fresh mount, no staff pre-selected) ────────────
  await selectStaff(page, TEST_STAFF_2.name);

  // ── EXPECT: Lockout MUST still be active after refresh ───────────────────
  await expect(
    page.locator('text=/Locked out for/i').first(),
    '⚠️ Lockout MUST persist after F5 refresh (localStorage is the source of truth)'
  ).toBeVisible({ timeout: 8000 });

  const stillLocked = await page.evaluate(() => localStorage.getItem('pos_lockout_until'));
  expect(stillLocked, 'pos_lockout_until must still exist after refresh').not.toBeNull();

  console.log('✅ 1.3 PASS — Lockout persists across page refresh');
});

// ─────────────────────────────────────────────────────────────────────────────
// 1.4  Session survives page refresh
// ─────────────────────────────────────────────────────────────────────────────
test('1.4 Session survives F5 refresh — stays on /pos/home without re-login', async ({
  page,
}) => {
  // ── PRECONDITION: logged in with active shift ─────────────────────────────
  await freshSession(page);

  const sessionBefore = await getStorageItem(page, 'pos_session');
  const shiftBefore = await getStorageItem(page, 'pos_shift');
  expect(sessionBefore).not.toBeNull();
  expect(shiftBefore).not.toBeNull();

  // ── STEP: Reload the page ────────────────────────────────────────────────
  await page.reload();
  await page.waitForTimeout(2500);

  // ── EXPECT: Still on /pos/home ───────────────────────────────────────────
  await expect(page, 'After refresh, URL must remain on /pos/home').toHaveURL(
    /\/pos\/home/,
    { timeout: 10_000 }
  );

  // ── EXPECT: pos_session and pos_shift intact ──────────────────────────────
  const sessionAfter = await getStorageItem(page, 'pos_session');
  const shiftAfter = await getStorageItem(page, 'pos_shift');
  expect(sessionAfter, 'pos_session must survive page refresh').not.toBeNull();
  expect(shiftAfter, 'pos_shift must survive page refresh').not.toBeNull();
  expect(sessionAfter?.userId).toBe(sessionBefore?.userId);

  console.log('✅ 1.4 PASS — Session and shift survived refresh');
});

// ─────────────────────────────────────────────────────────────────────────────
// 1.5  Logout — Sign Out clears session and redirects to /login
// ─────────────────────────────────────────────────────────────────────────────
test('1.5 Logout — Sign Out clears pos_session and redirects to /login', async ({ page }) => {
  // ── PRECONDITION: logged in with active shift ─────────────────────────────
  await freshSession(page);

  // ── STEP: Open avatar dropdown ───────────────────────────────────────────
  const avatarBtn = page.locator('header button[title]').last();
  await avatarBtn.click();
  await page.waitForTimeout(400);

  // ── STEP: Click "Sign Out" in dropdown ───────────────────────────────────
  await page.locator('button', { hasText: 'Sign Out' }).click();
  await page.waitForTimeout(500);

  // ── STEP: Confirm in the modal that appears ───────────────────────────────
  const confirmSignOutBtn = page.locator('button', { hasText: 'Sign Out' }).last();
  await confirmSignOutBtn.waitFor({ state: 'visible', timeout: 5000 });
  await confirmSignOutBtn.click();

  // ── EXPECT: Redirected to /login ──────────────────────────────────────────
  await page.waitForURL(/\/login/, { timeout: 10_000 });

  // ── EXPECT: pos_session cleared ──────────────────────────────────────────
  const sessionAfterLogout = await page.evaluate(
    () => localStorage.getItem('pos_session')
  );
  expect(sessionAfterLogout, 'pos_session must be null after logout').toBeNull();

  console.log('✅ 1.5 PASS — Logout cleared session and redirected to /login');
});

// ─────────────────────────────────────────────────────────────────────────────
// 1.6  Protected route guard — /pos/home without session → /login
// ─────────────────────────────────────────────────────────────────────────────
test('1.6 Route guard — /pos/home without session redirects to /login', async ({ page }) => {
  // ── PRECONDITION: no session in localStorage ──────────────────────────────
  await page.goto('/login');
  await clearPosStorage(page);

  // ── STEP: Navigate directly to protected route ────────────────────────────
  await page.goto('/pos/home');
  await page.waitForTimeout(2000);

  // ── EXPECT: Redirected to /login ──────────────────────────────────────────
  expect(page.url()).toContain('/login');

  console.log('✅ 1.6 PASS — Route guard redirects unauthenticated users to /login');
});

// ─────────────────────────────────────────────────────────────────────────────
// 1.7  Break mode — "Take Break" locks screen, shift stays active
// ─────────────────────────────────────────────────────────────────────────────
test('1.7 Take Break — locks screen and redirects to /login with reason=break', async ({
  page,
}) => {
  // ── PRECONDITION: logged in on /pos/home ─────────────────────────────────
  await freshSession(page);

  // ── STEP: Click "Take a Break" from POS avatar menu ──────────────────────
  const avatarMenu = page.getByTestId('avatar-menu');
  await expect(avatarMenu, 'Avatar menu must be visible').toBeVisible({ timeout: 5000 });
  await avatarMenu.click();
  
  const takeBreakBtn = page.locator('button', { hasText: 'Take a Break' }).first();
  await expect(takeBreakBtn, '"Take a Break" button must be in dropdown').toBeVisible({
    timeout: 5000,
  });
  await takeBreakBtn.click();

  // ── EXPECT: Confirmation modal appears ────────────────────────────────────
  const breakModal = page.locator('h2', { hasText: /Take a Break\??/i });
  await expect(breakModal, '"Take a Break?" modal must appear').toBeVisible({ timeout: 5000 });

  // ── STEP: Confirm break by clicking "Lock Screen" ─────────────────────────
  await page.locator('button', { hasText: 'Lock Screen' }).click();

  // ── EXPECT: Redirected to /login?reason=break ────────────────────────────
  await page.waitForURL(/login.*reason=break/, { timeout: 10_000 });
  expect(page.url()).toContain('reason=break');

  // ── EXPECT: pos_session still exists (shift is NOT cleared on break) ──────
  const session = await getStorageItem(page, 'pos_session');
  expect(session, 'pos_session must persist during break — shift stays active').not.toBeNull();

  const shift = await getStorageItem(page, 'pos_shift');
  expect(shift, 'pos_shift must persist during break').not.toBeNull();

  console.log('✅ 1.7 PASS — Take Break locks screen without clearing shift');
});

// ─────────────────────────────────────────────────────────────────────────────
// 1.8  Wrong PIN — incorrect PIN shows error feedback (not locked)
// ─────────────────────────────────────────────────────────────────────────────
test('1.8 Wrong PIN — single wrong attempt shows error, does not lock', async ({ page }) => {
  // ── PRECONDITION: clean slate ─────────────────────────────────────────────
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('pos_wrong_attempts');
    localStorage.removeItem('pos_lockout_until');
  });
  await page.reload();
  await page.waitForTimeout(500);

  await selectStaff(page, TEST_STAFF.name);

  // ── STEP: Enter single wrong PIN ──────────────────────────────────────────
  await enterPin(page, TEST_STAFF.wrongPin);
  await page.waitForTimeout(800);

  // ── EXPECT: Still on /login (not redirected) ──────────────────────────────
  expect(page.url()).toContain('/login');

  // ── EXPECT: Numpad still enabled ─────────────────────────────────────────
  await expect(
    page.locator('button:text-is("1")').first(),
    'Digit buttons must remain enabled after 1 wrong attempt'
  ).toBeEnabled();

  // ── EXPECT: No "Locked out" message ─────────────────────────────────────
  const lockoutText = page.locator('text=/Locked out/i');
  expect(await lockoutText.isVisible().catch(() => false)).toBe(false);

  console.log('✅ 1.8 PASS — Single wrong PIN does not lock account');
});
