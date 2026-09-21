import type { NextConfig } from 'next';

const API_ORIGIN = process.env.POS_PORTAL_API_ORIGIN ?? 'http://localhost:4010';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Proxies browser calls to the separate pos-portal-api through this app's
  // own origin, so Better Auth's session cookie (set by a cross-origin
  // response) lands as a same-origin cookie the browser will actually send
  // back — and that middleware.ts can actually read.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
