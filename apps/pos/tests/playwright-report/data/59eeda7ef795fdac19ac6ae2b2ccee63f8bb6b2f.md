# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> 1.5 Logout — Sign Out clears pos_session and redirects to /login
- Location: tests\e2e\auth.spec.ts:196:5

# Error details

```
Error: page.reload: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - waiting for navigation until "load"

```

# Test source

```ts
  93  |   await page.evaluate(
  94  |     ({ k, v }) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)),
  95  |     { k: key, v: value }
  96  |   );
  97  | }
  98  | 
  99  | // ─── Login Helpers ────────────────────────────────────────────────────────────
  100 | 
  101 | /**
  102 |  * On the /login page, iterates through role cards to find a staff member
  103 |  * by name, then clicks that staff card.
  104 |  */
  105 | export async function selectStaff(page: Page, staffName: string) {
  106 |   const roleCards = page.locator('.role-card');
  107 |   await expect(roleCards.first()).toBeVisible({ timeout: 10_000 });
  108 |   const roleCount = await roleCards.count();
  109 | 
  110 |   for (let i = 0; i < roleCount; i++) {
  111 |     await roleCards.nth(i).click({ force: true });
  112 |     // Wait for the animation / fetch
  113 |     await page.waitForTimeout(1000);
  114 |     
  115 |     const staffCard = page.locator('.role-card', { hasText: staffName });
  116 |     if (await staffCard.isVisible({ timeout: 3000 }).catch(() => false)) {
  117 |       await staffCard.click();
  118 |       return;
  119 |     }
  120 |     const changeRoleBtn = page.locator('button', { hasText: 'Change Role' });
  121 |     if (await changeRoleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
  122 |       await changeRoleBtn.click({ force: true });
  123 |       await page.waitForTimeout(500);
  124 |     }
  125 |   }
  126 |   throw new Error(`Staff member "${staffName}" not found on any role page.`);
  127 | }
  128 | 
  129 | /**
  130 |  * Types each digit of the PIN by clicking numpad digit buttons.
  131 |  */
  132 | export async function enterPin(page: Page, pin: string) {
  133 |   for (const digit of pin.split('')) {
  134 |     const btn = page.locator(`button:text-is("${digit}")`).first();
  135 |     await btn.waitFor({ state: 'visible', timeout: 5000 });
  136 |     await btn.click();
  137 |     await page.waitForTimeout(100);
  138 |   }
  139 | }
  140 | 
  141 | /**
  142 |  * Full login flow: navigate to /login, select staff, enter PIN.
  143 |  * Waits until redirected away from /login.
  144 |  */
  145 | export async function loginAs(page: Page, staffName: string, pin: string) {
  146 |   await page.addInitScript(() => {
  147 |     Object.defineProperty(navigator, 'usb', {
  148 |       value: {
  149 |         requestDevice: async () => { throw new Error('Simulated NotAllowedError'); },
  150 |         getDevices: async () => [],
  151 |         addEventListener: () => {},
  152 |         removeEventListener: () => {}
  153 |       },
  154 |       writable: true
  155 |     });
  156 |   });
  157 |   await page.goto('/login');
  158 |   await page.waitForTimeout(800);
  159 |   await selectStaff(page, staffName);
  160 |   await enterPin(page, pin);
  161 |   await page.waitForURL(/\/(pos|shift)/, { timeout: 15_000 });
  162 | }
  163 | 
  164 | /**
  165 |  * Open a shift from the /pos/shift/open page using a shortcut or custom amount.
  166 |  */
  167 | export async function openShift(page: Page, floatAmount = '5000') {
  168 |   await page.waitForURL(/shift\/open/, { timeout: 10_000 });
  169 | 
  170 |   const shortcutMap: Record<string, string> = {
  171 |     '2000': 'PKR 2,000',
  172 |     '5000': 'PKR 5,000',
  173 |     '10000': 'PKR 10,000',
  174 |   };
  175 | 
  176 |   const shortcutLabel = shortcutMap[floatAmount];
  177 |   if (shortcutLabel) {
  178 |     await page.locator('button', { hasText: shortcutLabel }).click();
  179 |   } else {
  180 |     await page.locator('input[type="number"]').first().fill(floatAmount);
  181 |   }
  182 | 
  183 |   await page.locator('button', { hasText: /start shift/i }).click();
  184 |   await page.waitForURL('**/pos/home**', { timeout: 20_000 });
  185 | }
  186 | 
  187 | /**
  188 |  * Full session setup: clear storage → login → open shift → arrive at /pos/home.
  189 |  */
  190 | export async function freshSession(page: Page) {
  191 |   await page.goto('/login');
  192 |   await clearPosStorage(page);
> 193 |   await page.reload();
      |              ^ Error: page.reload: net::ERR_ABORTED; maybe frame was detached?
  194 |   await page.waitForTimeout(500);
  195 | 
  196 |   await loginAs(page, TEST_STAFF.name, TEST_STAFF.pin);
  197 | 
  198 |   await page.waitForURL(/\/(pos\/home|pos\/shift\/open)/, { timeout: 10_000 });
  199 |   if (page.url().includes('/shift/open')) {
  200 |     await openShift(page);
  201 |   }
  202 |   await page.waitForURL('**/pos/home**', { timeout: 20_000 });
  203 | }
  204 | 
  205 | // ─── Avatar / Top Bar Helpers ────────────────────────────────────────────────
  206 | 
  207 | /**
  208 |  * Opens the avatar dropdown in the top bar.
  209 |  */
  210 | export async function openAvatarMenu(page: Page) {
  211 |   const avatarBtn = page.locator('header button[title]').last();
  212 |   await avatarBtn.waitFor({ state: 'visible', timeout: 5000 });
  213 |   await avatarBtn.click();
  214 |   await page.waitForTimeout(400);
  215 | }
  216 | 
  217 | // ─── Order Flow Helpers ───────────────────────────────────────────────────────
  218 | 
  219 | /**
  220 |  * Handles the variation picker modal if it appears after clicking a menu item.
  221 |  */
  222 | export async function handleVariationPicker(page: Page) {
  223 |   const confirmVariant = page
  224 |     .locator('button', { hasText: /add to order|add to cart|confirm|select/i })
  225 |     .first();
  226 |   if (await confirmVariant.isVisible({ timeout: 1500 }).catch(() => false)) {
  227 |     const variantOption = page
  228 |       .locator('text="Choose Size"')
  229 |       .locator('..')
  230 |       .locator('label')
  231 |       .first();
  232 |     if (await variantOption.isVisible({ timeout: 500 }).catch(() => false)) {
  233 |       await variantOption.click();
  234 |     }
  235 |     await confirmVariant.click();
  236 |     await page.waitForTimeout(500);
  237 |   }
  238 | }
  239 | 
  240 | /**
  241 |  * Clicks the first available (non-sold-out) menu item card and handles variation picker.
  242 |  */
  243 | export async function addFirstMenuItem(page: Page) {
  244 |   await page.waitForSelector('[data-testid="menu-item"]', { timeout: 15_000 });
  245 |   const availableItem = page
  246 |     .locator('[data-testid="menu-item"]')
  247 |     .filter({ hasNot: page.locator('text=SOLD OUT') })
  248 |     .first();
  249 |   await availableItem.waitFor({ state: 'visible', timeout: 10_000 });
  250 |   await availableItem.click();
  251 |   await handleVariationPicker(page);
  252 | }
  253 | 
  254 | /**
  255 |  * Clicks the Nth available menu item. Defaults to index 0 (first item).
  256 |  */
  257 | export async function addNthMenuItem(page: Page, nth = 0) {
  258 |   await page.waitForSelector('[data-testid="menu-item"]', { timeout: 15_000 });
  259 |   const item = page
  260 |     .locator('[data-testid="menu-item"]')
  261 |     .filter({ hasNot: page.locator('text=SOLD OUT') })
  262 |     .nth(nth);
  263 |   await item.waitFor({ state: 'visible', timeout: 10_000 });
  264 |   await item.click();
  265 |   await handleVariationPicker(page);
  266 | }
  267 | 
  268 | /**
  269 |  * Clicks KITCHEN button in the cart sidebar.
  270 |  */
  271 | export async function clickKitchenButton(page: Page) {
  272 |   const kitchenBtn = page.locator('button', { hasText: /KITCHEN|RE-SEND/i }).first();
  273 |   await kitchenBtn.waitFor({ state: 'visible', timeout: 10_000 });
  274 |   await kitchenBtn.click();
  275 | }
  276 | 
  277 | /**
  278 |  * Clicks CHARGE button in the cart sidebar.
  279 |  */
  280 | export async function clickChargeButton(page: Page) {
  281 |   const chargeBtn = page.locator('button', { hasText: 'CHARGE' }).first();
  282 |   await chargeBtn.waitFor({ state: 'visible', timeout: 10_000 });
  283 |   await chargeBtn.click();
  284 | }
  285 | 
  286 | /**
  287 |  * Clicks the first free (green) table on the table map.
  288 |  */
  289 | export async function clickFreeTable(page: Page) {
  290 |   await page.waitForTimeout(2000);
  291 |   await page.waitForSelector('[data-testid="table-node"]', { timeout: 15_000 });
  292 |   const freeTable = page
  293 |     .locator('[data-testid="table-node"][data-table-status="free"]')
```