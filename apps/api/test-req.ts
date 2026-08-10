import { prisma } from '@swiftserve/db';

async function run() {
  const session = await prisma.session.findFirst({orderBy:{createdAt:'desc'}});
  
  const token = session!.token;
  
  const res = await fetch('http://localhost:4000/api/shifts/cmsf73ofv00325r3qz7r23nd3/report?format=excel', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  
  const text = await res.text();
  console.log('STATUS:', res.status);
  console.log('RESPONSE:', text);
  
  await prisma.$disconnect();
}
run();
