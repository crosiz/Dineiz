import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@dineiz/db";
import { mobileAuthMiddleware, MobileJwtPayload } from "../../middleware/mobileAuth.middleware";
import { v2 as cloudinary } from 'cloudinary';

export const mobileMenuRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', mobileAuthMiddleware);

  // GET /api/mobile/menu
  fastify.get(
    "/api/mobile/menu",
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      if (!mobileUserReq.tenantId) return reply.status(400).send({ success: false, error: "No tenant linked" });

      const categories = await prisma.category.findMany({
        where: { tenantId: mobileUserReq.tenantId },
        include: {
          items: true,
        }
      });

      return { success: true, data: categories };
    }
  );

  // GET /api/mobile/menu/items
  fastify.get(
    "/api/mobile/menu/items",
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      if (!mobileUserReq.tenantId) return reply.status(400).send({ success: false, error: "No tenant linked" });

      const items = await prisma.item.findMany({
        where: { tenantId: mobileUserReq.tenantId },
        include: { category: true }
      });

      return { success: true, data: items };
    }
  );

  // GET /api/mobile/menu/categories
  fastify.get(
    "/api/mobile/menu/categories",
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      if (!mobileUserReq.tenantId) return reply.status(400).send({ success: false, error: "No tenant linked" });

      const categories = await prisma.category.findMany({
        where: { tenantId: mobileUserReq.tenantId }
      });
      return { success: true, data: categories };
    }
  );

  // POST /api/mobile/menu/categories
  fastify.post(
    "/api/mobile/menu/categories",
    {
      schema: {
        body: z.object({
          name: z.string()
        })
      }
    },
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      if (!mobileUserReq.tenantId) return reply.status(400).send({ success: false, error: "No tenant linked" });

      const category = await prisma.category.create({
        data: {
          tenantId: mobileUserReq.tenantId,
          name: (request.body as any).name
        }
      });
      
      // Auto-link to branch
      const branches = await prisma.branch.findMany({ where: { tenantId: mobileUserReq.tenantId } });
      for (const b of branches) {
        await prisma.branchMenuCategory.create({
          data: { branchId: b.id, categoryId: category.id, isAvailable: true }
        });
      }

      return { success: true, data: category };
    }
  );

  // POST /api/mobile/menu/items
  fastify.post(
    "/api/mobile/menu/items",
    {
      schema: {
        body: z.object({
          name: z.string(),
          basePrice: z.number(),
          categoryId: z.string(),
          isAvailable: z.boolean().default(true),
          description: z.string().optional()
        })
      }
    },
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      if (!mobileUserReq.tenantId) return reply.status(400).send({ success: false, error: "No tenant linked" });
      const { name, basePrice, categoryId, isAvailable, description } = request.body as any;

      const item = await prisma.item.create({
        data: {
          tenantId: mobileUserReq.tenantId,
          categoryId,
          name,
          basePrice,
          isAvailable,
          description
        }
      });

      // Optionally auto-link to branches
      try {
        const branches = await prisma.branch.findMany({ where: { tenantId: mobileUserReq.tenantId } });
        for (const b of branches) {
          await prisma.branchMenuItem.upsert({
            where: { branchId_itemId: { branchId: b.id, itemId: item.id } },
            create: {
              branchId: b.id,
              itemId: item.id,
              isAvailable: true,
              isInStock: true,
              overridePrice: basePrice
            },
            update: {
              overridePrice: basePrice,
              isAvailable: true
            }
          }).catch(() => {});
        }
      } catch (e) {
        console.warn("Branch menu item auto-link warning:", e);
      }

      return { success: true, data: item };
    }
  );

  // PUT /api/mobile/menu/items/:id
  fastify.put(
    "/api/mobile/menu/items/:id",
    {
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().optional(),
          basePrice: z.number().optional(),
          isAvailable: z.boolean().optional(),
          categoryId: z.string().optional(),
        })
      }
    },
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      const { id } = request.params;
      
      const item = await prisma.item.update({
        where: { id, tenantId: mobileUserReq.tenantId! },
        data: request.body
      });
      return { success: true, data: item };
    }
  );

  // DELETE /api/mobile/menu/items/:id
  fastify.delete(
    "/api/mobile/menu/items/:id",
    {
      schema: { params: z.object({ id: z.string() }) }
    },
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      const { id } = request.params;
      
      await prisma.item.delete({
        where: { id, tenantId: mobileUserReq.tenantId! }
      });
      return { success: true };
    }
  );

  // POST /api/mobile/menu/items/:id/image
  fastify.post(
    "/api/mobile/menu/items/:id/image",
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      const { id } = request.params as { id: string };

      const data = await request.file();
      if (!data) return reply.status(400).send({ success: false, error: "No file uploaded" });

      const buffer = await data.toBuffer();
      
      const uploadPromise = new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: 'dineiz/items' }, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }).end(buffer);
      });

      const uploadResult = await uploadPromise as any;
      const image = uploadResult.secure_url;

      await prisma.item.update({
        where: { id, tenantId: mobileUserReq.tenantId! },
        data: { image }
      });

      return { success: true, image };
    }
  );
};
