import { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middleware/auth';

// Better Auth's own catch-all (auth.routes.ts) already serves
// /api/auth/sign-out and invalidates the session server-side — no custom
// version of that needed here.
export const meRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/auth/me', { preHandler: requireAuth }, async (request) => {
    const { id, name, email, role, tenantId, branchId, avatarBg, avatarFg } = request.user!;
    return { id, name, email, role, tenantId, branchId, avatarBg, avatarFg };
  });
};
