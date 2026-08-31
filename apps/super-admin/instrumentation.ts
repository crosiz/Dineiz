// Runs once when the Next.js server process starts (App Router's supported
// hook for this — see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation).
// Without this, super-admin has no long-lived connection to Neon of its own:
// apps/api keeps its database warm via the same kind of ping, but if
// super-admin is running without apps/api alongside it, Neon suspends after
// a few idle minutes and the next request eats a multi-second cold-start —
// or, worse, times out entirely on the first attempt.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { prisma } = await import('@dineiz/db');

  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      console.error('[KeepAlive] Database ping failed:', err);
    }
  }, 4 * 60 * 1000); // every 4 minutes — well under Neon's idle-suspend window
}
