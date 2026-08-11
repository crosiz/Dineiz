import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      }
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },
  experimental: {
    mdxRs: true,
    optimizeCss: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      }
    ];
  },
  async redirects() {
    return [
      {
        source: '/signup',
        destination: 'https://wa.me/923141986044?text=Hi%2C%20I%20am%20interested%20in%20starting%20a%20free%20trial%20of%20Dineiz%20POS.',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
