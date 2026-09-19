import { test, expect, type Page } from '@playwright/test';

const openedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const branding = { restaurantName: 'Kababjees', primaryColor: '#FF6B35', branchKdsEnabled: false, cashTaxRate: 5, cardTaxRate: 17, pos: { cashCountRequired: true }, kitchen: { useKDS: false } };
const items = Array.from({ length: 50 }, (_, i) => ({ id: 'item-' + i, categoryId: 'cat-' + i % 4, name: ['Chicken Biryani', 'Beef Seekh Kabab', 'Chicken Malai Boti', 'Fresh Lime'][i % 4] + (i > 3 ? ' ' + i : ''), basePrice: 500 + i * 10, isAvailable: true, variations: [], addOns: [], sortOrder: i }));
const categories = ['Rice & mains', 'Barbecue', 'House specials', 'Drinks'].map((name, i) => ({ id: 'cat-' + i, name, items: items.filter(item => item.categoryId === 'cat-' + i) }));
const orders = Array.from({ length: 8 }, (_, i) => ({
  id: 'order-' + i, orderNumber: 'A-1809-' + String(i + 1).padStart(3, '0'), type: i % 2 ? 'TAKEAWAY' : 'DINE_IN',
  status: ['READY', 'IN_KITCHEN', 'PENDING'][i % 3], tableId: i % 2 ? null : 'table-' + i, tableLabel: i % 2 ? null : String(i + 1),
  shiftId: 'shift-fixture', cashierId: 'cashier-fixture', createdAt: openedAt, total: i === 0 ? 26250 : 1050, netAmount: i === 0 ? 26250 : 1050,
  items: (i === 0 ? items : items.slice(0, 2)).map(item => ({ id: 'line-' + i + item.id, itemId: item.id, name: item.name, item: { name: item.name }, qty: 1, quantity: 1, unitPrice: 500, subtotal: 500 })),
}));
const tables = Array.from({ length: 12 }, (_, i) => ({ id: 'table-' + i, label: String(i + 1), capacity: i % 3 === 0 ? 6 : 4, shape: i % 3 === 0 ? 'rectangle' : 'square', status: i < 8 && i % 2 === 0 ? 'OCCUPIED' : 'FREE', positionX: 80 + i % 4 * 190, positionY: 80 + Math.floor(i / 4) * 170, floorNumber: 1, isActive: true }));

async function prepare(page: Page, role = 'CASHIER') {
  await page.addInitScript(({ openedAt, branding, role }) => {
    localStorage.setItem('pos_session', JSON.stringify({ userId: 'cashier-fixture', name: 'Test Cashier', role, branchId: 'branch-fixture', branchName: 'Clifton', tenantId: 'tenant-fixture', token: 'fixture-only', expiresAt: '2099-01-01T00:00:00Z' }));
    localStorage.setItem('pos_token', 'fixture-only');
    localStorage.setItem('pos_shift', JSON.stringify({ shiftId: 'shift-fixture', openedAt, openingFloat: 5000 }));
    localStorage.setItem('pos_branding', JSON.stringify(branding));
    localStorage.setItem('pos_tenant_settings', JSON.stringify(branding));
  }, { openedAt, branding, role });
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', async route => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 503, json: { error: 'Fixture blocks all external writes' } });
    const url = new URL(route.request().url()), path = url.pathname;
    let data: any = {};
    if (path.endsWith('/menu')) data = categories;
    else if (path.includes('branding')) data = { branding };
    else if (path.includes('tenant-settings')) data = branding;
    else if (path.endsWith('/table-orders')) data = orders.filter(o => o.tableId).map(o => ({ ...o, tableId: o.tableId }));
    else if (path.endsWith('/tables') && path.includes('floor-plan')) data = tables;
    else if (path.includes('floor-plan')) data = { tables, floors: [{ floorNumber: 1, name: 'Ground floor' }] };
    else if (path.endsWith('/kds/orders')) data = { orders: orders.map(o => ({ ...o, items: o.items.map(i => ({ ...i, name: i.name, addons: [] })) })), stations: [], summary: { inQueue: 8, inProgress: 3, completedToday: 0, avgPrepTimeSeconds: 60 } };
    else if (path.endsWith('/orders/history')) data = { orders: orders.map(o => ({ ...o, status: 'COMPLETED' })) };
    else if (path.endsWith('/shifts/active')) data = [];
    else if (path.endsWith('/shifts')) data = { data: [] };
    else if (path.endsWith('/analytics/today')) data = { revenue: 12000, orders: 8 };
    else if (path.endsWith('/void-requests')) data = [];
    else if (path.endsWith('/orders/live')) data = { orders };
    else if (/\/orders\/order-\d+$/.test(path)) data = orders.find(o => path.endsWith('/' + o.id));
    else if (path.endsWith('/shifts/current')) data = { id: 'shift-fixture', openedAt, openingFloat: 5000, status: 'OPEN' };
    else if (path.endsWith('/summary')) data = { shiftId: 'shift-fixture', openedAt, totalOrders: 0, totalSales: 0, totalCash: 0, expectedCash: 5000, openingFloat: 5000, unpaidOrders: 0, unpaidOrdersList: [] };
    else if (path.endsWith('/can-close')) data = { canClose: true, blockers: [] };
    else if (path.includes('waiters')) data = { waiters: [] };
    else if (path.includes('orphans')) data = { orders: [], orphans: [] };
    else if (path.includes('held')) data = [];
    else if (path.includes('inventory') || path.includes('stock')) data = { counts: { out: 0, low: 0, ok: 0 }, items: [], alerts: [] };
    else if (path.includes('events/batch')) return route.fulfill({ status: 503, json: { error: 'Fixture: writes stay local' } });
    else if (route.request().method() !== 'GET') return route.fulfill({ status: 503, json: { error: 'Fixture blocks all external writes' } });
    await route.fulfill({ status: 200, json: data });
  });
}

