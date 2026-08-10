# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> 1.3 Lockout persists — survives F5 page refresh via localStorage
- Location: tests\e2e\auth.spec.ts:120:5

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('button:text-is("7")').first()
    - locator resolved to <button disabled class="flex items-center justify-center h-[56px] w-[72px] mx-auto bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] hover:bg-[#E2E8F0] active:scale-95 transition-all disabled:opacity-50 text-xl font-bold text-[#0F172A] shadow-sm">7</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not stable
    - retrying click action
      - waiting 100ms
    18 × waiting for element to be visible, enabled and stable
       - element is not enabled
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - region "Notifications alt+T"
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e6]:
          - img "Dineiz"
        - paragraph [ref=e7]: Restaurant Intelligence Platform
      - generic [ref=e8]:
        - generic [ref=e9]: 16:09
        - paragraph [ref=e10]: Good afternoon, Zara
      - generic [ref=e12]:
        - generic [ref=e13]:
          - heading "Clifton Branch edit Terminal Linked" [level=2] [ref=e14] [cursor=pointer]:
            - generic [ref=e15]:
              - text: Clifton Branch
              - generic [ref=e16]: edit
            - generic [ref=e17]: Terminal Linked
          - generic [ref=e20]: Shift Active
        - generic [ref=e21]:
          - paragraph [ref=e22]: v4.83.0
          - paragraph [ref=e23]: "Terminal ID: TB-04"
    - generic [ref=e24]:
      - generic:
        - generic:
          - heading "Select your role" [level=3]
          - paragraph: Identify yourself to begin the shift
        - generic:
          - button "delivery_dining Rider chevron_right":
            - generic:
              - generic: delivery_dining
              - generic: Rider
            - generic: chevron_right
          - button "payments Cashier chevron_right":
            - generic:
              - generic: payments
              - generic: Cashier
            - generic: chevron_right
          - button "manage_accounts Branch Manager chevron_right":
            - generic:
              - generic: manage_accounts
              - generic: Branch Manager
            - generic: chevron_right
          - button "outdoor_grill Kitchen Staff chevron_right":
            - generic:
              - generic: outdoor_grill
              - generic: Kitchen Staff
            - generic: chevron_right
          - button "restaurant Waiter chevron_right":
            - generic:
              - generic: restaurant
              - generic: Waiter
            - generic: chevron_right
      - generic:
        - generic:
          - button "arrow_back Change Role":
            - generic: arrow_back
            - generic: Change Role
          - generic:
            - heading "Select User" [level=3]
            - paragraph: Choose your profile
        - generic:
          - button "A Ali Hassan chevron_right":
            - generic:
              - generic: A
              - generic: Ali Hassan
            - generic:
              - generic: chevron_right
          - button "K Khalid Mehmood chevron_right":
            - generic:
              - generic: K
              - generic: Khalid Mehmood
            - generic:
              - generic: chevron_right
          - button "T Test Cashier - 1784652000353 chevron_right":
            - generic:
              - generic: T
              - generic: Test Cashier - 1784652000353
            - generic:
              - generic: chevron_right
          - button "T Test Cashier - 1784652496154 chevron_right":
            - generic:
              - generic: T
              - generic: Test Cashier - 1784652496154
            - generic:
              - generic: chevron_right
          - button "T Test Cashier - 1784653090676 chevron_right":
            - generic:
              - generic: T
              - generic: Test Cashier - 1784653090676
            - generic:
              - generic: chevron_right
          - button "T Test Cashier - 1784660371153 chevron_right":
            - generic:
              - generic: T
              - generic: Test Cashier - 1784660371153
            - generic:
              - generic: chevron_right
          - button "T Test Cashier - 1784661716328 chevron_right":
            - generic:
              - generic: T
              - generic: Test Cashier - 1784661716328
            - generic:
              - generic: chevron_right
          - button "Z Zara Sheikh chevron_right":
            - generic:
              - generic: Z
              - generic: Zara Sheikh
            - generic:
              - generic: chevron_right
          - button "M munawar chevron_right":
            - generic:
              - generic: M
              - generic: munawar
            - generic:
              - generic: chevron_right
      - generic [ref=e25]:
        - generic [ref=e26]:
          - button "arrow_back Change User" [disabled] [ref=e27]:
            - generic [ref=e28]: arrow_back
            - generic [ref=e29]: Change User
          - generic [ref=e30]:
            - generic [ref=e31]: Z
            - heading "Zara Sheikh" [level=3] [ref=e32]
            - paragraph [ref=e33]:
              - generic [ref=e34]: Locked out for 29s
        - generic [ref=e40]:
          - button "1" [disabled] [ref=e41]
          - button "2" [disabled] [ref=e42]
          - button "3" [disabled] [ref=e43]
          - button "4" [disabled] [ref=e44]
          - button "5" [disabled] [ref=e45]
          - button "6" [disabled] [ref=e46]
          - button "7" [disabled] [ref=e47]
          - button "8" [disabled] [ref=e48]
          - button "9" [disabled] [ref=e49]
          - button "backspace" [disabled] [ref=e50]:
            - generic [ref=e51]: backspace
          - button "0" [disabled] [ref=e52]
          - button "login" [disabled] [ref=e53]:
            - generic [ref=e54]: login
      - generic:
        - generic: wifi
        - generic: battery_charging_full
  - alert [ref=e55]
