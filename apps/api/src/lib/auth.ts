import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@swiftserve/db";
import { redis } from "./redis";

// Build the list of trusted origins from env + sensible dev defaults.
// TRUSTED_ORIGINS is a comma-separated list, e.g.:
//   TRUSTED_ORIGINS=http://localhost:3000,http://localhost:3001
const trustedOrigins = [
    ...(process.env.TRUSTED_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    // Dev defaults – dashboard, POS, and the API itself
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3001',
].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        password: {
            hash: async (password) => {
                const bcrypt = await import("bcrypt");
                return bcrypt.hash(password, 12);
            },
            verify: async ({ hash, password }) => {
                const bcrypt = await import("bcrypt");
                return bcrypt.compare(password, hash);
            }
        }
    },
    // Allow requests coming from any of our front-end apps.
    // Without this, Better Auth rejects sign-in from origins that don't
    // match BETTER_AUTH_URL, causing the "invalid origin" error.
    trustedOrigins,

    // Expose custom user fields (tenantId, branchId, role) in the session
    // so that middleware can read them without an extra DB query.
    user: {
        additionalFields: {
            tenantId: {
                type: "string",
                required: false,
                input: false, // not settable via sign-up
            },
            branchId: {
                type: "string",
                required: false,
                input: false,
            },
            role: {
                type: "string",
                required: false,
                defaultValue: "CASHIER",
                input: false,
            },
            posPin: {
                type: "string",
                required: false,
                input: false,
            },
        },
    },

    secondaryStorage: {
        get: async (key) => {
            const value = await redis.get(key);
            return value ? value : null;
        },
        set: async (key, value, ttl) => {
            if (ttl) {
                await redis.set(key, value, "EX", ttl);
            } else {
                await redis.set(key, value);
            }
        },
        delete: async (key) => {
            await redis.del(key);
        }
    }
});
