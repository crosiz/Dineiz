import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const phoneMap = new Map();
  
  for (const user of users) {
    let currentPhone = user.phone;
    
    // Convert empty strings to null or unique
    if (currentPhone === "") {
       currentPhone = "empty-" + Math.floor(Math.random() * 100000);
       await prisma.user.update({
         where: { id: user.id },
         data: { phone: currentPhone }
       });
       console.log("Updated empty phone to " + currentPhone);
    }
    
    if (currentPhone) {
      if (phoneMap.has(currentPhone)) {
        // duplicate phone found
        const newPhone = currentPhone + '-' + Math.floor(Math.random() * 10000);
        await prisma.user.update({
          where: { id: user.id },
          data: { phone: newPhone }
        });
        console.log("Updated duplicate phone for user " + user.id + " to " + newPhone);
      } else {
        phoneMap.set(currentPhone, true);
      }
    }
  }
  console.log("Finished resolving duplicate phones. Total processed: " + users.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
