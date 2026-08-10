const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const activeOrders = await prisma.order.findMany({
    where: {
      status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] },
      type: 'DINE_IN',
      tableId: { not: null }
    },
    include: { table: true }
  });
  
  if (activeOrders.length === 0) {
    console.log('No active orders on tables found.');
    return;
  }
  
  console.log(`Found ${activeOrders.length} active orders on tables:`);
  activeOrders.forEach(o => {
    console.log(`Order ID: ${o.id}, Status: ${o.status}, Table: ${o.table?.label}, Total: ${o.total}`);
  });
  
  for (const o of activeOrders) {
    console.log(`Cancelling ghost order ${o.id} on table ${o.table?.label}`);
    await prisma.order.update({
      where: { id: o.id },
      data: { status: 'CANCELLED', tableId: null }
    });
    if (o.tableId) {
      await prisma.table.update({
        where: { id: o.tableId },
        data: { status: 'FREE' }
      });
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
