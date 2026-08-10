import type { NextConfig } from 'next';

// PWA configuration is managed at runtime via next-pwa
// next-pwa does not have official TS types — use require()
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  transpilePackages: ['@swiftserve/ui', '@swiftserve/schemas'],
};

export default withPWA(nextConfig);
