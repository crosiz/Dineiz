import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { prisma } from '@swiftserve/db';
import { createTenantSchema, updateTenantSettingsSchema, createBranchSchema } from '@swiftserve/schemas';
import { requireRole, requireTenant } from '../../middleware/auth';
import { z } from 'zod';
import { emitBrandingUpdated } from '../../lib/socket';

export const tenantRoutes: FastifyPluginAsyncZod = async (fastify) => {
  
  fastify.post('/api/tenants', {
    schema: { body: createTenantSchema, response: { 201: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN'])
  }, async (request, reply) => {
    const data = (request.body as any);
    const tenant = await prisma.tenant.create({ data });
    return reply.status(201).send(tenant);
  });

  fastify.get('/api/tenants/current', {
    preHandler: requireTenant
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    return tenant;
  });

  fastify.get('/api/tenants/current/plan', {
    preHandler: requireTenant
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        featureOverrides: true,
      }
    });

    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });

    // Ensure plan is defined on the tenant model (which we added as `plan` String)
    const planId = tenant.plan || 'STARTER';
    const planDefinition = await prisma.planDefinition.findUnique({ where: { id: planId } });

    if (!planDefinition) return reply.status(404).send({ error: 'Plan definition not found' });

    return {
      plan: planDefinition,
      overrides: tenant.featureOverrides || []
    };
  });

  fastify.put('/api/tenants/current', {
    schema: { body: updateTenantSettingsSchema },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN'])
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const body = request.body as any;
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: body
    });

    if (body.settings?.branding) {
      emitBrandingUpdated(tenantId, {
        primaryColor: body.settings.branding.primaryColor,
        restaurantName: body.name || tenant.name, // Usually the tenant name or settings restaurant name
        logoUrl: body.settings.branding.logoUrl
      });
    } else if (body.name) {
      emitBrandingUpdated(tenantId, { restaurantName: body.name });
    }

    return tenant;
  });

  fastify.post('/api/tenants/register-mobile', {
    schema: {
      body: z.object({
        restaurantName: z.string().min(1),
        phone: z.string().min(1),
        businessType: z.string().optional(),
        city: z.string().optional(),
        pin: z.string().min(4)
      })
    }
  }, async (request, reply) => {
    const { restaurantName, phone, businessType, city, pin } = request.body;

    // Create Tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: restaurantName,
        colorPrimary: '#ff5722', // Default Dineiz Go primary color
      }
    });

    // Create Branch
    const branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: `${restaurantName} - Main`,
        city,
        address: '',
        phone,
      }
    });

    // Create TENANT_ADMIN user
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: 'Owner',
        email: `${phone}@swiftservego.local`, // Generate a fake email or use phone
        role: 'TENANT_ADMIN',
        posPin: pin,
        password: '', // Password not used for posPin login, but field might be required
        phone,
      }
    });

    // Create Session (like pin-login)
    const crypto = require('crypto');
    const { redis } = require('../../lib/redis');
    const SESSION_TTL_SECONDS = 12 * 60 * 60;
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    await prisma.session.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        token: sessionToken,
        expiresAt,
      }
    });

    const cookieValue = [
      `better-auth.session_token=${sessionToken}`,
      'Path=/',
      'HttpOnly',
      'SameSite=None',
      'Secure',
      `Max-Age=${SESSION_TTL_SECONDS}`,
    ].join('; ');

    reply.header('set-cookie', cookieValue);

    return {
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        branchId: user.branchId,
        posPin: user.posPin
      },
      branding: {
        restaurantName: tenant.name,
        primaryColor: tenant.colorPrimary,
        logoUrl: tenant.logoUrl
      },
    };
  });

};


