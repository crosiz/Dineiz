import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@dineiz/pos-portal-db';
import { env } from '../env';

const trustedOrigins = [
  ...env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  'http://localhost:3012',
].filter((v, i, a) => a.indexOf(v) === i);

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => {
        const bcrypt = await import('bcrypt');
        return bcrypt.hash(password, 12);
      },
      verify: async ({ hash, password }) => {
        const bcrypt = await import('bcrypt');
        return bcrypt.compare(password, hash);
      },
    },
  },
  trustedOrigins,
  // Custom fields surfaced on the session so middleware can read them
  // without an extra DB round trip.
  user: {
    additionalFields: {
      tenantId: { type: 'string', required: false, input: false },
      branchId: { type: 'string', required: false, input: false },
      role: { type: 'string', required: false, defaultValue: 'CASHIER', input: false },
    },
  },
  // Sessions stay on Better Auth's default Prisma-backed storage — no Redis
  // dependency for pos-portal, unlike the main apps/api.
});
