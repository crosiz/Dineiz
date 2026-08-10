import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@swiftserve/db";
import { mobileAuthMiddleware, MobileJwtPayload } from "../../middleware/mobileAuth.middleware";
import { v2 as cloudinary } from 'cloudinary';

export const mobileRestaurantRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', mobileAuthMiddleware);

  fastify.get(
    "/api/mobile/restaurant",
    {
      schema: { response: { 200: z.any() } }
    },
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      if (!mobileUserReq.tenantId) return reply.status(400 as any).send({ success: false, error: "No tenant linked" });

      const tenant = await prisma.tenant.findUnique({
        where: { id: mobileUserReq.tenantId },
        include: {
          branding: true,
          branches: true,
        }
      });

      return { success: true, data: tenant };
    }
  );

  fastify.put(
    "/api/mobile/restaurant",
    {
      schema: {
        body: z.object({
          restaurantName: z.string().optional(),
          phone: z.string().optional(),
          businessType: z.string().optional(),
        })
      }
    },
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      if (!mobileUserReq.tenantId) return reply.status(400 as any).send({ success: false, error: "No tenant linked" });

      const data = request.body as any;

      await prisma.tenant.update({
        where: { id: mobileUserReq.tenantId },
        data: {
          name: data.restaurantName,
          primaryPhone: data.phone,
        }
      });

      const branding = {
        restaurantName: data.restaurantName,
        phone: data.phone,
      };

      // Emitting Socket.IO event would go here to notify POS
      const io = (fastify as any).io;
      if (io) {
        io.to(mobileUserReq.tenantId).emit('branding_updated', branding);
      }

      return { success: true, data: branding };
    }
  );

  fastify.post(
    "/api/mobile/restaurant/logo",
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      if (!mobileUserReq.tenantId) return reply.status(400 as any).send({ success: false, error: "No tenant linked" });

      const data = await request.file();
      if (!data) {
        return reply.status(400 as any).send({ success: false, error: "No file uploaded" });
      }

      const buffer = await data.toBuffer();
      
      const uploadPromise = new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: 'swiftserve/logos' }, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }).end(buffer);
      });

      const uploadResult = await uploadPromise as any;
      const logoUrl = uploadResult.secure_url;


      await prisma.tenant.update({
        where: { id: mobileUserReq.tenantId },
        data: { logoUrl }
      });

      return { success: true, logoUrl };
    }
  );
};
