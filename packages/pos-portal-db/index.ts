import { PrismaClient } from '@prisma/client';

// One PrismaClient for the whole process, reused across dev hot-reloads via a
// global — mirrors packages/db's pattern. Without this, tsx watch / hot
// reload spawns a fresh client (and connection pool) on every save.
const globalForPrisma = globalThis as unknown as {
  posPortalPrisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const log: ('query' | 'info' | 'warn' | 'error')[] =
    process.env.PRISMA_LOG_QUERIES === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error'];

  return new PrismaClient({ log });
}

export const prisma = globalForPrisma.posPortalPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.posPortalPrisma = prisma;

export * from '@prisma/client';