for (const width of [320, 360, 768, 1280]) {
  test('POS layout at ' + width, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 });
    await prepare(page);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const screen of ['home', 'order?type=takeaway', 'tables', 'tickets', 'settings', 'settings?section=sync', 'stock']) {
      await page.goto('/pos/' + screen);
      if (screen === 'home') await expect(page.getByTestId('ticket-card').first()).toBeVisible();
      if (screen.startsWith('order')) await expect(page.getByTestId('menu-item').first()).toBeVisible();
      if (screen === 'tickets') {
        await expect(page.getByTestId('ticket-card').first()).toBeVisible();
        await expect(page.getByTestId('ticket-card').first()).toContainText('50 items');
        await expect(page.getByTestId('ticket-card').filter({ hasText: 'Takeaway' }).first()).toBeVisible();
      }
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(screen.split('?')[0] + '.png'), fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}

test('50-item payment dialog fits a phone and returns focus to its parent', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await prepare(page);
  await page.goto('/pos/tickets');
  await page.getByTestId('ticket-card').filter({ hasText: '50 items' }).getByRole('heading').click();
  const details = page.getByRole('dialog', { name: 'Order details', exact: true });
  await expect(details).toBeVisible();
  await details.getByRole('button', { name: 'Collect Payment', exact: true }).click();
  const payment = page.getByRole('dialog', { name: /Charge order/ });
  await expect(payment).toBeVisible();
  await payment.getByRole('button', { name: 'Exact', exact: true }).click();
  await expect(payment.getByRole('button', { name: /^Collect PKR/ })).toBeEnabled();
  expect(await payment.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })).toBe(true);
  await page.screenshot({ path: info.outputPath('payment-phone.png') });
  await page.keyboard.press('Escape');
  await expect(payment).not.toBeVisible();
  await expect(details).toBeVisible();
  expect(await details.evaluate(el => el.contains(document.activeElement))).toBe(true);
});

test('a paid offline order stays durable and is not charged twice', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 360, height: 850 });
  await prepare(page);
  await page.goto('/pos/order?type=takeaway');
  await expect(page.getByTestId('menu-item').first()).toBeVisible();
  await context.setOffline(true);
  await page.getByTestId('menu-item').first().click();
  await page.getByRole('button', { name: /View order/i }).click();
  await page.getByRole('button', { name: /^Charge PKR/ }).click();
  const payment = page.getByRole('dialog', { name: /Charge order/ });
  await expect(payment).toBeVisible();
  await payment.getByRole('button', { name: 'Exact', exact: true }).click();
  await payment.getByRole('button', { name: /^Collect PKR/ }).evaluate(button => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect(page.getByRole('dialog', { name: 'Payment received', exact: true })).toBeVisible();
  const payments = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('DineizPOS_EventStore_v1'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    return await new Promise<any[]>((resolve, reject) => { const r = db.transaction('events').objectStore('events').getAll(); r.onsuccess = () => { db.close(); resolve(r.result.filter(e => e.type === 'PAYMENT_COLLECTED')); }; r.onerror = () => reject(r.error); });
  });
  expect(payments).toHaveLength(1);
  expect(payments[0].payload.total).toBeGreaterThan(0);
  expect(['LOCAL', 'QUEUED', 'BLOCKED', 'INFLIGHT', 'DEGRADED']).toContain(payments[0].syncState);
  await page.screenshot({ path: info.outputPath('offline-payment.png') });
});

