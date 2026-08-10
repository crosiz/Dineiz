import { prisma } from '@dineiz/db';
import { syncOrdersToErpNext } from '../lib/erp';

type ErpSyncJob = {
  tenantId: string;
};

export async function runErpSync(job: ErpSyncJob) {
  const cfg = await prisma.erpIntegration.findUnique({ where: { tenantId: job.tenantId } });
  if (!cfg?.enabled) return { skipped: true };

  try {
    if (cfg.provider === 'ERPNEXT') {
      return await syncOrdersToErpNext(job.tenantId);
    }
    throw new Error('QuickBooks sync not implemented yet');
  } catch (err: any) {
    await prisma.erpIntegration.update({
      where: { tenantId: job.tenantId },
      data: { lastError: String(err?.message ?? err) },
    }).catch(() => {});
    throw err;
  }
}

