import { prisma } from '@dineiz/pos-portal-db';

export async function listAggregators(branchId: string) {
  return prisma.aggregator.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
}

export async function listPaymentGateways(branchId: string) {
  return prisma.paymentGateway.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
}

export async function listWebhooks(branchId: string) {
  return prisma.webhookConfig.findMany({ where: { branchId }, orderBy: { event: 'asc' } });
}

export async function listPrinters(branchId: string) {
  return prisma.printerDevice.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
}
