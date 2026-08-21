import { FastifyPluginAsync } from 'fastify';
import { requireRole } from '../../middleware/auth';
import { prisma } from '@dineiz/db';
import { upstash as redis } from '../../lib/redis';

export const perfRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/perf', { preHandler: requireRole(['SUPER_ADMIN']) }, async (req, reply) => {
    // Only accessible to super admins
    const start = Date.now();

    // Test database speed
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbTime = Date.now() - dbStart;

    // Test Redis speed
    const redisStart = Date.now();
    await redis.ping();
    const redisTime = Date.now() - redisStart;

    return reply.send({
      status: 'ok',
      database: { latencyMs: dbTime, status: dbTime < 100 ? 'fast' : dbTime < 500 ? 'slow' : 'critical' },
      redis: { latencyMs: redisTime, status: redisTime < 20 ? 'fast' : 'slow' },
      server: { uptimeSeconds: process.uptime(), memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) },
      timestamp: new Date().toISOString(),
    });
  });
};