test('manager, receipt and kitchen screens fit a small device', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await prepare(page, 'BRANCH_MANAGER');
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const screen of ['admin', 'admin/reports/shift', 'receipt?orderId=order-0', 'kds']) {
    await page.goto('/pos/' + screen);
    if (screen === 'admin') await expect(page.getByText('Today at a Glance')).toBeVisible();
    if (screen === 'kds') await expect(page.getByRole('button', { name: 'Mark ready', exact: true }).first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(screen.replaceAll('/', '-').split('?')[0] + '.png'), fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('cash movements survive a disconnected API', async ({ page }, info) => {
  await prepare(page);
  await page.goto('/pos/home');
  await expect(page.getByTestId('ticket-card').first()).toBeVisible();
  await page.getByTestId('avatar-menu').click();
  await page.getByRole('button', { name: 'Cash Drawer', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: /cash/i });
  await drawer.getByRole('button', { name: 'Cash in', exact: true }).click();
  await drawer.getByPlaceholder('0', { exact: true }).fill('500');
  await drawer.getByPlaceholder('Or type your own reason…').fill('Extra float');
  await drawer.getByRole('button', { name: /Record cash in/i }).click();
  await expect(drawer.getByText('Cash movements are saved here until the server confirms them. Do not enter them again.')).toBeVisible();
  await drawer.getByRole('button', { name: 'Close', exact: true }).click();
  await page.goto('/pos/settings?section=sync');
  await expect(page.getByText('Cash in · PKR 500')).toBeVisible();
  await page.screenshot({ path: info.outputPath('cash-sync.png') });
});

test('production app reloads and opens cached screens with the network disconnected', async ({ page, context }, info) => {
  test.skip(!process.env.POS_AUDIT_URL, 'Requires a production build with its generated service worker.');
  test.setTimeout(120000);
  await prepare(page, 'BRANCH_MANAGER');
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/pos/order?type=takeaway');
  await expect(page.getByTestId('menu-item').first()).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const cachedShells = await page.evaluate(async () => {
    const name = (await caches.keys()).find(k => k.startsWith('dineiz-pos-shell-'))!;
    return (await (await caches.open(name)).keys()).filter(r => new URL(r.url).pathname.startsWith('/pos/')).length;
  });
  expect(cachedShells).toBeGreaterThanOrEqual(13);
  await page.unroute('**/api/**');
  await page.route('**/api/**', route => route.abort());
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('menu-item').first()).toBeVisible();
  // These pages were never visited by this browser; their shells must already exist.
  for (const screen of ['home', 'tables', 'tickets', 'settings?section=sync', 'stock', 'admin', 'admin/reports/shift', 'kds']) {
    await page.goto('/pos/' + screen);
    await expect(page.locator('main:visible, h1:visible, h2:visible').first()).toBeVisible();
    if (screen === 'tickets') await expect(page.getByTestId('ticket-card')).toHaveCount(8);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByText(/Application error|This site can’t be reached/i)).toHaveCount(0);
  }
  await page.screenshot({ path: info.outputPath('offline-kitchen.png') });
});

test('a rejected payment is visible and blocks an apparently empty shift close', async ({ page }, info) => {
  await prepare(page);
  await page.goto('/pos/home');
  await expect(page.getByTestId('ticket-card').first()).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('DineizPOS_EventStore_v1'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('events', 'readwrite');
      tx.objectStore('events').put({ id: 'rejected-payment-fixture', seq: 999, type: 'PAYMENT_COLLECTED', aggregateType: 'ORDER', aggregateId: 'order-0', shiftId: 'shift-fixture', branchId: 'branch-fixture', tenantId: 'tenant-fixture', actorId: 'cashier-fixture', actorName: 'Test Cashier', terminalId: 'fixture', payload: { method: 'CASH', total: 26250 }, dependsOn: [], clientTime: new Date().toISOString(), syncState: 'POISONED', attempts: 1, lastError: 'Fixture payment requires review' });
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    });
  });
  await page.goto('/pos/shift/close');
  const close = page.getByRole('dialog', { name: 'Close shift', exact: true });
  await expect(close.getByText(/need.*review|review.*required/i).first()).toBeVisible({ timeout: 20000 });
  await close.getByRole('textbox', { name: 'PKR', exact: true }).fill('5000');
  await expect(close.locator('footer button').last()).toBeDisabled();
  await page.screenshot({ path: info.outputPath('rejected-payment-close.png') });
});

