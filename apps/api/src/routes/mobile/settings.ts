import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@dineiz/db";
import { mobileAuthMiddleware, MobileJwtPayload } from "../../middleware/mobileAuth.middleware";

export const mobileSettingsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', mobileAuthMiddleware);

  // GET /api/mobile/settings
  fastify.get(
    "/api/mobile/settings",
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      if (!mobileUserReq.tenantId) return reply.status(400).send({ success: false, error: "No tenant linked" });

      const branch = await prisma.branch.findFirst({
        where: { tenantId: mobileUserReq.tenantId }
      });

      return { 
        success: true, 
        data: {
          taxRate: branch?.taxRate || 0,
          receiptFooter: "",
          receiptHeader: "",
        }
      };
    }
  );

  // PUT /api/mobile/settings
  fastify.put(
    "/api/mobile/settings",
    {
      schema: {
        body: z.object({
          taxRate: z.number().optional(),
          receiptFooter: z.string().optional(),
          receiptHeader: z.string().optional(),
        })
      }
    },
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      if (!mobileUserReq.tenantId) return reply.status(400).send({ success: false, error: "No tenant linked" });

      const data = request.body as any;

      const branch = await prisma.branch.findFirst({
        where: { tenantId: mobileUserReq.tenantId }
      });

      if (branch && data.taxRate !== undefined) {
        await prisma.branch.update({
          where: { id: branch.id },
          data: { taxRate: data.taxRate }
        });
      }

      return { success: true, data: { ...data } };


    }
  );

  // PUT /api/mobile/settings/branding
  fastify.put(
    "/api/mobile/settings/branding",
    {
      schema: {
        body: z.object({
          restaurantName: z.string().optional(),
          phone: z.string().optional(),
          city: z.string().optional(),
          businessType: z.string().optional(),
          dineinTaxRate: z.number().optional(),
          receiptFooterMessage: z.string().optional(),
        })
      }
    },
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      if (!mobileUserReq.tenantId) return reply.status(400).send({ success: false, error: "No tenant linked" });

      const data = request.body as any;

      // Update Tenant fields directly
      await prisma.tenant.update({
        where: { id: mobileUserReq.tenantId },
        data: {
          name: data.restaurantName !== undefined ? data.restaurantName : undefined,
          primaryPhone: data.phone !== undefined ? data.phone : undefined,
        }
      });

      // Update Branch fields directly for city
      const branch = await prisma.branch.findFirst({
        where: { tenantId: mobileUserReq.tenantId }
      });
      if (branch && data.city !== undefined) {
        await prisma.branch.update({
          where: { id: branch.id },
          data: { city: data.city }
        });
      }

      // Find branding
      const branding = await prisma.tenantBranding.findUnique({ where: { tenantId: mobileUserReq.tenantId } });

      if (branding) {
        await prisma.tenantBranding.update({
          where: { tenantId: mobileUserReq.tenantId },
          data: {
            restaurantName: data.restaurantName !== undefined ? data.restaurantName : undefined,
            phone: data.phone !== undefined ? data.phone : undefined,
            businessType: data.businessType !== undefined ? data.businessType : undefined,
            dineinTaxRate: data.dineinTaxRate !== undefined ? data.dineinTaxRate : undefined,
            receiptFooter: data.receiptFooterMessage !== undefined ? data.receiptFooterMessage : undefined,
          }
        });
      } else {
        await prisma.tenantBranding.create({
          data: {
            tenantId: mobileUserReq.tenantId,
            restaurantName: data.restaurantName || "Dineiz Go",
            phone: data.phone || "",
            businessType: data.businessType || "",
            dineinTaxRate: data.dineinTaxRate || 0,
            receiptFooter: data.receiptFooterMessage || "",
          }
        });
      }

      return { success: true, data: { ...data } };
    }
  );
};
