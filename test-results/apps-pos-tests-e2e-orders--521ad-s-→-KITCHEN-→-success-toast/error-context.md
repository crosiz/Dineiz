# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps\pos\tests\e2e\orders.spec.ts >> 3.1 Dine-in order — table → items → KITCHEN → success toast
- Location: apps\pos\tests\e2e\orders.spec.ts:98:5

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/login", waiting until "load"

```

# Test source

```ts
  29  |     }
  30  |     keys.forEach((k) => localStorage.removeItem(k));
  31  |   });
  32  | }
  33  | 
  34  | /** Reads a localStorage item and parses JSON. Returns null if not found. */
  35  | export async function getStorageItem(page: Page, key: string) {
  36  |   return page.evaluate((k: string) => {
  37  |     const item = localStorage.getItem(k);
  38  |     if (!item) return null;
  39  |     try { return JSON.parse(item); } catch { return item; }
  40  |   }, key);
  41  | }
  42  | 
  43  | // ─── Login Helpers ────────────────────────────────────────────────────────────
  44  | 
  45  | /**
  46  |  * On the /login page, click each role card until we find a staff member
  47  |  * whose name matches staffName, then click that staff card.
  48  |  */
  49  | export async function selectStaff(page: Page, staffName: string) {
  50  |   // Step 1: collect all role-card buttons visible at start (role selection)
  51  |   const roleCards = page.locator('.role-card');
  52  |   await expect(roleCards.first()).toBeVisible({ timeout: 10_000 });
  53  |   const roleCount = await roleCards.count();
  54  | 
  55  |   for (let i = 0; i < roleCount; i++) {
  56  |     await roleCards.nth(i).click({ force: true });
  57  |     // Step 2: look for staff card with matching name
  58  |     const staffCard = page.locator('.role-card', { hasText: staffName });
  59  |     if (await staffCard.isVisible({ timeout: 1500 }).catch(() => false)) {
  60  |       await staffCard.click();
  61  |       return;
  62  |     }
  63  |     // Not found → go back to role selection
  64  |     const changeRoleBtn = page.locator('button', { hasText: 'Change Role' });
  65  |     if (await changeRoleBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
  66  |       await changeRoleBtn.click({ force: true });
  67  |       await page.waitForTimeout(300);
  68  |     }
  69  |   }
  70  |   throw new Error(`Staff member "${staffName}" not found on any role page.`);
  71  | }
  72  | 
  73  | /**
  74  |  * Type each digit of the PIN by clicking the numpad digit buttons.
  75  |  * The numpad buttons have text content exactly "0"–"9".
  76  |  */
  77  | export async function enterPin(page: Page, pin: string) {
  78  |   for (const digit of pin.split('')) {
  79  |     // Use CSS selector that matches a button whose only text content is the digit
  80  |     const btn = page.locator(`button:text-is("${digit}")`).first();
  81  |     await btn.waitFor({ state: 'visible', timeout: 5000 });
  82  |     await btn.click();
  83  |     await page.waitForTimeout(100);
  84  |   }
  85  | }
  86  | 
  87  | /**
  88  |  * Full login: navigate to /login, clear lockout state, select staff, enter PIN.
  89  |  * Waits until redirected away from /login.
  90  |  */
  91  | export async function loginAs(page: Page, staffName: string, pin: string) {
  92  |   await page.goto('/login');
  93  |   await page.waitForTimeout(800);
  94  |   await selectStaff(page, staffName);
  95  |   await enterPin(page, pin);
  96  |   // Wait for redirect to /pos or /shift
  97  |   await page.waitForURL(/\/(pos|shift)/, { timeout: 15_000 });
  98  | }
  99  | 
  100 | /**
  101 |  * Open a shift from the /pos/shift/open page.
  102 |  * Clicks a float shortcut (default 5000) then submits.
  103 |  */
  104 | export async function openShift(page: Page, floatAmount = '5000') {
  105 |   await page.waitForURL(/shift\/open/, { timeout: 10_000 });
  106 | 
  107 |   const shortcutMap: Record<string, string> = {
  108 |     '2000': 'PKR 2,000',
  109 |     '5000': 'PKR 5,000',
  110 |     '10000': 'PKR 10,000',
  111 |   };
  112 | 
  113 |   const shortcutLabel = shortcutMap[floatAmount];
  114 |   if (shortcutLabel) {
  115 |     await page.locator('button', { hasText: shortcutLabel }).click();
  116 |   } else {
  117 |     await page.locator('input[type="number"]').fill(floatAmount);
  118 |   }
  119 | 
  120 |   await page.locator('button', { hasText: /start shift/i }).click();
  121 |   await page.waitForURL('**/pos/home**', { timeout: 20_000 });
  122 | }
  123 | 
  124 | /**
  125 |  * Full setup: clear storage, login as test staff, open shift.
  126 |  * Leaves you on /pos/home ready to test.
  127 |  */
  128 | export async function freshSession(page: Page) {
> 129 |   await page.goto('/login');
      |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  130 |   await clearPosStorage(page);
  131 |   await page.reload();
  132 |   await page.waitForTimeout(500);
  133 | 
  134 |   await loginAs(page, TEST_STAFF.name, TEST_STAFF.pin);
  135 | 
  136 |   await page.waitForURL(/\/(pos\/home|pos\/shift\/open)/, { timeout: 10_000 });
  137 |   if (page.url().includes('/shift/open')) {
  138 |     await openShift(page);
  139 |   }
  140 |   await page.waitForURL('**/pos/home**', { timeout: 20_000 });
  141 | }
  142 | 
  143 | /**
  144 |  * Open the avatar dropdown in the top bar.
  145 |  * The avatar is a round button with a single letter initial.
  146 |  */
  147 | export async function openAvatarMenu(page: Page) {
  148 |   // The avatar button is in the header — it has title=cashierName and style background=avatarColor
  149 |   // It is the only round button in the top-right area
  150 |   const avatarBtn = page.locator('header button[title]').last();
  151 |   await avatarBtn.waitFor({ state: 'visible', timeout: 5000 });
  152 |   await avatarBtn.click();
  153 |   // Wait for dropdown to appear
  154 |   await page.waitForTimeout(400);
  155 | }
  156 | 
```