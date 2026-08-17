import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@dineiz/db";
import { upstash } from "./redis";
import { sendPasswordResetEmail } from "./email.service";

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
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
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
        },
        // resetPasswordTokenExpiresIn defaults to 3600s (1hr) — keep the
        // email's "expires in" copy in sync with that if this changes.
        sendResetPassword: async ({ user, url }) => {
            await sendPasswordResetEmail({
                to: user.email,
                name: user.name,
                resetUrl: url,
                expiresInMinutes: 60,
            });
        },
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

    // Uses Upstash's REST client (HTTPS per call) rather than a persistent
    // ioredis/TCP connection. Sessions live only here (no DB fallback — see
    // storeInDb handling in better-auth's internal adapter), so this needs
    // to be the reliable path; a stateless HTTPS call per command sidesteps
    // long-lived-socket resets that a persistent TCP connection is prone to.
    // The REST client auto-JSON-parses values on get(), but better-auth
    // expects the raw string it stored — re-stringify non-string results.
    secondaryStorage: {
        get: async (key) => {
            const value = await upstash.get<unknown>(key);
            if (value === null || value === undefined) return null;
            return typeof value === "string" ? value : JSON.stringify(value);
        },
        set: async (key, value, ttl) => {
            if (ttl) {
                await upstash.set(key, value, { ex: ttl });
            } else {
                await upstash.set(key, value);
            }
        },
        delete: async (key) => {
            await upstash.del(key);
        }
    }
});
