import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@dineiz/db';
import { createBranchSchema, updateBranchSchema } from '@dineiz/schemas';
import { listBranches, createBranch, updateBranch, toggleBranchStatus, deleteBranch } from './branches.service';

export async function handleListBranches(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;

  // BRANCH_MANAGER: return only their own branch so dropdowns work for them too
  if (request.user!.role === 'BRANCH_MANAGER') {
    const branchId = request.user!.branchId;
    if (!branchId) {
      return reply.send({ branches: [], summary: { total: 0, active: 0, inactive: 0, primaryCity: 'N/A' } });
    }
    const branch = await prisma.branch.findUnique({
      where: { id: branchId, tenantId, deletedAt: null },
      select: { id: true, name: true, city: true, isActive: true, colorHex: true, initial: true, branchCode: true }
    });
    return reply.send({
      branches: branch ? [branch] : [],
      summary: {
        total: branch ? 1 : 0,
        active: branch?.isActive ? 1 : 0,
        inactive: branch?.isActive ? 0 : 1,
        primaryCity: branch?.city || 'N/A'
      }
    });
  }

  // TENANT_ADMIN / SUPER_ADMIN: return all branches with stats
  const result = await listBranches(tenantId);
  return reply.send(result);
}

export async function handleCreateBranch(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;

  const parsed = createBranchSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Validation failed',
      issues: parsed.error.format()
    });
  }
  const body = parsed.data;

  try {
    const branch = await createBranch(tenantId, body);
    return reply.status(201).send({ branch });
  } catch (err: any) {
    if (err.isLimitError) {
      return reply.status(403).send(err);
    }
    throw err;
  }
}

export async function handleUpdateBranch(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const { id } = request.params as { id: string };

  const parsed = updateBranchSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Validation failed',
      issues: parsed.error.format()
    });
  }
  const body = parsed.data;

  const branch = await updateBranch(tenantId, id, body);
  return reply.send({ branch });
}

export async function handleToggleBranchStatus(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const { id } = request.params as { id: string };

  const result = await toggleBranchStatus(tenantId, id);
  return reply.send(result);
}

export async function handleDeleteBranch(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const { id } = request.params as { id: string };

  try {
    await deleteBranch(tenantId, id);
    return reply.send({ success: true });
  } catch (err: any) {
    if (err.isConflict) {
      return reply.status(409).send({
        error: 'CONFLICT',
        message: err.message
      });
    }
    throw err;
  }
}
