import { PrismaClient } from '@prisma/client';

// One PrismaClient for the whole process, reused across dev hot-reloads via a
// global. Without this, `tsx watch` / Next fast-refresh spawns a fresh client
// (and a fresh connection pool) on every file save and eventually exhausts the
// database's connection limit — the "login hangs after a few edits" symptom.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Query-level logging is very chatty and measurably slows every request; keep
  // it off unless explicitly asked for. Warnings + errors are always on.
  const log: ('query' | 'info' | 'warn' | 'error')[] =
    process.env.PRISMA_LOG_QUERIES === 'true'
      ? ['query', 'warn', 'error']
      : ['warn', 'error'];

  return new PrismaClient({ log });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';
