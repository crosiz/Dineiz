import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@swiftserve/db";
import { mobileAuthMiddleware, MobileJwtPayload } from "../../middleware/mobileAuth.middleware";

export const mobileNotificationsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', mobileAuthMiddleware);

  // POST /api/mobile/notifications/register-device
  fastify.post(
    "/api/mobile/notifications/register-device",
    {
      schema: {
        body: z.object({
          token: z.string()
        })
      }
    },
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      const { token } = request.body as any;

      const user = await prisma.user.findUnique({
        where: { id: mobileUserReq.userId }
      });

      if (!user) return reply.status(404).send({ success: false, error: "User not found" });

      const currentTokens = new Set(user.deviceTokens || []);
      currentTokens.add(token);

      await prisma.user.update({
        where: { id: user.id },
        data: { deviceTokens: Array.from(currentTokens) }
      });

      return { success: true };
    }
  );

  // DELETE /api/mobile/notifications/register-device
  fastify.delete(
    "/api/mobile/notifications/register-device",
    {
      schema: {
        body: z.object({
          token: z.string()
        })
      }
    },
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      const { token } = request.body as any;

      const user = await prisma.user.findUnique({
        where: { id: mobileUserReq.userId }
      });

      if (!user) return reply.status(404).send({ success: false, error: "User not found" });

      const currentTokens = (user.deviceTokens || []).filter(t => t !== token);

      await prisma.user.update({
        where: { id: user.id },
        data: { deviceTokens: currentTokens }
      });

      return { success: true };
    }
  );
};
