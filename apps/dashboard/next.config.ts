import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@dineiz/ui', '@dineiz/schemas'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Don't ship browser source maps for the production build — they roughly
  // double the static payload and aren't needed by end users.
  productionBrowserSourceMaps: false,
  experimental: {
    // Barrel-file optimization: import only the icons/pieces actually used
    // from these large packages instead of pulling the whole module graph
    // into every route that touches one symbol.
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns', '@observablehq/plot'],
  },
};

export default nextConfig;
