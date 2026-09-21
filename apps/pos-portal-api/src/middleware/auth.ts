import { auth } from '../lib/auth';
import { prisma } from '@dineiz/pos-portal-db';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { User, Session } from '@dineiz/pos-portal-db';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
    session?: Session;
    scopedBranchId?: string | null;
  }
}

/**
 * Resolves the authenticated user for a request from the Better Auth session
 * cookie, with a manual cookie/Bearer-token fallback for sessions created
 * outside Better Auth's own sign-in flow (the PIN login route does this).
 * tenantId/branchId/role always come from here — never from the request body.
 */
export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  let sessionData = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });

  if (!sessionData || !sessionData.user) {
    let token: string | undefined;

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    if (!token && request.headers.cookie) {
      const match = request.headers.cookie.match(/better-auth\.session_token=([^;]+)/);
      if (match && match[1]) token = match[1];
    }

    if (token) {
      const dbSession = await prisma.session.findFirst({ where: { token }, include: { user: true } });
      if (dbSession && dbSession.user && dbSession.expiresAt > new Date()) {
        sessionData = { session: dbSession as any, user: dbSession.user as any };
      }
    }
  }

  if (!sessionData || !sessionData.user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const sessionUser = sessionData.user as any;

  try {
    const fullUser: User =
      'tenantId' in sessionUser && 'role' in sessionUser
        ? (sessionUser as User)
        : await (async () => {
            const u = await prisma.user.findUnique({ where: { id: sessionUser.id } });
            if (!u) throw new Error('USER_NOT_FOUND');
            return u;
          })();

    if (fullUser.role === 'BRANCH_MANAGER' && !fullUser.branchId) {
      return reply.status(403).send({ error: 'No branch assigned to this manager' });
    }

    request.user = fullUser;
    request.session = sessionData.session as unknown as Session;
    request.scopedBranchId = fullUser.role === 'BRANCH_MANAGER' ? fullUser.branchId : null;
  } catch (err: any) {
    if (err?.message === 'USER_NOT_FOUND') {
      return reply.status(401).send({ error: 'Unauthorized: user not found' });
    }
    request.log?.error?.({ err }, 'requireAuth: DB lookup failed');
    return reply.status(500).send({ error: 'Auth error: failed to load user' });
  }
};

export const requireRole = (roles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    if (!request.user || !roles.includes(request.user.role)) {
      return reply.status(403).send({ error: 'Forbidden: insufficient permissions' });
    }
  };
};

export const requireTenant = async (request: FastifyRequest, reply: FastifyReply) => {
  await requireAuth(request, reply);
  if (reply.sent) return;

  if (!request.user?.tenantId) {
    return reply.status(403).send({ error: 'Forbidden: no tenant assigned' });
  }
};

/** Resolves the branch a request should be scoped to: pinned for Branch
 * Managers (query param ignored). A Tenant Admin may pass `?branchId=` to
 * view a specific branch, but only one that actually belongs to their own
 * tenant — checked here, not assumed. Every other role is always locked to
 * their own assigned branch; the query param is never even read for them.
 * Never trusts a branchId from the request body. */
export async function resolveBranchId(request: FastifyRequest): Promise<string | null> {
  if (request.scopedBranchId) return request.scopedBranchId;
  if (!request.user) return null;

  if (request.user.role === 'TENANT_ADMIN') {
    const query = request.query as { branchId?: string };
    if (query?.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: query.branchId }, select: { tenantId: true } });
      return branch && branch.tenantId === request.user.tenantId ? query.branchId : null;
    }
  }

  return request.user.branchId ?? null;
}
