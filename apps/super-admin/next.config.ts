import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@dineiz/ui', '@dineiz/schemas', '@dineiz/db'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;
