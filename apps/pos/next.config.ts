import type { NextConfig } from 'next';

// The service worker is not a Next plugin. `pnpm build` runs
// scripts/generate-sw.mjs after `next build`, which writes public/sw.js from
// scripts/sw.template.js with this build's asset list baked in, and
// components/ServiceWorkerRegistrar.tsx registers it in production only.
// (next-pwa used to do this through the webpack hook, which Turbopack never
// calls, and its generated files were committed and went stale.)
const nextConfig: NextConfig = {
  distDir: process.env.POS_BUILD_DIR || '.next',
  transpilePackages: ['@dineiz/ui', '@dineiz/schemas', '@dineiz/db'],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
