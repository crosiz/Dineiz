import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get first tenant and branch
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.log('No tenant found');
    return;
  }
  
  const branch = await prisma.branch.findFirst({ where: { tenantId: tenant.id } });
  if (!branch) {
    console.log('No branch found');
    return;
  }

  const staff = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
  const cashierId = staff?.id || 'temp'; // Usually it's optional or we have a user

  const menuItems = await prisma.item.findMany({ 
    where: { category: { tenantId: tenant.id } },
    take: 10
  });

  if (menuItems.length === 0) {
    console.log('No menu items found. Generating basic menu items first...');
    // We should have menu items, if not, script might fail
    return;
  }

  const orderTypes = ['DINE_IN', 'TAKEAWAY', 'DELIVERY'];
  const paymentMethods = ['CASH', 'CARD'];

  // Generate for past 20 days
  const today = new Date();
  let totalOrdersCreated = 0;

  for (let i = 20; i >= 0; i--) {
    const targetDate = new Date();
    targetDate.setDate(today.getDate() - i);
    
    // Create 5 to 20 orders per day
    const numOrders = Math.floor(Math.random() * 16) + 5;
    
    for (let j = 0; j < numOrders; j++) {
      // Random hour between 10 AM and 10 PM
      const hour = Math.floor(Math.random() * 13) + 10;
      const minute = Math.floor(Math.random() * 60);
      
      const orderDate = new Date(targetDate);
      orderDate.setHours(hour, minute, 0, 0);

      // Random items
      const numItems = Math.floor(Math.random() * 3) + 1;
      let totalAmount = 0;
      const orderItems = [];

      for (let k = 0; k < numItems; k++) {
        const item = menuItems[Math.floor(Math.random() * menuItems.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        const price = item.basePrice * qty;
        totalAmount += price;

        orderItems.push({
          itemId: item.id,
          quantity: qty,
          unitPrice: item.basePrice,
          subtotal: price
        });
      }

      await prisma.order.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          type: orderTypes[Math.floor(Math.random() * orderTypes.length)] as any,
          status: 'COMPLETED',
          totalAmount: totalAmount,
          netAmount: totalAmount,
          orderNumber: Math.random().toString(36).substring(2, 8).toUpperCase(),
          createdAt: orderDate,
          updatedAt: orderDate,
          items: {
            create: orderItems
          }
        }
      });
      totalOrdersCreated++;
    }
    console.log(`Day -${i} (${targetDate.toDateString()}): Generated ${numOrders} orders.`);
  }

  console.log(`Successfully generated ${totalOrdersCreated} historical orders!`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
