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

async function prepare(page: Page) {
  await page.addInitScript(({ openedAt, branding }) => {
    localStorage.setItem('pos_session', JSON.stringify({ userId: 'cashier-fixture', name: 'Test Cashier', role: 'CASHIER', branchId: 'branch-fixture', branchName: 'Clifton', tenantId: 'tenant-fixture', token: 'fixture-only', expiresAt: '2099-01-01T00:00:00Z' }));
    localStorage.setItem('pos_token', 'fixture-only');
    localStorage.setItem('pos_shift', JSON.stringify({ shiftId: 'shift-fixture', openedAt, openingFloat: 5000 }));
    localStorage.setItem('pos_branding', JSON.stringify(branding));
    localStorage.setItem('pos_tenant_settings', JSON.stringify(branding));
  }, { openedAt, branding });
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    let data: any = {};
    if (path.endsWith('/menu')) data = categories;
    else if (path.includes('branding')) data = { branding };
    else if (path.includes('tenant-settings')) data = branding;
    else if (path.includes('floor-plan')) data = { tables, floors: [{ floorNumber: 1, name: 'Ground floor' }] };
    else if (path.endsWith('/orders/live')) data = { orders };
    else if (/\/orders\/order-\d+$/.test(path)) data = orders.find(o => path.endsWith('/' + o.id));
    else if (path.endsWith('/shifts/current')) data = { id: 'shift-fixture', openedAt, openingFloat: 5000, status: 'OPEN' };
    else if (path.endsWith('/summary')) data = { shiftId: 'shift-fixture', openedAt, totalOrders: 0, totalSales: 0, totalCash: 0, expectedCash: 5000, openingFloat: 5000, unpaidOrders: 0, unpaidOrdersList: [] };
    else if (path.endsWith('/can-close')) data = { canClose: true, blockers: [] };
    else if (path.includes('waiters')) data = { waiters: [] };
    else if (path.includes('orphans')) data = { orders: [], orphans: [] };
    else if (path.includes('held')) data = [];
    else if (path.includes('inventory') || path.includes('stock')) data = { items: [], alerts: [] };
    else if (path.includes('events/batch')) return route.fulfill({ status: 503, json: { error: 'Fixture: writes stay local' } });
    else if (route.request().method() !== 'GET') return route.fulfill({ status: 503, json: { error: 'Fixture blocks all external writes' } });
    await route.fulfill({ status: 200, json: data });
  });
}

for (const width of [360, 768, 1280]) {
  test('POS layout at ' + width, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 });
    await prepare(page);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const screen of ['home', 'order?type=takeaway', 'tables', 'tickets']) {
      await page.goto('/pos/' + screen);
      if (screen.startsWith('order')) await expect(page.getByTestId('menu-item').first()).toBeVisible();
      if (screen === 'tickets') {
        await expect(page.getByTestId('ticket-card').first()).toBeVisible();
        await expect(page.getByTestId('ticket-card').first()).toContainText('50 items');
        await expect(page.getByTestId('ticket-card').nth(1)).toContainText('Takeaway');
      }
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(screen.split('?')[0] + '.png'), fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}
