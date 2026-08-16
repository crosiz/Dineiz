import type { NextConfig } from 'next';

// PWA configuration is managed at runtime via next-pwa
// next-pwa does not have official TS types — use require()
// eslint-disable-next-line @typescript-eslint/no-require-imports
//
// Kept disabled in dev intentionally: next-pwa injects itself via next.config's
// webpack() hook, which `next dev --turbopack` never invokes, so it cannot
// regenerate public/sw.js in dev regardless of this flag. Enabling it here would
// only risk registering a stale sw.js left over from a previous `next build` and
// serving cached assets instead of live dev output. Offline order storage/sync
// does not depend on this service worker — see lib/sync.ts and
// lib/syncRegistration.ts for the SW-independent mechanism used in all envs.
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  transpilePackages: ['@dineiz/ui', '@dineiz/schemas', '@dineiz/db'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withPWA(nextConfig);
