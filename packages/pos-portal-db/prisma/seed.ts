import { PrismaClient, Role, OrderType, OrderStatus, PaymentMethod, TableStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function hashSync(value: string) {
  return bcrypt.hashSync(value, 10);
}

async function main() {
  console.log('Seeding pos-portal-db...');

  const tenant = await prisma.tenant.create({ data: { name: 'Kababjees Restaurant Group' } });

  const branch = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      code: 'SS-KHI-001',
      name: 'Clifton',
      address: 'Block 2, Clifton, Karachi',
      phone: '+92 21 1234567',
      operatingHours: '12:00 PM – 1:00 AM',
      settings: {
        receipt: { header: 'Kababjees — Clifton Branch', footer: 'Thank you for dining with us!', paperSize: '80mm', showLogo: true, showTaxBreakdown: true },
        tax: { cashTaxRate: 0.05, cardTaxRate: 0.17, taxRegistrationNumber: 'NTN-1234567-8' },
        payments: { cash: true, card: true, jazzcash: true, easypaisa: true },
        workflow: { autoAcceptOrders: false, requireManagerPinForDiscounts: true, autoPrintKot: true },
        notifications: { newOrderAlerts: true, lowStockAlerts: true, shiftReminders: false, dailySummaryEmail: true },
        backup: { lastBackupAt: new Date(new Date().setHours(4, 0, 0, 0)).toISOString(), frequency: 'Daily', storageUsedGb: 1.2, storageLimitGb: 10 },
      },
    },
  });

  await prisma.rolePermission.createMany({
    data: [
      { tenantId: tenant.id, role: Role.BRANCH_MANAGER, module: 'Orders', canView: true, canCreate: true, canEdit: true, canDelete: false },
      { tenantId: tenant.id, role: Role.BRANCH_MANAGER, module: 'Menu Management', canView: true, canCreate: true, canEdit: true, canDelete: true },
      { tenantId: tenant.id, role: Role.BRANCH_MANAGER, module: 'Staff', canView: true, canCreate: true, canEdit: true, canDelete: false },
      { tenantId: tenant.id, role: Role.BRANCH_MANAGER, module: 'Settings', canView: true, canCreate: false, canEdit: true, canDelete: false },
      { tenantId: tenant.id, role: Role.BRANCH_MANAGER, module: 'Analytics & Reports', canView: true, canCreate: false, canEdit: false, canDelete: false },
    ],
  });

  const owner = await prisma.user.create({
    data: {
      tenantId: tenant.id, branchId: branch.id, email: 'admin@kababjees.pk', name: 'Kababjees Owner',
      role: Role.TENANT_ADMIN, avatarBg: '#B7C6EF', avatarFg: '#1B2C63',
      accounts: { create: { accountId: 'admin@kababjees.pk', providerId: 'credential', password: hashSync('Admin@123456') } },
    },
  });

  const bilal = await prisma.user.create({
    data: {
      tenantId: tenant.id, branchId: branch.id, email: 'manager.clifton@kababjees.pk', name: 'Bilal Raza',
      role: Role.BRANCH_MANAGER, phone: '+92 300 1112223', avatarBg: '#B7C6EF', avatarFg: '#1B2C63',
      posPinHash: hashSync('1234'),
      accounts: { create: { accountId: 'manager.clifton@kababjees.pk', providerId: 'credential', password: hashSync('Manager@1234') } },
    },
  });

  const sana = await prisma.user.create({
    data: {
      tenantId: tenant.id, branchId: branch.id, email: 'sana.cashier@kababjees.pk', name: 'Sana K.',
      role: Role.CASHIER, phone: '+92 301 4445556', avatarBg: '#A9D3BB', avatarFg: '#0F3D22', posPinHash: hashSync('5678'),
    },
  });

  const ali = await prisma.user.create({
    data: {
      tenantId: tenant.id, branchId: branch.id, email: 'ali.waiter@kababjees.pk', name: 'Ali Hassan',
      role: Role.WAITER, phone: '+92 302 7778889', avatarBg: '#F2C88C', avatarFg: '#6B4A16', posPinHash: hashSync('2345'),
    },
  });

  const kamran = await prisma.user.create({
    data: {
      tenantId: tenant.id, branchId: branch.id, email: 'kamran.kitchen@kababjees.pk', name: 'Kamran Y.',
      role: Role.KITCHEN_STAFF, phone: '+92 303 1231234', active: false, posPinHash: hashSync('6789'),
    },
  });

  const sara = await prisma.user.create({
    data: { tenantId: tenant.id, branchId: branch.id, email: 'sara.waiter@kababjees.pk', name: 'Sara Iqbal', role: Role.WAITER, posPinHash: hashSync('3456') },
  });
  const zain = await prisma.user.create({
    data: { tenantId: tenant.id, branchId: branch.id, email: 'zain.waiter@kababjees.pk', name: 'Zain Abbas', role: Role.WAITER, posPinHash: hashSync('4567') },
  });

  // ── Dine-in ──
  const mainHall = await prisma.tableSection.create({ data: { branchId: branch.id, name: 'Main Hall', sortOrder: 0 } });
  const garden = await prisma.tableSection.create({ data: { branchId: branch.id, name: 'Garden', sortOrder: 1 } });
  const familyRoom = await prisma.tableSection.create({ data: { branchId: branch.id, name: 'Family Room', sortOrder: 2 } });

  const tableDefs = [
    { label: 'T-01', section: mainHall.id, seats: 4, status: TableStatus.FREE },
    { label: 'T-02', section: mainHall.id, seats: 4, status: TableStatus.OCCUPIED },
    { label: 'T-03', section: mainHall.id, seats: 2, status: TableStatus.FREE },
    { label: 'T-04', section: mainHall.id, seats: 6, status: TableStatus.OCCUPIED },
    { label: 'T-05', section: mainHall.id, seats: 4, status: TableStatus.FREE },
    { label: 'T-06', section: garden.id, seats: 4, status: TableStatus.RESERVED },
    // Seeded with a held order below — real usage always flips a table to
    // OCCUPIED the moment an order is created on it, held or not, so this
    // stays consistent with what the actual createOrder() flow would do.
    { label: 'T-07', section: garden.id, seats: 6, status: TableStatus.OCCUPIED },
    { label: 'T-08', section: garden.id, seats: 2, status: TableStatus.FREE },
    { label: 'T-09', section: familyRoom.id, seats: 8, status: TableStatus.OCCUPIED },
    { label: 'T-10', section: familyRoom.id, seats: 4, status: TableStatus.FREE },
    { label: 'T-11', section: familyRoom.id, seats: 4, status: TableStatus.OCCUPIED },
    { label: 'T-12', section: familyRoom.id, seats: 4, status: TableStatus.FREE },
  ];
  const tables = new Map<string, string>();
  for (const t of tableDefs) {
    const row = await prisma.dineTable.create({ data: { branchId: branch.id, sectionId: t.section, label: t.label, seats: t.seats, status: t.status } });
    tables.set(t.label, row.id);
  }

  await prisma.reservation.createMany({
    data: [
      { branchId: branch.id, tableId: tables.get('T-09'), name: 'Farooq Family', partySize: 6, time: new Date(Date.now() + 6 * 3600_000), status: 'CONFIRMED' },
      { branchId: branch.id, tableId: tables.get('T-03'), name: 'Ayesha Malik', partySize: 2, time: new Date(Date.now() + 7 * 3600_000), status: 'CONFIRMED' },
      { branchId: branch.id, tableId: tables.get('T-06'), name: 'Khan Party', partySize: 8, time: new Date(Date.now() + 7.5 * 3600_000), status: 'PENDING' },
      { branchId: branch.id, tableId: tables.get('T-07'), name: 'Nadia S.', partySize: 4, time: new Date(), status: 'SEATED' },
    ],
  });

  // ── Menu ──
  const categoryDefs = [
    ['bbq', 'BBQ & Grills'], ['karahi', 'Karahi'], ['biryani', 'Biryani & Rice'],
    ['appetizers', 'Appetizers'], ['bread', 'Naan & Bread'], ['beverages', 'Beverages'], ['desserts', 'Desserts'],
  ];
  const categories = new Map<string, string>();
  let sort = 0;
  for (const [key, label] of categoryDefs) {
    const row = await prisma.menuCategory.create({ data: { branchId: branch.id, label, sortOrder: sort++ } });
    categories.set(key, row.id);
  }

  const itemDefs: { id: string; name: string; category: string; price: number; popular?: boolean }[] = [
    { id: 'seekh-kebab', name: 'Seekh Kebab (6 pcs)', category: 'bbq', price: 890, popular: true },
    { id: 'chicken-tikka', name: 'Chicken Tikka (Full)', category: 'bbq', price: 1250, popular: true },
    { id: 'malai-boti', name: 'Malai Boti', category: 'bbq', price: 1100 },
    { id: 'beef-boti', name: 'Beef Boti', category: 'bbq', price: 1350 },
    { id: 'chicken-wings', name: 'Peri Peri Wings', category: 'bbq', price: 750 },
    { id: 'chicken-karahi', name: 'Chicken Karahi (Full)', category: 'karahi', price: 2100, popular: true },
    { id: 'chicken-karahi-half', name: 'Chicken Karahi (Half)', category: 'karahi', price: 1200 },
    { id: 'mutton-karahi', name: 'Mutton Karahi (Full)', category: 'karahi', price: 3400 },
    { id: 'paneer-karahi', name: 'Paneer Karahi', category: 'karahi', price: 1450 },
    { id: 'chicken-biryani', name: 'Chicken Biryani', category: 'biryani', price: 450, popular: true },
    { id: 'mutton-biryani', name: 'Mutton Biryani', category: 'biryani', price: 650 },
    { id: 'veg-pulao', name: 'Vegetable Pulao', category: 'biryani', price: 380 },
    { id: 'plain-rice', name: 'Plain Rice', category: 'biryani', price: 250 },
    { id: 'hummus', name: 'Hummus with Bread', category: 'appetizers', price: 550 },
    { id: 'spring-rolls', name: 'Spring Rolls (6 pcs)', category: 'appetizers', price: 480 },
    { id: 'chicken-soup', name: 'Chicken Corn Soup', category: 'appetizers', price: 420 },
    { id: 'naan', name: 'Naan', category: 'bread', price: 60 },
    { id: 'garlic-naan', name: 'Garlic Naan', category: 'bread', price: 90 },
    { id: 'roghni-naan', name: 'Roghni Naan', category: 'bread', price: 80 },
    { id: 'soft-drink', name: 'Soft Drink (Can)', category: 'beverages', price: 150 },
    { id: 'fresh-lime', name: 'Fresh Lime', category: 'beverages', price: 280 },
    { id: 'kashmiri-chai', name: 'Kashmiri Chai', category: 'beverages', price: 320 },
    { id: 'kheer', name: 'Kheer', category: 'desserts', price: 380 },
    { id: 'gulab-jamun', name: 'Gulab Jamun (4 pcs)', category: 'desserts', price: 420 },
  ];
  const items = new Map<string, string>();
  for (const it of itemDefs) {
    const row = await prisma.menuItem.create({
      data: { branchId: branch.id, categoryId: categories.get(it.category)!, name: it.name, price: it.price, popular: !!it.popular, available: !['mutton-karahi', 'beef-boti'].includes(it.id) },
    });
    items.set(it.id, row.id);
  }

  await prisma.variationGroup.create({
    data: {
      branchId: branch.id, name: 'Biryani Portion', appliesTo: 'Biryani & Rice',
      options: { create: [{ label: 'Half', priceDelta: -150 }, { label: 'Full', priceDelta: 0 }] },
    },
  });
  await prisma.variationGroup.create({
    data: {
      branchId: branch.id, name: 'Karahi Size', appliesTo: 'Karahi',
      options: { create: [{ label: 'Half', priceDelta: -900 }, { label: 'Full', priceDelta: 0 }, { label: 'Family (1.5x)', priceDelta: 950 }] },
    },
  });
  await prisma.addOnGroup.create({
    data: { branchId: branch.id, name: 'Extra Toppings', options: { create: [{ label: 'Extra Cheese', price: 150 }, { label: 'Extra Raita', price: 80 }] } },
  });
  await prisma.addOnGroup.create({
    data: { branchId: branch.id, name: 'Sides', options: { create: [{ label: 'Extra Naan', price: 60 }, { label: 'Salad', price: 120 }] } },
  });
  await prisma.deal.createMany({
    data: [
      { branchId: branch.id, name: 'Family Feast', description: 'Full Chicken Karahi + 4 Naan + 1.5L Drink', price: 2800, originalPrice: 3350, active: true },
      { branchId: branch.id, name: 'Lunch Combo', description: 'Chicken Biryani + Soft Drink + Raita', price: 650, originalPrice: 780, active: true },
      { branchId: branch.id, name: 'BBQ Platter for 2', description: 'Seekh Kebab + Chicken Tikka + 2 Naan', price: 1990, originalPrice: 2340, active: false },
    ],
  });

  // ── Warehouse / Inventory ──
  const alFateh = await prisma.supplier.create({ data: { branchId: branch.id, name: 'Al-Fateh Meats', category: 'Meat & Poultry', contact: '+92 300 1234567', leadTime: '1 day' } });
  const punjabGrains = await prisma.supplier.create({ data: { branchId: branch.id, name: 'Punjab Grains Co.', category: 'Rice & Grains', contact: '+92 321 9876543', leadTime: '2 days' } });
  const dairyFresh = await prisma.supplier.create({ data: { branchId: branch.id, name: 'Dairy Fresh Ltd.', category: 'Dairy', contact: '+92 333 4567890', leadTime: '1 day' } });

  await prisma.supplierBalance.createMany({
    data: [
      { supplierId: alFateh.id, outstanding: 84500, terms: 'Net 15', lastPaymentAt: new Date(Date.now() - 11 * 86400_000) },
      { supplierId: punjabGrains.id, outstanding: 38000, terms: 'Net 30', lastPaymentAt: new Date(Date.now() - 16 * 86400_000) },
      { supplierId: dairyFresh.id, outstanding: 0, terms: 'Net 7', lastPaymentAt: new Date(Date.now() - 3 * 86400_000) },
    ],
  });
  await prisma.supplierPayment.createMany({
    data: [
      { supplierId: dairyFresh.id, amount: 21200, method: 'Bank Transfer', createdAt: new Date(Date.now() - 3 * 86400_000) },
      { supplierId: alFateh.id, amount: 60000, method: 'Cheque', createdAt: new Date(Date.now() - 11 * 86400_000) },
      { supplierId: punjabGrains.id, amount: 25000, method: 'Bank Transfer', createdAt: new Date(Date.now() - 16 * 86400_000) },
    ],
  });

  const chickenBreast = await prisma.ingredient.create({ data: { branchId: branch.id, name: 'Chicken Breast', unit: 'kg', costPerUnit: 780, supplierId: alFateh.id } });
  const mutton = await prisma.ingredient.create({ data: { branchId: branch.id, name: 'Mutton', unit: 'kg', costPerUnit: 2100, supplierId: alFateh.id } });
  const basmatiRice = await prisma.ingredient.create({ data: { branchId: branch.id, name: 'Basmati Rice', unit: 'kg', costPerUnit: 320, supplierId: punjabGrains.id } });
  const mozzarella = await prisma.ingredient.create({ data: { branchId: branch.id, name: 'Mozzarella Cheese', unit: 'kg', costPerUnit: 1450, supplierId: dairyFresh.id } });
  const cookingOil = await prisma.ingredient.create({ data: { branchId: branch.id, name: 'Cooking Oil', unit: 'L', costPerUnit: 580, supplierId: punjabGrains.id } });

  await prisma.stockItem.createMany({
    data: [
      { branchId: branch.id, name: 'Chicken Breast', unit: 'kg', onHand: 4.2, threshold: 10 },
      { branchId: branch.id, name: 'Mutton', unit: 'kg', onHand: 18, threshold: 8 },
      { branchId: branch.id, name: 'Basmati Rice', unit: 'kg', onHand: 62, threshold: 20 },
      { branchId: branch.id, name: 'Mozzarella Cheese', unit: 'kg', onHand: 1.8, threshold: 5 },
      { branchId: branch.id, name: 'Cooking Oil', unit: 'L', onHand: 0, threshold: 15 },
      { branchId: branch.id, name: 'Coke Cans (250ml)', unit: 'pcs', onHand: 12, threshold: 48 },
      { branchId: branch.id, name: 'Flour', unit: 'kg', onHand: 40, threshold: 15 },
    ],
  });

  await prisma.recipe.create({
    data: {
      branchId: branch.id, menuItemId: items.get('chicken-karahi')!, yieldQty: '1 serving (4 pax)',
      lines: { create: [{ ingredientId: chickenBreast.id, qty: 1.2, unit: 'kg' }, { ingredientId: cookingOil.id, qty: 0.15, unit: 'L' }] },
    },
  });
  await prisma.recipe.create({
    data: {
      branchId: branch.id, menuItemId: items.get('chicken-biryani')!, yieldQty: '1 plate',
      lines: { create: [{ ingredientId: basmatiRice.id, qty: 0.25, unit: 'kg' }, { ingredientId: chickenBreast.id, qty: 0.2, unit: 'kg' }] },
    },
  });

  const po1 = await prisma.purchaseOrder.create({
    data: { branchId: branch.id, supplierId: alFateh.id, status: 'RECEIVED', total: 84500, createdAt: new Date(Date.now() - 3 * 86400_000),
      lines: { create: [{ ingredientId: chickenBreast.id, qty: 60, unitCost: 780 }, { ingredientId: mutton.id, qty: 15, unitCost: 2100 }] } },
  });
  await prisma.purchaseOrder.create({
    data: { branchId: branch.id, supplierId: punjabGrains.id, status: 'SENT', total: 38000, createdAt: new Date(Date.now() - 1 * 86400_000),
      lines: { create: [{ ingredientId: basmatiRice.id, qty: 100, unitCost: 320 }] } },
  });
  await prisma.purchaseOrder.create({
    data: { branchId: branch.id, supplierId: dairyFresh.id, status: 'DRAFT', total: 21200,
      lines: { create: [{ ingredientId: mozzarella.id, qty: 14, unitCost: 1450 }] } },
  });

  await prisma.goodsReceipt.create({ data: { branchId: branch.id, purchaseOrderId: po1.id, receivedById: bilal.id, status: 'COMPLETE', createdAt: new Date(Date.now() - 3 * 86400_000) } });

  await prisma.wastageEntry.createMany({
    data: [
      { branchId: branch.id, itemName: 'Chicken Breast', qtyLabel: '1.5 kg', reason: 'Spoilage', cost: 1170, createdAt: new Date(Date.now() - 1 * 86400_000) },
      { branchId: branch.id, itemName: 'Naan Dough', qtyLabel: '3 kg', reason: 'Over-prepped', cost: 420, createdAt: new Date(Date.now() - 2 * 86400_000) },
      { branchId: branch.id, itemName: 'Mozzarella Cheese', qtyLabel: '0.4 kg', reason: 'Dropped', cost: 580, createdAt: new Date(Date.now() - 3 * 86400_000) },
    ],
  });
  await prisma.stockCheck.createMany({
    data: [
      { branchId: branch.id, conductedById: bilal.id, discrepancies: 2, status: 'COMPLETE', createdAt: new Date(Date.now() - 6 * 86400_000) },
      { branchId: branch.id, conductedById: sana.id, discrepancies: 0, status: 'IN_PROGRESS' },
    ],
  });
  await prisma.stockMovement.createMany({
    data: [
      { branchId: branch.id, itemName: 'Chicken Breast', type: 'IN', qtyLabel: '20 kg', reason: 'PO received', createdAt: new Date(Date.now() - 3 * 86400_000) },
      { branchId: branch.id, itemName: 'Basmati Rice', type: 'OUT', qtyLabel: '12 kg', reason: 'Kitchen consumption', createdAt: new Date(Date.now() - 2 * 86400_000) },
      { branchId: branch.id, itemName: 'Cooking Oil', type: 'OUT', qtyLabel: '15 L', reason: 'Kitchen consumption', createdAt: new Date(Date.now() - 1 * 86400_000) },
      { branchId: branch.id, itemName: 'Mozzarella Cheese', type: 'OUT', qtyLabel: '0.4 kg', reason: 'Wastage — dropped', createdAt: new Date(Date.now() - 3 * 86400_000) },
    ],
  });

  // ── Delivery ──
  const farhan = await prisma.rider.create({ data: { branchId: branch.id, name: 'Farhan A.', phone: '+92 301 2223344', status: 'ON_DELIVERY', rating: 4.8 } });
  const imran = await prisma.rider.create({ data: { branchId: branch.id, name: 'Imran S.', phone: '+92 302 5556677', status: 'ON_DELIVERY', rating: 4.6 } });
  await prisma.rider.create({ data: { branchId: branch.id, name: 'Kashif N.', phone: '+92 303 8889900', status: 'AVAILABLE', rating: 4.9 } });
  await prisma.rider.create({ data: { branchId: branch.id, name: 'Waseem T.', phone: '+92 304 1112233', status: 'OFFLINE', rating: 4.5 } });

  const zoneClifton = await prisma.deliveryZone.create({ data: { branchId: branch.id, name: 'Clifton', fee: 100, avgTimeMinutes: 22 } });
  await prisma.deliveryZone.create({ data: { branchId: branch.id, name: 'DHA Phase 5-8', fee: 150, avgTimeMinutes: 28 } });
  await prisma.deliveryZone.create({ data: { branchId: branch.id, name: 'Saddar', fee: 120, avgTimeMinutes: 25 } });

  // ── Shift ──
  const shift = await prisma.shift.create({ data: { branchId: branch.id, openedById: bilal.id, openingFloat: 5000, openedAt: new Date(Date.now() - 5 * 3600_000) } });
  await prisma.shift.createMany({
    data: [
      { branchId: branch.id, openedById: sana.id, status: 'CLOSED', openingFloat: 5000, openedAt: new Date(Date.now() - 33 * 3600_000), closedAt: new Date(Date.now() - 24 * 3600_000), expectedCash: 68400, countedCash: 68400, variance: 0 },
      { branchId: branch.id, openedById: bilal.id, status: 'CLOSED', openingFloat: 5000, openedAt: new Date(Date.now() - 57 * 3600_000), closedAt: new Date(Date.now() - 47 * 3600_000), expectedCash: 74200, countedCash: 74050, variance: -150 },
      { branchId: branch.id, openedById: sana.id, status: 'CLOSED', openingFloat: 5000, openedAt: new Date(Date.now() - 81 * 3600_000), closedAt: new Date(Date.now() - 72 * 3600_000), expectedCash: 59800, countedCash: 59850, variance: 50 },
    ],
  });

  // ── Orders ──
  async function makeOrder(opts: {
    type: OrderType; status: OrderStatus; table?: string; customerName?: string; waiterId?: string;
    lines: { itemKey: string; qty: number }[]; method?: PaymentMethod; minutesAgo?: number;
  }) {
    const createdAt = new Date(Date.now() - (opts.minutesAgo ?? 0) * 60_000);
    const order = await prisma.order.create({
      data: {
        branchId: branch.id, type: opts.type, status: opts.status, shiftId: shift.id,
        tableId: opts.table ? tables.get(opts.table) : undefined,
        customerName: opts.customerName, waiterId: opts.waiterId, handledById: sana.id, createdAt,
        items: {
          create: await Promise.all(
            opts.lines.map(async (l) => {
              const def = itemDefs.find((d) => d.id === l.itemKey)!;
              return { menuItemId: items.get(l.itemKey)!, nameSnapshot: def.name, priceSnapshot: def.price, qty: l.qty };
            })
          ),
        },
      },
      include: { items: true },
    });

    if (opts.method) {
      const subtotal = order.items.reduce((s, i) => s + i.priceSnapshot * i.qty, 0);
      const taxRate = opts.method === 'CASH' ? 0.05 : 0.17;
      const taxAmount = Math.round(subtotal * taxRate);
      await prisma.payment.create({
        data: { orderId: order.id, method: opts.method, subtotal, taxRate, taxAmount, total: subtotal + taxAmount, collectedAt: createdAt },
      });
    }
    return order;
  }

  await makeOrder({ type: 'DINE_IN', status: 'PENDING', table: 'T-09', waiterId: ali.id, minutesAgo: 1, lines: [{ itemKey: 'chicken-karahi', qty: 1 }, { itemKey: 'naan', qty: 4 }, { itemKey: 'fresh-lime', qty: 2 }] });
  await makeOrder({ type: 'DINE_IN', status: 'IN_KITCHEN', table: 'T-04', waiterId: sara.id, minutesAgo: 2, lines: [{ itemKey: 'seekh-kebab', qty: 2 }, { itemKey: 'chicken-tikka', qty: 1 }, { itemKey: 'naan', qty: 3 }] });
  const sanaDeliveryOrder = await makeOrder({ type: 'DELIVERY', status: 'IN_KITCHEN', customerName: 'Sana K.', minutesAgo: 4, lines: [{ itemKey: 'chicken-biryani', qty: 2 }, { itemKey: 'soft-drink', qty: 2 }] });
  await makeOrder({ type: 'TAKEAWAY', status: 'READY', customerName: 'Ahmed', minutesAgo: 6, lines: [{ itemKey: 'chicken-tikka', qty: 1 }, { itemKey: 'roghni-naan', qty: 2 }] });
  await makeOrder({ type: 'DINE_IN', status: 'READY', table: 'T-11', waiterId: zain.id, minutesAgo: 9, lines: [{ itemKey: 'chicken-karahi', qty: 1 }, { itemKey: 'chicken-biryani', qty: 2 }, { itemKey: 'naan', qty: 4 }] });

  const delivered = await makeOrder({ type: 'DELIVERY', status: 'COMPLETED', customerName: 'Bilal R.', method: 'CARD', minutesAgo: 41, lines: [{ itemKey: 'chicken-biryani', qty: 3 }, { itemKey: 'chicken-tikka', qty: 1 }] });
  await makeOrder({ type: 'DINE_IN', status: 'COMPLETED', table: 'T-11', method: 'CASH', minutesAgo: 58, lines: [{ itemKey: 'chicken-karahi-half', qty: 1 }] });
  await makeOrder({ type: 'DINE_IN', status: 'COMPLETED', table: 'T-02', method: 'CASH', minutesAgo: 75, lines: [{ itemKey: 'chicken-biryani', qty: 4 }, { itemKey: 'naan', qty: 4 }] });
  await makeOrder({ type: 'TAKEAWAY', status: 'CANCELLED', customerName: 'Zara', minutesAgo: 90, lines: [{ itemKey: 'chicken-biryani', qty: 1 }] });
  await makeOrder({ type: 'DINE_IN', status: 'COMPLETED', table: 'T-06', method: 'JAZZCASH', minutesAgo: 104, lines: [{ itemKey: 'malai-boti', qty: 1 }, { itemKey: 'naan', qty: 3 }] });
  const usmanOrder = await makeOrder({ type: 'DELIVERY', status: 'COMPLETED', customerName: 'Usman T.', method: 'EASYPAISA', minutesAgo: 127, lines: [{ itemKey: 'chicken-tikka', qty: 1 }] });

  const held1 = await makeOrder({ type: 'DINE_IN', status: 'PENDING', table: 'T-07', waiterId: ali.id, minutesAgo: 14, lines: [{ itemKey: 'chicken-karahi-half', qty: 1 }, { itemKey: 'naan', qty: 3 }] });
  const held2 = await makeOrder({ type: 'TAKEAWAY', status: 'PENDING', customerName: 'Fatima', minutesAgo: 26, lines: [{ itemKey: 'chicken-biryani', qty: 1 }, { itemKey: 'soft-drink', qty: 1 }] });
  await prisma.order.update({ where: { id: held1.id }, data: { heldAt: new Date(Date.now() - 14 * 60_000), heldById: ali.id } });
  await prisma.order.update({ where: { id: held2.id }, data: { heldAt: new Date(Date.now() - 26 * 60_000), heldById: bilal.id } });

  await prisma.auditLog.create({ data: { branchId: branch.id, orderId: delivered.id, userId: bilal.id, action: 'STATUS_CHANGE', fromStatus: 'READY', toStatus: 'COMPLETED' } });
  await prisma.auditLog.create({ data: { branchId: branch.id, orderId: held1.id, userId: bilal.id, action: 'HELD' } });

  await prisma.delivery.create({
    data: { branchId: branch.id, orderId: sanaDeliveryOrder.id, riderId: farhan.id, zoneId: zoneClifton.id, address: 'House 12, Street 4, DHA Phase 6', status: 'ASSIGNED', etaMinutes: 20 },
  });
  await prisma.delivery.create({
    data: {
      branchId: branch.id, orderId: delivered.id, riderId: imran.id, zoneId: zoneClifton.id,
      address: 'Flat 3B, Clifton Block 2', status: 'DELIVERED', deliveredInMinutes: 24,
      createdAt: new Date(Date.now() - 41 * 60_000),
    },
  });
  await prisma.delivery.create({
    data: {
      branchId: branch.id, orderId: usmanOrder.id, riderId: farhan.id, zoneId: zoneClifton.id,
      address: 'House 7, Khayaban-e-Roomi, DHA', status: 'DELIVERED', deliveredInMinutes: 19,
      createdAt: new Date(Date.now() - 127 * 60_000),
    },
  });

  // ── Customers ──
  const custBilal = await prisma.customer.create({ data: { branchId: branch.id, name: 'Bilal Raza', phone: '+92 300 1112223', tier: 'GOLD', totalSpent: 128400, orderCount: 42, lastOrderAt: new Date() } });
  await prisma.customer.create({ data: { branchId: branch.id, name: 'Sana K.', phone: '+92 301 4445556', tier: 'SILVER', totalSpent: 52600, orderCount: 18, lastOrderAt: new Date() } });
  const custAhmed = await prisma.customer.create({ data: { branchId: branch.id, name: 'Ahmed T.', phone: '+92 302 7778889', tier: 'BRONZE', totalSpent: 9800, orderCount: 6, lastOrderAt: new Date(Date.now() - 3 * 86400_000) } });
  const custZara = await prisma.customer.create({ data: { branchId: branch.id, name: 'Zara M.', phone: '+92 303 1231234', tier: 'SILVER', totalSpent: 71200, orderCount: 25, lastOrderAt: new Date(Date.now() - 1 * 86400_000) } });

  await prisma.customerSegment.createMany({
    data: [
      { branchId: branch.id, name: 'VIP', description: 'Top 10% spenders, 20+ orders' },
      { branchId: branch.id, name: 'At Risk', description: 'No order in 30+ days' },
      { branchId: branch.id, name: 'New', description: 'First order in last 14 days' },
    ],
  });
  await prisma.loyaltyTier.createMany({
    data: [
      { branchId: branch.id, name: 'Bronze', minPoints: 0, perks: 'Birthday discount' },
      { branchId: branch.id, name: 'Silver', minPoints: 5000, perks: '5% off + birthday discount' },
      { branchId: branch.id, name: 'Gold', minPoints: 15000, perks: '10% off + free delivery + birthday discount' },
    ],
  });
  await prisma.feedback.createMany({
    data: [
      { branchId: branch.id, customerId: custBilal.id, rating: 5, comment: 'Best karahi in Clifton, every time.' },
      { branchId: branch.id, customerId: custAhmed.id, rating: 3, comment: 'Order took longer than the app said.' },
      { branchId: branch.id, customerId: custZara.id, rating: 4, comment: 'Great food, packaging could be better.' },
    ],
  });

  // ── Marketing ──
  await prisma.promo.createMany({
    data: [
      { branchId: branch.id, name: 'Weekday Lunch 15% Off', discountLabel: '15%', validTill: 'Sep 30, 2026', active: true },
      { branchId: branch.id, name: 'First Order Discount', discountLabel: 'PKR 200', validTill: 'Ongoing', active: true },
      { branchId: branch.id, name: 'Eid Special', discountLabel: '20%', validTill: 'Ended', active: false },
    ],
  });
  await prisma.coupon.createMany({
    data: [
      { branchId: branch.id, code: 'WELCOME200', discountLabel: 'PKR 200', usageLimit: 1000, used: 412, expiresAt: new Date('2026-12-31') },
      { branchId: branch.id, code: 'KABAB15', discountLabel: '15%', usageLimit: 500, used: 288, expiresAt: new Date('2026-09-30') },
      { branchId: branch.id, code: 'DELIVER50', discountLabel: 'Free delivery', usageLimit: 300, used: 301, expiresAt: new Date('2026-08-01') },
    ],
  });
  await prisma.campaign.createMany({
    data: [
      { branchId: branch.id, name: 'Weekend Biryani Push', channel: 'WhatsApp', sent: 3200, opened: 1840 },
      { branchId: branch.id, name: 'Loyalty Points Reminder', channel: 'SMS', sent: 1500, opened: 620 },
      { branchId: branch.id, name: 'New Menu Launch', channel: 'Push', sent: 4800, opened: 2100 },
    ],
  });

  // ── Expenses ──
  const utilitiesCat = await prisma.expenseCategory.create({ data: { branchId: branch.id, name: 'Utilities', monthlyBudget: 80000 } });
  const maintenanceCat = await prisma.expenseCategory.create({ data: { branchId: branch.id, name: 'Maintenance', monthlyBudget: 40000 } });
  await prisma.expenseCategory.create({ data: { branchId: branch.id, name: 'Marketing', monthlyBudget: 60000 } });
  await prisma.expenseCategory.create({ data: { branchId: branch.id, name: 'Staff Welfare', monthlyBudget: 25000 } });

  await prisma.expense.createMany({
    data: [
      { branchId: branch.id, description: 'Gas cylinder refill', categoryId: utilitiesCat.id, amount: 3200, paidById: bilal.id },
      { branchId: branch.id, description: 'Cleaning supplies', categoryId: maintenanceCat.id, amount: 1450, paidById: sana.id },
      { branchId: branch.id, description: 'Generator fuel', categoryId: utilitiesCat.id, amount: 5000, paidById: bilal.id, createdAt: new Date(Date.now() - 86400_000) },
    ],
  });
  await prisma.pettyCashEntry.createMany({
    data: [
      { branchId: branch.id, type: 'IN', description: 'Float top-up', amount: 10000, balanceAfter: 12400 },
      { branchId: branch.id, type: 'OUT', description: 'Gas cylinder refill', amount: 3200, balanceAfter: 2400 },
      { branchId: branch.id, type: 'OUT', description: 'Cleaning supplies', amount: 1450, balanceAfter: 950 },
    ],
  });

  // ── Staff attendance / payroll ──
  await prisma.attendanceEntry.create({ data: { userId: ali.id, checkIn: new Date() } });
  await prisma.attendanceEntry.create({ data: { userId: sana.id, checkIn: new Date() } });
  await prisma.attendanceEntry.create({ data: { userId: kamran.id, checkIn: new Date(Date.now() - 28 * 3600_000), checkOut: new Date(Date.now() - 20 * 3600_000) } });

  await prisma.payrollEntry.createMany({
    data: [
      { userId: bilal.id, month: 'Aug 2026', baseSalary: 85000, bonus: 5000 },
      { userId: sana.id, month: 'Aug 2026', baseSalary: 42000, bonus: 2000 },
      { userId: ali.id, month: 'Aug 2026', baseSalary: 35000, bonus: 0 },
    ],
  });

  // ── Integrations / devices ──
  await prisma.aggregator.createMany({
    data: [
      { branchId: branch.id, name: 'Foodpanda', isConnected: true, ordersToday: 24, commissionLabel: '25%' },
      { branchId: branch.id, name: 'Careem Food', isConnected: true, ordersToday: 11, commissionLabel: '22%' },
      { branchId: branch.id, name: 'Cheetay', isConnected: false, ordersToday: 0, commissionLabel: '20%' },
    ],
  });
  await prisma.paymentGateway.createMany({
    data: [
      { branchId: branch.id, name: 'JazzCash', isActive: true, feeLabel: '1.9%' },
      { branchId: branch.id, name: 'EasyPaisa', isActive: true, feeLabel: '1.9%' },
      { branchId: branch.id, name: 'Card (Stripe)', isActive: false, feeLabel: '2.9%' },
    ],
  });
  await prisma.webhookConfig.createMany({
    data: [
      { branchId: branch.id, event: 'order.completed', url: 'https://hooks.kababjees.pk/orders', isHealthy: true, lastTriggeredAt: new Date(Date.now() - 2 * 60_000) },
      { branchId: branch.id, event: 'payment.received', url: 'https://hooks.kababjees.pk/payments', isHealthy: true, lastTriggeredAt: new Date(Date.now() - 6 * 60_000) },
      { branchId: branch.id, event: 'stock.low', url: 'https://hooks.kababjees.pk/alerts', isHealthy: false, lastTriggeredAt: new Date(Date.now() - 3 * 3600_000) },
    ],
  });
  await prisma.printerDevice.createMany({
    data: [
      { branchId: branch.id, name: 'Front Counter Printer', type: 'Receipt', station: 'Cashier', isOnline: true },
      { branchId: branch.id, name: 'Kitchen KOT', type: 'Kitchen', station: 'Main Kitchen', isOnline: true },
      { branchId: branch.id, name: 'BBQ Station', type: 'Kitchen', station: 'Grill', isOnline: false },
      { branchId: branch.id, name: 'Cash Drawer', type: 'Drawer', station: 'Cashier', isOnline: true },
      { branchId: branch.id, name: 'Kitchen Display', type: 'KDS Screen', station: 'Main Kitchen', isOnline: true },
    ],
  });

  console.log('Seed complete.');
  console.log('Login: admin@kababjees.pk / Admin@123456 (Tenant Admin)');
  console.log('Login: manager.clifton@kababjees.pk / Manager@1234 (Branch Manager)');
  console.log('PINs: Bilal 1234, Sana 5678, Ali 2345, Kamran 6789');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
