import { FastifyRequest, FastifyReply } from 'fastify';
import {
  getCurrentShift, listShifts, getShift, openShift, closeShift, addCashEntry, getShiftSummary,
  getShiftOrders, getShiftActivity, getActiveShiftStats,
  startBreak, endBreak, canCloseShift, getShiftReport,
} from './shift.service';
import { OpenShiftSchema, CloseShiftSchema, CashEntrySchema, CanCloseQuerySchema, ShiftListQuerySchema } from './shift.schema';
import { prisma } from '@dineiz/db';

/**
 * The branch a shift query is locked to, or `undefined` for "all branches".
 *
 * A TENANT_ADMIN usually *also* has a home branchId on their user row, so
 * falling back to `user.branchId` whenever no branchId param was sent silently
 * pinned them to that one branch — "All Branches" in the dashboard switcher
 * could never actually show more than one. `scopedBranchId` is the existing
 * convention for this (auth.ts sets it for BRANCH_MANAGER only); cashiers are
 * pinned here too, since they have no business reading another branch's shifts.
 */
function resolveScope(request: FastifyRequest, requestedBranchId?: string): string | undefined {
  const forced = request.scopedBranchId ?? (request.user?.role === 'CASHIER' ? request.user.branchId : null);
  return forced ?? requestedBranchId ?? undefined;
}

export async function handleGetCurrentShift(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user!;
  if (!user.branchId) return reply.status(400).send({ error: 'User has no branch assigned' });
  const shift = await getCurrentShift(user.branchId, user.tenantId!, user.id);
  return shift ?? { open: false };
}
export async function handleListShifts(request: FastifyRequest, reply: FastifyReply) {
  const parsed = ShiftListQuerySchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: 'Invalid query', issues: parsed.error.issues });
  return listShifts(request.user!.tenantId!, { ...parsed.data, branchId: resolveScope(request, parsed.data.branchId) });
}
export async function handleGetShift(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const shift = await getShift(request.user!.tenantId!, id);
  if (!shift) return reply.status(404).send({ error: 'Shift not found' });
  return shift;
}
export async function handleOpenShift(request: FastifyRequest, reply: FastifyReply) {
  const parsed = OpenShiftSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: 'Invalid body', issues: parsed.error.issues });
  const tenantId = request.user!.tenantId;
  if (!tenantId) return reply.status(403).send({ error: 'Forbidden: your account is not assigned to a tenant.' });
  try {
    const result = await openShift(tenantId, request.user!.id, parsed.data);
    if (result.conflict) return reply.status(409).send({ error: 'A shift is already open for this branch', shiftId: result.shiftId });
    return reply.status(201).send(result.shift);
  } catch (err: any) {
    request.log.error({ err }, 'Failed to open shift');
    return reply.status(500).send({ error: 'Failed to open shift', details: process.env.NODE_ENV !== 'production' ? err?.message : undefined });
  }
}
export async function handleCloseShift(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const parsed = CloseShiftSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: 'Invalid body', issues: parsed.error.issues });
  const result = await closeShift(request.user!.tenantId!, id, parsed.data);
  if (!result) return reply.status(404).send({ error: 'Open shift not found' });
  if ('error' in result) return reply.status(400).send({ error: result.error });
  return result;
}

export async function handleCanCloseShift(request: FastifyRequest, reply: FastifyReply) {
  const parsed = CanCloseQuerySchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: 'Invalid query', issues: parsed.error.issues });
  
  const result = await canCloseShift(request.user!.tenantId!, parsed.data.branchId, parsed.data.shiftId, request.user!.id);
  return result;
}
export async function handleAddCashEntry(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const parsed = CashEntrySchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: 'Invalid body', issues: parsed.error.issues });
  const entry = await addCashEntry(request.user!.tenantId!, id, parsed.data);
  if (!entry) return reply.status(404).send({ error: 'Open shift not found' });
  return reply.status(201).send(entry);
}
export async function handleGetShiftSummary(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const summary = await getShiftSummary(request.user!.tenantId!, id);
  if (!summary) return reply.status(404).send({ error: 'Shift not found' });
  return summary;
}

export async function handleGetActiveShifts(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const branchId = resolveScope(request, (request.query as Record<string, string>)?.branchId);

  const activeShifts = await prisma.shift.findMany({
    where: { tenantId, ...(branchId ? { branchId } : {}), status: 'OPEN' },
    include: {
      user: { select: { id: true, name: true, image: true, avatarColor: true } },
      branch: { select: { id: true, name: true } },
      _count: { select: { orders: true } },
    },
    orderBy: { openedAt: 'desc' }
  });

  return activeShifts;
}

export async function handleForceCloseShift(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as { actualCash?: number, notes?: string };
  
  const result = await closeShift(request.user!.tenantId!, id, {
    closingCash: body.actualCash ?? 0,
    notes: body.notes,
    denominations: []
  });

  if (!result) return reply.status(404).send({ error: 'Open shift not found' });
  return result;
}

export async function handleGetShiftOrders(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const raw = request.query as Record<string, string>;
  const page = Math.max(1, parseInt(raw.page ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(raw.limit ?? '50', 10)));
  const data = await getShiftOrders(request.user!.tenantId!, id, page, limit);
  return data;
}

export async function handleGetShiftActivity(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const raw = request.query as Record<string, string>;
  const page = Math.max(1, parseInt(raw.page ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(raw.limit ?? '20', 10)));
  const data = await getShiftActivity(request.user!.tenantId!, id, page, limit);
  if (!data) return reply.status(404).send({ error: 'Shift not found' });
  return data;
}

export async function handleGetActiveShiftStats(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const raw = request.query as Record<string, string>;
  const data = await getActiveShiftStats(tenantId, resolveScope(request, raw.branchId));
  return data;
}

export async function handleStartBreak(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as { reason?: string };
  const result = await startBreak(request.user!.tenantId!, id, request.user!.id, body?.reason);
  if ('error' in result && result.error === 'Shift not found or not open') return reply.status(404).send(result);
  return reply.status(201).send(result);
}

export async function handleEndBreak(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const result = await endBreak(request.user!.tenantId!, id, request.user!.id);
  if ('error' in result && result.error === 'Shift not found') return reply.status(404).send(result);
  return result;
}

export async function handleGetShiftReport(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const raw = request.query as Record<string, string>;
    const format = raw.format === 'excel' ? 'excel' : 'pdf';
    
    // getShiftReport implementation will be in shift.service.ts
    const { buffer, contentType, filename } = await getShiftReport(request.user!.tenantId!, id, format);
    
    if (!buffer) return reply.status(404).send({ error: 'Shift not found' });

    reply.header('Content-Type', contentType);
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(buffer);
  } catch (err: any) {
    console.error('Error generating shift report:', err);
    return reply.status(500).send({ error: 'Failed to generate report', details: err.message });
  }
}
