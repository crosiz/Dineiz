import { FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from './auth';

const TENANT_ADMIN_ONLY_ROUTES = [
  '/api/deals',
  '/api/crm',
  '/api/loyalty',
  '/api/integrations',
  '/api/fleet',
  '/api/settings/branding',
  '/api/settings/billing',
  '/api/analytics/cross-branch'
];

export const rbacMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  // We only run this on /api routes
  if (!request.url.startsWith('/api')) return;

  const path = request.url.split('?')[0];

  let isProtected = TENANT_ADMIN_ONLY_ROUTES.some(r => path.startsWith(r));

  // Special case for branches: POST and DELETE require admin. GET is shared.
  if (path.startsWith('/api/branches') && ['POST', 'DELETE', 'PATCH'].includes(request.method)) {
    isProtected = true;
  }

  // Special case for staff: generic admin access is protected, but POST might be allowed for managers (to add staff to their branch).
  // Wait, the requirement says "POST for BRANCH_MANAGER is allowed but restricted by logic inside"
  // So we only restrict GET /api/staff if it's meant to be global, but /api/staff is shared if branchId is provided.
  // Actually, we don't protect /api/staff globally here because the handlers check the branch context.
  
  // If the route is not in the protected map, we let the route's own handlers do standard auth
  if (!isProtected) return;

  // Make sure the user is authenticated
  await requireAuth(request, reply);
  if (reply.sent) return;

  if (request.user?.role === 'BRANCH_MANAGER') {
    return reply.status(403).send({
      error: 'INSUFFICIENT_PERMISSIONS',
      message: 'You do not have permission to access this resource.'
    });
  }
};
