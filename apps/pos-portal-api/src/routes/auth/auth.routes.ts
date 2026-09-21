import { FastifyPluginAsync } from 'fastify';
import { auth } from '../../lib/auth';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.all('/api/auth/*', async (request, reply) => {
    // Using auth.handler (Fetch API) avoids Fastify consuming the request
    // stream before the Node handler can read the body.
    const proto = (request.headers['x-forwarded-proto'] as string | undefined) ?? 'http';
    const host = request.headers.host ?? 'localhost';
    const url = `${proto}://${host}${request.raw.url ?? request.url}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) headers.set(key, value.join(','));
      else headers.set(key, String(value));
    }

    let body: string | undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const contentType = String(request.headers['content-type'] ?? '');
      if (contentType.includes('application/json')) {
        body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {});
      } else if (typeof request.body === 'string') {
        body = request.body;
      }
    }

    const res = await auth.handler(new Request(url, { method: request.method, headers, body }));

    reply.status(res.status);
    res.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === 'set-cookie') {
        reply.header('set-cookie', value);
      } else if (!lower.startsWith('access-control-')) {
        reply.header(key, value);
      }
    });

    const buf = Buffer.from(await res.arrayBuffer());
    return reply.send(buf);
  });
};