test('table filters, plan switching and ticket search work on a phone', async ({ page }, info) => {
  await prepare(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/pos/tables');
  await expect(page.getByTestId('table-row')).toHaveCount(12);
  await page.getByRole('button', { name: /^Occupied/ }).click();
  await expect(page.getByTestId('table-row')).toHaveCount(4);
  await page.getByRole('button', { name: /^Available/ }).click();
  await expect(page.getByTestId('table-row')).toHaveCount(8);
  await page.getByRole('button', { name: /^All tables/ }).click();
  await page.getByRole('textbox', { name: 'Find a table' }).fill('12');
  await expect(page.getByTestId('table-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Show floor plan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Table 12, 4 seats, free', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('table-search-plan.png') });
  await page.goto('/pos/tickets');
  await page.getByRole('textbox', { name: 'Search tickets' }).fill('A-1809-002');
  await expect(page.getByTestId('ticket-card')).toHaveCount(1);
  await expect(page.getByTestId('ticket-card')).toContainText('Takeaway');
});

test('a locally paid order is shown as awaiting sync, not as a second payment to collect', async ({ page }, info) => {
  await prepare(page);
  await page.route('**/api/shifts/shift-fixture/summary', route => route.fulfill({ json: {
    shiftId: 'shift-fixture', openedAt, totalOrders: 0, totalSales: 0, totalCash: 0, expectedCash: 5000, openingFloat: 5000,
    paidOrders: [], unpaidOrders: 1, unpaidValue: 26250, unpaidOrdersList: [orders[0]],
  } }));
  await page.goto('/pos/tickets');
  await page.getByTestId('ticket-card').filter({ hasText: '50 items' }).getByRole('heading').click();
  await page.getByRole('dialog', { name: 'Order details', exact: true }).getByRole('button', { name: 'Collect Payment', exact: true }).click();
  const payment = page.getByRole('dialog', { name: /Charge order/ });
  await payment.getByRole('button', { name: 'Exact', exact: true }).click();
  await payment.getByRole('button', { name: /^Collect PKR/ }).click();
  await expect(page.getByRole('dialog', { name: 'Payment received', exact: true })).toBeVisible();
  await page.goto('/pos/shift/close');
  const close = page.getByRole('dialog', { name: 'Close shift', exact: true });
  await expect(close.getByRole('button', { name: 'Sync & recheck', exact: true })).toBeVisible({ timeout: 20000 });
  await expect(close.getByRole('button', { name: 'Review order', exact: true })).toHaveCount(0);
  await expect(close.getByText(/Do not collect.*twice/i)).toBeVisible();
  await page.screenshot({ path: info.outputPath('paid-order-awaiting-sync.png') });
});

test('legacy saved payment recovers its missing order and survives another offline reload', async ({ page, context }) => {
  test.skip(!process.env.POS_AUDIT_URL, 'Offline reload requires the production service worker.');
  await prepare(page);
  await page.goto('/pos/home');
  await expect(page.getByTestId('ticket-card').first()).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('DineizPOS_EventStore_v1'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['views', 'events'], 'readwrite');
      tx.objectStore('views').clear(); // Isolated browser fixture; no restaurant data.
      tx.objectStore('events').put({ id: 'legacy-paid-fixture', seq: 999, type: 'PAYMENT_COLLECTED', aggregateType: 'ORDER', aggregateId: 'order-0', shiftId: 'shift-fixture', branchId: 'branch-fixture', tenantId: 'tenant-fixture', actorId: 'cashier-fixture', actorName: 'Test Cashier', terminalId: 'fixture', payload: { method: 'CASH', total: 26250 }, dependsOn: [], clientTime: new Date().toISOString(), syncState: 'DEGRADED', attempts: 1, lastError: 'Fixture offline payment' });
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    });
  });
  await page.goto('/pos/tickets');
  await expect(page.getByTestId('ticket-card')).toHaveCount(7);
  await expect(page.getByTestId('ticket-card').filter({ hasText: '#A-1809-001' })).toHaveCount(0);
  await page.unroute('**/api/**');
  await page.route('**/api/**', route => route.abort());
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('ticket-card')).toHaveCount(7);
  await expect(page.getByTestId('ticket-card').filter({ hasText: '#A-1809-001' })).toHaveCount(0);
});
