import { prisma } from '@swiftserve/db';

export interface AuditParams {
  superAdminId?: string | null;
  action: string;
  targetTenantId?: string | null;
  before?: any;
  after?: any;
  ipAddress?: string | null;
  notes?: string | null;
}

export async function logAuditAction(params: AuditParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        superAdminId: params.superAdminId || null,
        action: params.action,
        targetTenantId: params.targetTenantId || null,
        before: params.before ? JSON.parse(JSON.stringify(params.before)) : undefined,
        after: params.after ? JSON.parse(JSON.stringify(params.after)) : undefined,
        ipAddress: params.ipAddress || null,
        notes: params.notes || null,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
