import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

// Required for neon serverless in Node environments
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
};

function createPrismaClient() {
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    return new PrismaClient({ log: ['query', 'error'] });
  }
  
  // Standard Postgres Connection (Local Docker Development)
  return new PrismaClient({
    log: ['query', 'error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client'
