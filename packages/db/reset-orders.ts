import { PrismaClient, OrderStatus, OrderType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing orders...');
  await prisma.order.deleteMany({});
  console.log('Deleted all orders');

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('No tenant found. Please seed the database first.');
    return;
  }

  const branch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id },
  });
  if (!branch) {
    console.error('No branch found. Please seed the database first.');
    return;
  }

  const mockOrders = [
    { orderNumber: 'RIEAPS', type: OrderType.DINE_IN, amount: 1900, status: OrderStatus.COMPLETED },
    { orderNumber: 'QO4LB6', type: OrderType.DINE_IN, amount: 3700, status: OrderStatus.COMPLETED },
    { orderNumber: 'U7FG0N', type: OrderType.DINE_IN, amount: 2100, status: OrderStatus.COMPLETED },
    { orderNumber: 'Q43YK0', type: OrderType.DELIVERY, amount: 1700, status: OrderStatus.COMPLETED },
    { orderNumber: 'IZRKC5', type: OrderType.TAKEAWAY, amount: 5650, status: OrderStatus.COMPLETED },
    { orderNumber: '1ZE5UX', type: OrderType.TAKEAWAY, amount: 2700, status: OrderStatus.COMPLETED },
    { orderNumber: 'ORD-1209', type: OrderType.DINE_IN, amount: 3579, status: OrderStatus.COMPLETED },
    { orderNumber: 'ORD-1208', type: OrderType.DINE_IN, amount: 5379, status: OrderStatus.IN_KITCHEN },
  ];

  console.log('Seeding mock orders...');
  let now = new Date();
  
  for (const [index, orderData] of mockOrders.entries()) {
    // Add slightly different timestamps for sorting (newer first)
    const orderDate = new Date(now.getTime() - index * 60000); 

    await prisma.order.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        orderNumber: orderData.orderNumber,
        type: orderData.type,
        status: orderData.status,
        totalAmount: orderData.amount,
        netAmount: orderData.amount,
        createdAt: orderDate,
        updatedAt: orderDate,
      },
    });
  }

  console.log('Successfully seeded mock orders!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
