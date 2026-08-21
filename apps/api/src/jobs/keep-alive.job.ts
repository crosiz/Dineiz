import { prisma } from '@dineiz/db';

export async function startKeepAlive() {
  if (process.env.NODE_ENV !== 'production') {
    // In development, ping every 4 minutes to prevent Neon suspension
    setInterval(async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        console.log('[KeepAlive] Database pinged');
      } catch (err) {
        console.error('[KeepAlive] Ping failed:', err);
      }
    }, 4 * 60 * 1000); // every 4 minutes
  }
}
