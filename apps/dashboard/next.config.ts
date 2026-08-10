import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@swiftserve/ui', '@swiftserve/schemas'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;