```

# Test source

```ts
  36  | 
  37  | export const TEST_STAFF_2 = {
  38  |   name: 'Zara Sheikh',
  39  |   pin: '5678',
  40  |   wrongPin: '7777',
  41  | };
  42  | 
  43  | export const FLOAT_SHORTCUTS = {
  44  |   '2000': 'PKR 2,000',
  45  |   '5000': 'PKR 5,000',
  46  |   '10000': 'PKR 10,000',
  47  | };
  48  | 
  49  | // ─── Storage Helpers ─────────────────────────────────────────────────────────
  50  | 
  51  | /**
  52  |  * Clears session-related POS localStorage keys.
  53  |  * Preserves branch/terminal config so device registration stays intact.
  54  |  */
  55  | export async function clearPosStorage(page: Page) {
  56  |   await page.evaluate(() => {
  57  |     const keepKeys = ['pos_branch_id', 'pos_tenantId', 'pos_terminalId', 'pos_branding'];
  58  |     const keysToRemove: string[] = [];
  59  |     for (let i = 0; i < localStorage.length; i++) {
  60  |       const k = localStorage.key(i);
  61  |       if (k && k.startsWith('pos_') && !keepKeys.includes(k)) {
  62  |         keysToRemove.push(k);
  63  |       }
  64  |     }
  65  |     keysToRemove.forEach((k) => localStorage.removeItem(k));
  66  |     // Also clear lockout state
  67  |     localStorage.removeItem('pos_wrong_attempts');
  68  |     localStorage.removeItem('pos_lockout_until');
  69  |     // Clear view mode preferences for clean slate
  70  |     localStorage.removeItem('pos_viewMode');
  71  |   });
  72  | }
  73  | 
  74  | /**
  75  |  * Reads a localStorage item and parses JSON. Returns null if not found.
  76  |  */
  77  | export async function getStorageItem(page: Page, key: string) {
  78  |   return page.evaluate((k: string) => {
  79  |     const item = localStorage.getItem(k);
  80  |     if (!item) return null;
  81  |     try {
  82  |       return JSON.parse(item);
  83  |     } catch {
  84  |       return item;
  85  |     }
  86  |   }, key);
  87  | }
  88  | 
  89  | /**
  90  |  * Sets a localStorage item (serializes to JSON).
  91  |  */
  92  | export async function setStorageItem(page: Page, key: string, value: unknown) {
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
> 136 |     await btn.click();
      |               ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
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
  193 |   await page.reload();
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
```