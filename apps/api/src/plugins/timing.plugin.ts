import fp from 'fastify-plugin';

export const timingPlugin = fp(async (fastify) => {
  const SLOW_REQUEST_THRESHOLD_MS = 1000; // alert on requests over 1 second

  fastify.addHook('onResponse', async (req, reply) => {
    const duration = reply.elapsedTime;

    // Log slow requests
    if (duration > SLOW_REQUEST_THRESHOLD_MS) {
      console.warn(`[SLOW] ${req.method} ${req.url} took ${Math.round(duration)}ms`, {
        userId: (req.user as any)?.userId,
        tenantId: (req.user as any)?.tenantId,
        duration,
        statusCode: reply.statusCode,
      });
    }
  });
});
