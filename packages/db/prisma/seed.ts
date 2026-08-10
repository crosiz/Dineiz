import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient()

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex')
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

function daysAgo(days: number, hourOffset = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hourOffset, randomBetween(0, 59), 0, 0)
  return d
}

const BRANCH_COLORS = [
  '#FF5722', '#2563EB', '#16A34A', '#7C3AED',
  '#DC2626', '#0891B2', '#D97706', '#BE185D',
]

async function main() {
  console.log('🌱 Starting comprehensive Dineiz Go seed...\n')

  // ── CLEAN UP ────────────────────────────────────────────────────────────────
  await prisma.$executeRaw`TRUNCATE TABLE
    "PaymentHistory", "TenantSubscription", "TenantBranding",
    "BranchMenuCategory", "BranchMenuItem",
    "AttendancePunch", "StaffZktecoEnrollment", "ZktecoDevice",
    "LoyaltyPointLedger", "LoyaltyTier", "Customer",
    "ZapierWebhookSubscription", "AggregatorWebhookEvent",
    "FloorPlan", "Table",
    "PurchaseOrderLine", "PurchaseOrder", "StockMovement", "Stock",
    "RecipeLine", "Recipe", "Ingredient",
    "ShiftDenomination", "ShiftCashEntry",
    "Payment", "OrderItem", "RiderAssignment", "Order",
    "Shift",
    "KdsStationRoute", "KdsStation",
    "BuyXGetYDeal", "ComboItem", "Combo", "PromoCode",
    "AddOn", "Variation", "Item", "Category",
    "DeliveryZone",
    "UserDevice", "Account", "Session",
    "User", "Branch", "Tenant",
    "Verification"
  CASCADE`
  console.log('✅ Database cleaned\n')

  // ── TENANT ──────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Kababjees Restaurant Group',
      domain: 'kababjees.dineiz.app',
      colorPrimary: '#FF5722',
      colorSecondary: '#FF8A65',
      plan: 'PRO',
    }
  })
  console.log(`✅ Tenant: ${tenant.name}`)

  // ── BRANDING ────────────────────────────────────────────────────────────────
  await prisma.tenantBranding.create({
    data: {
      tenantId: tenant.id,
      restaurantName: 'Kababjees Restaurant Group',
      tagline: 'Taste the tradition since 1988',
      businessType: 'Fine Dining',
      phone: '+92-300-0001234',
      website: 'https://kababjees.pk',
      primaryColor: '#FF5722',
      secondaryColor: '#1A1A2E',
      accentColor: '#FFB300',
      receiptHeader: 'Welcome to Kababjees! Enjoy your meal.',
      receiptFooter: 'Thank you for dining with us. Visit us again!',
      showLogoOnReceipt: true,
      showTaxBreakdown: true,
      receiptLanguage: 'English (US)',
    }
  })

  // ── SUBSCRIPTION ────────────────────────────────────────────────────────────
  const nextRenewal = new Date()
  nextRenewal.setMonth(nextRenewal.getMonth() + 1)
  await prisma.tenantSubscription.create({
    data: {
      tenantId: tenant.id,
      plan: 'PRO',
      billingCycle: 'MONTHLY',
      status: 'ACTIVE',
      nextRenewalDate: nextRenewal,
    }
  })

  // Payment history (last 3 months)
  for (let i = 3; i >= 1; i--) {
    const paidAt = new Date()
    paidAt.setMonth(paidAt.getMonth() - i)
    await prisma.paymentHistory.create({
      data: {
        tenantId: tenant.id,
        amount: 11999,
        currency: 'PKR',
        status: 'PAID',
        description: 'Pro Plan — Monthly',
        paidAt,
      }
    })
  }
  console.log('✅ Branding + Subscription + Payment history')

  // ── BRANCHES ────────────────────────────────────────────────────────────────
  const branchData = [
    {
      name: 'Clifton Branch',
      address: 'Block 5, Clifton, Karachi',
      city: 'Karachi',
      phone: '+92-300-1234567',
      openingTime: '12:00',
      closingTime: '02:00',
      colorHex: BRANCH_COLORS[0],
      initial: 'C',
      taxRate: 15,
    },
    {
      name: 'Defence Phase 6',
      address: 'Khayaban-e-Seher, DHA, Karachi',
      city: 'Karachi',
      phone: '+92-300-7654321',
      openingTime: '11:00',
      closingTime: '01:00',
      colorHex: BRANCH_COLORS[1],
      initial: 'D',
      taxRate: 15,
    },
    {
      name: 'Gulshan-e-Iqbal',
      address: 'Block 4, Gulshan, Karachi',
      city: 'Karachi',
      phone: '+92-300-9876543',
      openingTime: '13:00',
      closingTime: '03:00',
      colorHex: BRANCH_COLORS[2],
      initial: 'G',
      taxRate: 15,
    },
    {
      name: 'North Nazimabad',
      address: 'Block H, North Nazimabad, Karachi',
      city: 'Karachi',
      phone: '+92-300-1122334',
      openingTime: '11:00',
      closingTime: '00:00',
      colorHex: BRANCH_COLORS[3],
      initial: 'N',
      taxRate: 15,
      isActive: false,
    },
  ]

  const branches = await Promise.all(
    branchData.map(b =>
      prisma.branch.create({
        data: { ...b, tenantId: tenant.id, kdsEnabled: true, kotAutoPrint: true }
      })
    )
  )
  const [clifton, defence, gulshan, nazimabad] = branches
  console.log(`✅ ${branches.length} branches created`)

  // ── USERS ───────────────────────────────────────────────────────────────────
  const adminPassword = await hashPassword('Admin@123456')
  const managerPassword = await hashPassword('Manager@1234')
  const cashierPin = hashPin('1234')

  // Tenant Admin
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@kababjees.pk',
      name: 'Ahmad Kababjee',
      emailVerified: true,
      tenantId: tenant.id,
      branchId: clifton.id,
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      avatarColor: '#FF5722',
      phone: '+92-300-0001234',
      password: adminPassword,
    }
  })
  await prisma.account.create({
    data: {
      userId: adminUser.id,
      accountId: adminUser.id,
      providerId: 'credential',
      password: adminPassword,
    }
  })

  // Branch Managers
  const managersClifton = await prisma.user.create({
    data: {
      email: 'manager.clifton@kababjees.pk',
      name: 'Sara Ahmed',
      emailVerified: true,
      tenantId: tenant.id,
      branchId: clifton.id,
      role: 'BRANCH_MANAGER',
      status: 'ACTIVE',
      avatarColor: '#2563EB',
      phone: '+92-321-1111111',
      password: managerPassword,
    }
  })
  await prisma.account.create({
    data: {
      userId: managersClifton.id,
      accountId: managersClifton.id,
      providerId: 'credential',
      password: managerPassword,
    }
  })

  const managerDefence = await prisma.user.create({
    data: {
      email: 'manager.defence@kababjees.pk',
      name: 'Bilal Khan',
      emailVerified: true,
      tenantId: tenant.id,
      branchId: defence.id,
      role: 'BRANCH_MANAGER',
      status: 'ACTIVE',
      avatarColor: '#16A34A',
      phone: '+92-321-2222222',
      password: managerPassword,
    }
  })
  await prisma.account.create({
    data: {
      userId: managerDefence.id,
      accountId: managerDefence.id,
      providerId: 'credential',
      password: managerPassword,
    }
  })

  // Cashiers per branch
  const cashierNames = [
    { name: 'Ali Hassan', branch: clifton, email: 'ali@kababjees.pk', pin: '1234', color: '#10B981' },
    { name: 'Zara Sheikh', branch: clifton, email: 'zara@kababjees.pk', pin: '5678', color: '#F59E0B' },
    { name: 'Omar Farooq', branch: defence, email: 'omar@kababjees.pk', pin: '2345', color: '#8B5CF6' },
    { name: 'Fatima Malik', branch: defence, email: 'fatima@kababjees.pk', pin: '6789', color: '#EC4899' },
    { name: 'Tariq Saeed', branch: gulshan, email: 'tariq@kababjees.pk', pin: '3456', color: '#06B6D4' },
    { name: 'Amna Butt', branch: gulshan, email: 'amna@kababjees.pk', pin: '7890', color: '#84CC16' },
  ]

  const cashiers = await Promise.all(
    cashierNames.map(c =>
      prisma.user.create({
        data: {
          email: c.email,
          name: c.name,
          emailVerified: true,
          tenantId: tenant.id,
          branchId: c.branch.id,
          role: 'CASHIER',
          posPin: hashPin(c.pin),
          status: 'ACTIVE',
          avatarColor: c.color,
          phone: `+92-300-${randomBetween(1000000, 9999999)}`,
        }
      })
    )
  )

  // Waiters
  const waiterNames = [
    { name: 'Khalid Mehmood', branch: clifton, email: 'khalid@kababjees.pk' },
    { name: 'Rabia Noor', branch: defence, email: 'rabia@kababjees.pk' },
    { name: 'Hamza Iqbal', branch: gulshan, email: 'hamza@kababjees.pk' },
  ]
  const waiters = await Promise.all(
    waiterNames.map(w =>
      prisma.user.create({
        data: {
          email: w.email,
          name: w.name,
          emailVerified: true,
          tenantId: tenant.id,
          branchId: w.branch.id,
          role: 'CASHIER',
          posPin: hashPin('1111'),
          status: 'ACTIVE',
          avatarColor: '#64748B',
        }
      })
    )
  )

  // Riders
  const riderNames = [
    { name: 'Ahmed Rider', branch: clifton, email: 'rider1@kababjees.pk' },
    { name: 'Sami Delivery', branch: defence, email: 'rider2@kababjees.pk' },
  ]
  const riders = await Promise.all(
    riderNames.map(r =>
      prisma.user.create({
        data: {
          email: r.email,
          name: r.name,
          emailVerified: true,
          tenantId: tenant.id,
          branchId: r.branch.id,
          role: 'RIDER',
          posPin: hashPin('9999'),
          status: 'ACTIVE',
          avatarColor: '#EF4444',
        }
      })
    )
  )

  console.log(`✅ Users: 1 admin, 2 managers, ${cashiers.length} cashiers, ${waiters.length} waiters, ${riders.length} riders`)

  // ── MENU CATEGORIES ─────────────────────────────────────────────────────────
  const categoryData = [
    { name: 'Kababs & BBQ', sortOrder: 1 },
    { name: 'Karahi & Handi', sortOrder: 2 },
    { name: 'Biryani & Rice', sortOrder: 3 },
    { name: 'Burgers & Sandwiches', sortOrder: 4 },
    { name: 'Pizza', sortOrder: 5 },
    { name: 'Breads & Sides', sortOrder: 6 },
    { name: 'Soups & Salads', sortOrder: 7 },
    { name: 'Beverages', sortOrder: 8 },
    { name: 'Desserts', sortOrder: 9 },
  ]

  const categories = await Promise.all(
    categoryData.map(c =>
      prisma.category.create({ data: { ...c, tenantId: tenant.id } })
    )
  )
  const [catKabab, catKarahi, catBiryani, catBurger, catPizza, catBread, catSoup, catBev, catDessert] = categories
  console.log(`✅ ${categories.length} menu categories`)

  // ── MENU ITEMS ───────────────────────────────────────────────────────────────
  const itemsData = [
    // Kababs
    { catId: catKabab.id, name: 'Seekh Kabab', price: 650, desc: 'Juicy minced beef kababs grilled on skewers with aromatic spices' },
    { catId: catKabab.id, name: 'Chicken Tikka', price: 850, desc: 'Tender chicken marinated in yogurt and spices, char-grilled to perfection' },
    { catId: catKabab.id, name: 'Beef Boti Kabab', price: 900, desc: 'Succulent chunks of beef marinated and slow-grilled' },
    { catId: catKabab.id, name: 'Chapli Kabab', price: 700, desc: 'Peshawari-style flat beef patty with pomegranate seeds' },
    { catId: catKabab.id, name: 'Mixed Grill Platter', price: 1800, desc: 'A generous assortment of our signature kababs and tikkas' },
    // Karahi
    { catId: catKarahi.id, name: 'Chicken Karahi', price: 1200, desc: 'Classic wok-cooked chicken with tomatoes and green chilies' },
    { catId: catKarahi.id, name: 'Mutton Karahi', price: 1800, desc: 'Slow-cooked tender mutton in a rich tomato-based gravy' },
    { catId: catKarahi.id, name: 'Beef Handi', price: 1600, desc: 'Aromatic slow-cooked beef in clay pot with whole spices' },
    { catId: catKarahi.id, name: 'Peshawari Karahi', price: 1400, desc: 'White karahi with cream and minimal spices, Peshawar style' },
    // Biryani
    { catId: catBiryani.id, name: 'Chicken Biryani', price: 450, desc: 'Fragrant basmati rice layered with tender chicken and aromatic spices' },
    { catId: catBiryani.id, name: 'Mutton Biryani', price: 650, desc: 'Royal biryani with slow-cooked mutton and saffron-infused rice' },
    { catId: catBiryani.id, name: 'Beef Biryani', price: 550, desc: 'Classic karachi-style beef biryani with aloo' },
    { catId: catBiryani.id, name: 'Sindhi Biryani', price: 500, desc: 'Spicy Sindhi-style biryani with dried plums and potatoes' },
    // Burgers
    { catId: catBurger.id, name: 'Classic Beef Burger', price: 550, desc: 'Juicy beef patty with lettuce, tomato, and special sauce' },
    { catId: catBurger.id, name: 'Zinger Burger', price: 450, desc: 'Crispy spicy chicken with coleslaw and zinger sauce' },
    { catId: catBurger.id, name: 'Double Patty Burger', price: 750, desc: 'Double beef patties with cheese, pickles, and signature sauce' },
    { catId: catBurger.id, name: 'Grilled Chicken Burger', price: 500, desc: 'Healthy grilled chicken with avocado and garlic aioli' },
    // Pizza
    { catId: catPizza.id, name: 'Margherita Pizza', price: 900, desc: 'Classic tomato base with fresh mozzarella and basil' },
    { catId: catPizza.id, name: 'BBQ Chicken Pizza', price: 1100, desc: 'Tangy BBQ sauce with grilled chicken and caramelized onions' },
    { catId: catPizza.id, name: 'Pepperoni Pizza', price: 1050, desc: 'Loaded with premium pepperoni and mozzarella' },
    // Breads
    { catId: catBread.id, name: 'Naan', price: 60, desc: 'Traditional tandoor-baked leavened bread' },
    { catId: catBread.id, name: 'Roghni Naan', price: 80, desc: 'Buttery naan topped with sesame seeds' },
    { catId: catBread.id, name: 'French Fries', price: 250, desc: 'Crispy golden fries seasoned with special spices' },
    { catId: catBread.id, name: 'Raita', price: 120, desc: 'Cool yogurt dip with cucumber and mint' },
    // Soups
    { catId: catSoup.id, name: 'Lentil Soup', price: 280, desc: 'Hearty red lentil soup with a touch of cumin' },
    { catId: catSoup.id, name: 'Chicken Corn Soup', price: 320, desc: 'Chinese-style chicken and sweet corn soup' },
    // Beverages
    { catId: catBev.id, name: 'Rooh Afza Drink', price: 150, desc: 'Traditional rose-flavored chilled drink' },
    { catId: catBev.id, name: 'Mango Lassi', price: 200, desc: 'Thick mango-flavored yogurt drink' },
    { catId: catBev.id, name: 'Cola (Bottle)', price: 120, desc: 'Chilled carbonated soft drink' },
    { catId: catBev.id, name: 'Mineral Water', price: 80, desc: 'Chilled mineral water 500ml' },
    // Desserts
    { catId: catDessert.id, name: 'Gulab Jamun', price: 180, desc: 'Soft milk-solid dumplings in rose-scented sugar syrup' },
    { catId: catDessert.id, name: 'Kheer', price: 220, desc: 'Creamy rice pudding with cardamom and pistachios' },
    { catId: catDessert.id, name: 'Brownie with Ice Cream', price: 350, desc: 'Warm chocolate brownie with vanilla ice cream' },
  ]

  const items = await Promise.all(
    itemsData.map((it, i) =>
      prisma.item.create({
        data: {
          tenantId: tenant.id,
          categoryId: it.catId,
          name: it.name,
          description: it.desc,
          basePrice: it.price,
          isAvailable: true,
          sortOrder: i,
        }
      })
    )
  )
  console.log(`✅ ${items.length} menu items`)

  // ── VARIATIONS ───────────────────────────────────────────────────────────────
  // Add variations to key items
  const chickenKarahi = items.find(i => i.name === 'Chicken Karahi')!
  const muttonKarahi = items.find(i => i.name === 'Mutton Karahi')!
  const chickenBiryani = items.find(i => i.name === 'Chicken Biryani')!
  const cola = items.find(i => i.name === 'Cola (Bottle)')!
  const margherita = items.find(i => i.name === 'Margherita Pizza')!
  const bbqPizza = items.find(i => i.name === 'BBQ Chicken Pizza')!

  await prisma.variation.createMany({
    data: [
      { itemId: chickenKarahi.id, name: 'Half', price: 700 },
      { itemId: chickenKarahi.id, name: 'Full', price: 1200 },
      { itemId: muttonKarahi.id, name: 'Half', price: 1100 },
      { itemId: muttonKarahi.id, name: 'Full', price: 1800 },
      { itemId: chickenBiryani.id, name: 'Single', price: 450 },
      { itemId: chickenBiryani.id, name: 'Family (4 persons)', price: 1600 },
      { itemId: cola.id, name: 'Regular (330ml)', price: 80 },
      { itemId: cola.id, name: 'Large (1.5L)', price: 180 },
      { itemId: margherita.id, name: 'Small 8"', price: 700 },
      { itemId: margherita.id, name: 'Medium 10"', price: 900 },
      { itemId: margherita.id, name: 'Large 12"', price: 1150 },
      { itemId: bbqPizza.id, name: 'Small 8"', price: 850 },
      { itemId: bbqPizza.id, name: 'Medium 10"', price: 1100 },
      { itemId: bbqPizza.id, name: 'Large 12"', price: 1350 },
    ]
  })

  // Add-ons
  const zingerBurger = items.find(i => i.name === 'Zinger Burger')!
  const classicBurger = items.find(i => i.name === 'Classic Beef Burger')!
  await prisma.addOn.createMany({
    data: [
      { itemId: zingerBurger.id, name: 'Extra Cheese', price: 80 },
      { itemId: zingerBurger.id, name: 'Extra Patty', price: 150 },
      { itemId: classicBurger.id, name: 'Extra Cheese', price: 80 },
      { itemId: classicBurger.id, name: 'Bacon', price: 120 },
      { itemId: classicBurger.id, name: 'Avocado', price: 100 },
    ]
  })
  console.log('✅ Variations and add-ons')

  // ── BRANCH MENU ITEMS (enable items for all active branches) ────────────────
  const activeBranches = [clifton, defence, gulshan]
  await prisma.branchMenuItem.createMany({
    data: activeBranches.flatMap(branch =>
      items.map(item => ({
        branchId: branch.id,
        itemId: item.id,
        isAvailable: true,
        isInStock: true,
      }))
    ),
    skipDuplicates: true,
  })

  await prisma.branchMenuCategory.createMany({
    data: activeBranches.flatMap(branch =>
      categories.map(cat => ({
        branchId: branch.id,
        categoryId: cat.id,
        isAvailable: true,
      }))
    ),
    skipDuplicates: true,
  })
  console.log('✅ Branch menu availability configured')

  // ── KDS STATIONS ────────────────────────────────────────────────────────────
  for (const branch of [clifton, defence, gulshan]) {
    await prisma.kdsStation.createMany({
      data: [
        { tenantId: tenant.id, branchId: branch.id, name: 'Grill Station', color: '#FF5722', displayOrder: 1 },
        { tenantId: tenant.id, branchId: branch.id, name: 'Main Kitchen', color: '#3B82F6', displayOrder: 2, catchAll: true },
        { tenantId: tenant.id, branchId: branch.id, name: 'Drinks & Desserts', color: '#10B981', displayOrder: 3 },
      ]
    })
  }
  console.log('✅ KDS stations')

  // ── INGREDIENTS ──────────────────────────────────────────────────────────────
  const ingredientData = [
    { name: 'Chicken Breast', category: 'Meat & Poultry', unit: 'KILOGRAM' as const, minThreshold: 5 },
    { name: 'Minced Beef', category: 'Meat & Poultry', unit: 'KILOGRAM' as const, minThreshold: 3 },
    { name: 'Mutton Shoulder', category: 'Meat & Poultry', unit: 'KILOGRAM' as const, minThreshold: 4 },
    { name: 'Basmati Rice', category: 'Dry Goods', unit: 'KILOGRAM' as const, minThreshold: 10 },
    { name: 'Cooking Oil', category: 'Pantry', unit: 'LITER' as const, minThreshold: 5 },
    { name: 'Tomatoes', category: 'Produce', unit: 'KILOGRAM' as const, minThreshold: 3 },
    { name: 'Onions', category: 'Produce', unit: 'KILOGRAM' as const, minThreshold: 5 },
    { name: 'Burger Buns', category: 'Bakery', unit: 'PCS' as const, minThreshold: 50 },
    { name: 'Mozzarella Cheese', category: 'Dairy', unit: 'KILOGRAM' as const, minThreshold: 2 },
    { name: 'Yogurt', category: 'Dairy', unit: 'KILOGRAM' as const, minThreshold: 3 },
    { name: 'Ginger Garlic Paste', category: 'Spices & Condiments', unit: 'KILOGRAM' as const, minThreshold: 1 },
    { name: 'Naan Dough', category: 'Bakery', unit: 'KILOGRAM' as const, minThreshold: 5 },
  ]

  const ingredients = await Promise.all(
    ingredientData.map(i =>
      prisma.ingredient.create({
        data: { ...i, tenantId: tenant.id }
      })
    )
  )

  // Stock per branch
  const stockLevels = [15, 12, 8, 25, 12, 10, 15, 120, 5, 8, 3, 12]
  for (const branch of [clifton, defence, gulshan]) {
    await prisma.stock.createMany({
      data: ingredients.map((ing, i) => ({
        tenantId: tenant.id,
        branchId: branch.id,
        ingredientId: ing.id,
        quantity: stockLevels[i] + randomBetween(-3, 5),
        reorderLevel: ing.minThreshold,
      }))
    })
  }
  console.log(`✅ ${ingredients.length} ingredients + stock levels`)

  // ── DELIVERY ZONES ────────────────────────────────────────────────────────────
  await prisma.deliveryZone.createMany({
    data: [
      {
        tenantId: tenant.id, branchId: clifton.id, name: 'Clifton Zone',
        polygon: [[67.03, 24.83], [67.05, 24.83], [67.05, 24.81], [67.03, 24.81]],
      },
      {
        tenantId: tenant.id, branchId: defence.id, name: 'DHA Zone',
        polygon: [[67.06, 24.80], [67.09, 24.80], [67.09, 24.77], [67.06, 24.77]],
      },
    ]
  })

  // ── CUSTOMERS ────────────────────────────────────────────────────────────────
  const customerData = [
    { name: 'Ahmad Khan', phone: '+92-300-1111111', email: 'ahmad.khan@gmail.com' },
    { name: 'Sara Malik', phone: '+92-300-2222222', email: 'sara.malik@gmail.com' },
    { name: 'Imran Sheikh', phone: '+92-300-3333333', email: 'imran.sheikh@gmail.com' },
    { name: 'Fatima Butt', phone: '+92-300-4444444', email: 'fatima.butt@gmail.com' },
    { name: 'Zubair Ahmed', phone: '+92-300-5555555', email: 'zubair.ahmed@gmail.com' },
    { name: 'Ayesha Siddiqui', phone: '+92-300-6666666', email: 'ayesha@gmail.com' },
    { name: 'Hassan Raza', phone: '+92-300-7777777', email: 'hassan.raza@gmail.com' },
    { name: 'Mariam Noor', phone: '+92-300-8888888', email: 'mariam.noor@gmail.com' },
  ]
  const customers = await Promise.all(
    customerData.map(c => prisma.customer.create({ data: { ...c, tenantId: tenant.id } }))
  )

  // Loyalty tiers
  await prisma.loyaltyTier.createMany({
    data: [
      { tenantId: tenant.id, name: 'Bronze', minPoints: 0, multiplier: 1 },
      { tenantId: tenant.id, name: 'Silver', minPoints: 500, multiplier: 1.5 },
      { tenantId: tenant.id, name: 'Gold', minPoints: 1500, multiplier: 2 },
      { tenantId: tenant.id, name: 'Platinum', minPoints: 5000, multiplier: 3 },
    ]
  })

  // Loyalty points
  await prisma.loyaltyPointLedger.createMany({
    data: customers.flatMap(c => [
      { tenantId: tenant.id, customerId: c.id, type: 'EARN' as const, points: randomBetween(100, 2000), note: 'Historical orders' },
    ])
  })
  console.log(`✅ ${customers.length} customers + loyalty tiers`)

  // ── SHIFTS ───────────────────────────────────────────────────────────────────
  // Create shifts for the last 30 days
  const allCashiers = [...cashiers]
  const shiftsMap: Record<string, string> = {} // branchId_day -> shiftId

  const createdShifts: Array<{ id: string; branchId: string; userId: string; openedAt: Date }> = []

  for (let day = 30; day >= 0; day--) {
    for (const branch of [clifton, defence, gulshan]) {
      const branchCashiers = allCashiers.filter(c => c.branchId === branch.id)
      if (branchCashiers.length === 0) continue
      const cashier = branchCashiers[day % branchCashiers.length]
      const openedAt = daysAgo(day, 11)
      const closedAt = new Date(openedAt)
      closedAt.setHours(closedAt.getHours() + 8)

      const isToday = day === 0
      const totalSales = randomBetween(15000, 85000)
      const totalCash = Math.floor(totalSales * 0.65)
      const totalCard = totalSales - totalCash
      const openingFloat = 5000
      const closingCash = totalCash + openingFloat + randomBetween(-200, 200)

      const shift = await prisma.shift.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          userId: cashier.id,
          status: isToday ? 'OPEN' : 'CLOSED',
          openingFloat,
          closingCash: isToday ? undefined : closingCash,
          totalSales: isToday ? undefined : totalSales,
          totalCash: isToday ? undefined : totalCash,
          totalCard: isToday ? undefined : totalCard,
          totalOrders: isToday ? undefined : randomBetween(30, 120),
          totalTax: isToday ? undefined : Math.floor(totalSales * 0.15),
          totalDiscount: isToday ? undefined : randomBetween(500, 3000),
          cashVariance: isToday ? undefined : closingCash - (openingFloat + totalCash),
          method: 'ZKTECO',
          openedAt,
          closedAt: isToday ? undefined : closedAt,
        }
      })
      createdShifts.push({ id: shift.id, branchId: branch.id, userId: cashier.id, openedAt })
      shiftsMap[`${branch.id}_${day}`] = shift.id
    }
  }
  console.log(`✅ ${createdShifts.length} shifts (30 days history + today open)`)

  // ── ORDERS (30 days of realistic orders) ─────────────────────────────────────
  const orderTypes: ('DINE_IN' | 'TAKEAWAY' | 'DELIVERY')[] = ['DINE_IN', 'TAKEAWAY', 'DELIVERY']
  const paymentMethods: ('CASH' | 'CARD' | 'ONLINE')[] = ['CASH', 'CARD', 'ONLINE']
  const orderStatuses: ('PENDING' | 'IN_KITCHEN' | 'READY' | 'DELIVERED' | 'CANCELLED')[] = [
    'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED',
    'DELIVERED', 'DELIVERED', 'DELIVERED', 'CANCELLED', 'IN_KITCHEN'
  ]

  // Popular items for realistic order distribution
  const popularItems = [
    chickenKarahi, muttonKarahi,
    items.find(i => i.name === 'Seekh Kabab')!,
    items.find(i => i.name === 'Chicken Tikka')!,
    chickenBiryani,
    items.find(i => i.name === 'Mutton Biryani')!,
    zingerBurger, classicBurger,
    items.find(i => i.name === 'Naan')!,
    items.find(i => i.name === 'French Fries')!,
    cola,
    items.find(i => i.name === 'Mango Lassi')!,
  ]

  let totalOrdersCreated = 0
  let orderCounter = 1000

  for (let day = 30; day >= 0; day--) {
    // More orders on weekends, fewer on weekdays
    const dayOfWeek = new Date(daysAgo(day)).getDay()
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 // Friday Saturday

    for (const branch of [clifton, defence, gulshan]) {
      const ordersPerDay = isWeekend ? randomBetween(60, 120) : randomBetween(30, 70)
      const shiftId = shiftsMap[`${branch.id}_${day}`]

      for (let o = 0; o < ordersPerDay; o++) {
        orderCounter++
        const hour = randomBetween(12, 23)
        const createdAt = daysAgo(day, hour)
        const orderType = orderTypes[randomBetween(0, 2)]
        const payMethod = paymentMethods[randomBetween(0, 2)]
        const status = day === 0 ? 'IN_KITCHEN' : orderStatuses[randomBetween(0, 9)]

        // Select 1-4 random items
        const numItems = randomBetween(1, 4)
        const selectedItems = []
        for (let n = 0; n < numItems; n++) {
          selectedItems.push(popularItems[randomBetween(0, popularItems.length - 1)])
        }

        let subtotal = 0
        const orderItems = selectedItems.map(item => {
          const qty = randomBetween(1, 3)
          const unitPrice = item.basePrice
          const itemSubtotal = qty * unitPrice
          subtotal += itemSubtotal
          return { itemId: item.id, quantity: qty, unitPrice, subtotal: itemSubtotal }
        })

        const discount = status !== 'CANCELLED' && Math.random() > 0.85 ? Math.floor(subtotal * 0.1) : 0
        const tax = Math.floor((subtotal - discount) * 0.15)
        const net = subtotal - discount + tax

        try {
          const order = await prisma.order.create({
            data: {
              tenantId: tenant.id,
              branchId: branch.id,
              orderNumber: `ORD-${orderCounter}`,
              tokenNumber: `T${(o + 1).toString().padStart(3, '0')}`,
              shiftId,
              status,
              type: orderType,
              totalAmount: subtotal,
              discountAmount: discount,
              taxAmount: tax,
              netAmount: net,
              createdAt,
              updatedAt: createdAt,
              items: {
                create: orderItems,
              },
              payments: {
                create: [{
                  amount: net,
                  method: payMethod,
                  status: status === 'CANCELLED' ? 'FAILED' : 'COMPLETED',
                  createdAt,
                }]
              }
            }
          })

          // Add rider assignment for delivery orders
          if (orderType === 'DELIVERY' && status === 'DELIVERED') {
            const rider = riders[randomBetween(0, riders.length - 1)]
            await prisma.riderAssignment.create({
              data: {
                tenantId: tenant.id,
                orderId: order.id,
                riderId: rider.id,
                status: 'COMPLETED',
                assignedAt: createdAt,
                pickedUpAt: new Date(createdAt.getTime() + 600000),
                completedAt: new Date(createdAt.getTime() + 1800000),
              }
            })
          }

          totalOrdersCreated++
        } catch (e) {
          // Skip duplicate errors silently
        }
      }
    }

    if (day % 5 === 0) {
      console.log(`   Orders: day ${day} complete (${totalOrdersCreated} total so far)`)
    }
  }
  console.log(`✅ ${totalOrdersCreated} orders created across 31 days`)

  // ── PURCHASE ORDERS ───────────────────────────────────────────────────────────
  const chickenIng = ingredients.find(i => i.name === 'Chicken Breast')!
  const beefIng = ingredients.find(i => i.name === 'Minced Beef')!
  const riceIng = ingredients.find(i => i.name === 'Basmati Rice')!

  await prisma.purchaseOrder.create({
    data: {
      tenantId: tenant.id,
      branchId: clifton.id,
      supplierName: 'Sysco Food Services',
      status: 'SENT',
      lines: {
        create: [
          { ingredientId: chickenIng.id, orderedQty: 20, receivedQty: 0 },
          { ingredientId: beefIng.id, orderedQty: 15, receivedQty: 0 },
        ]
      }
    }
  })

  await prisma.purchaseOrder.create({
    data: {
      tenantId: tenant.id,
      branchId: clifton.id,
      supplierName: 'Artisan Bakery Suppliers',
      status: 'RECEIVED',
      lines: {
        create: [
          { ingredientId: riceIng.id, orderedQty: 50, receivedQty: 50 },
        ]
      }
    }
  })
  console.log('✅ Purchase orders')

  // ── DEALS & PROMOS ────────────────────────────────────────────────────────────
  await prisma.promoCode.createMany({
    data: [
      {
        tenantId: tenant.id, code: 'WELCOME10',
        type: 'PERCENT', value: 10,
        minOrder: 500, isActive: true, usageLimit: 100, usedCount: 23,
      },
      {
        tenantId: tenant.id, code: 'FLAT200',
        type: 'FIXED', value: 200,
        minOrder: 1500, isActive: true, usageLimit: 50, usedCount: 12,
      },
      {
        tenantId: tenant.id, code: 'EID2026',
        type: 'PERCENT', value: 20,
        minOrder: 1000, isActive: false, usageLimit: 200, usedCount: 200,
      },
    ]
  })

  // Combo deals
  const seekhKabab = items.find(i => i.name === 'Seekh Kabab')!
  const naan = items.find(i => i.name === 'Naan')!
  const raita = items.find(i => i.name === 'Raita')!
  const mangolassi = items.find(i => i.name === 'Mango Lassi')!

  await prisma.combo.create({
    data: {
      tenantId: tenant.id,
      name: 'Kabab Family Deal',
      price: 1800,
      isActive: true,
      items: {
        create: [
          { itemId: seekhKabab.id, quantity: 2 },
          { itemId: naan.id, quantity: 4 },
          { itemId: raita.id, quantity: 2 },
          { itemId: mangolassi.id, quantity: 2 },
        ]
      }
    }
  })

  await prisma.buyXGetYDeal.create({
    data: {
      tenantId: tenant.id,
      name: 'Buy 2 Biryani Get 1 Drink Free',
      buyItemId: chickenBiryani.id,
      buyQty: 2,
      getItemId: cola.id,
      getQty: 1,
      isActive: true,
    }
  })
  console.log('✅ Deals, promos, and combos')

  // ── ZKTECO DEVICES ────────────────────────────────────────────────────────────
  await prisma.zktecoDevice.createMany({
    data: [
      {
        tenantId: tenant.id, branchId: clifton.id,
        name: 'Clifton Main Terminal', ipAddress: '192.168.1.201',
        port: 4370, status: 'ONLINE', lastSyncAt: new Date(),
      },
      {
        tenantId: tenant.id, branchId: defence.id,
        name: 'Defence Terminal', ipAddress: '192.168.2.201',
        port: 4370, status: 'OFFLINE',
      },
    ]
  })
  console.log('✅ ZKTeco devices')

  // ── FINAL SUMMARY ─────────────────────────────────────────────────────────────
  console.log('\n🎉 Seed complete!\n')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  DINEIZ GO DEMO CREDENTIALS')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  Dashboard: http://localhost:3000')
  console.log('')
  console.log('  TENANT ADMIN (Business Owner):')
  console.log('  📧 admin@kababjees.pk')
  console.log('  🔑 Admin@123456')
  console.log('')
  console.log('  BRANCH MANAGER (Clifton):')
  console.log('  📧 manager.clifton@kababjees.pk')
  console.log('  🔑 Manager@1234')
  console.log('')
  console.log('  BRANCH MANAGER (Defence):')
  console.log('  📧 manager.defence@kababjees.pk')
  console.log('  🔑 Manager@1234')
  console.log('')
  console.log('  POS Terminal: http://localhost:3001')
  console.log('  Cashiers use 4-digit PIN:')
  console.log('  👤 Ali Hassan (Clifton)    PIN: 1234')
  console.log('  👤 Zara Sheikh (Clifton)   PIN: 5678')
  console.log('  👤 Omar Farooq (Defence)   PIN: 2345')
  console.log('  👤 Fatima Malik (Defence)  PIN: 6789')
  console.log('  👤 Tariq Saeed (Gulshan)   PIN: 3456')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
  console.log('  DATA SEEDED:')
  console.log(`  ✅ 1 Tenant (Kababjees Restaurant Group)`)
  console.log(`  ✅ 4 Branches (3 active, 1 inactive)`)
  console.log(`  ✅ ${cashierNames.length + waiterNames.length + riderNames.length + 3} Staff members`)
  console.log(`  ✅ ${categories.length} Menu categories`)
  console.log(`  ✅ ${items.length} Menu items with variations & add-ons`)
  console.log(`  ✅ ${totalOrdersCreated.toLocaleString()} Orders (30 days history)`)
  console.log(`  ✅ ${createdShifts.length} Shifts`)
  console.log(`  ✅ ${customers.length} Customers with loyalty points`)
  console.log(`  ✅ ${ingredients.length} Ingredients with stock`)
  console.log('═══════════════════════════════════════════════════════')
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
