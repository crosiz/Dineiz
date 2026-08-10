import { getShiftReport } from './src/routes/shift/shift-report.service';
import { prisma } from '@swiftserve/db';

async function run() {
  try {
    const s = await prisma.shift.findUnique({where: {id: 'cmsf73ofv00325r3qz7r23nd3'}});
    if (!s) { console.log('no shift'); return; }
    console.log('Generating excel report...');
    await getShiftReport(s.tenantId, s.id, 'excel');
    console.log('Generating pdf report...');
    await getShiftReport(s.tenantId, s.id, 'pdf');
    console.log('success');
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
