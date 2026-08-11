import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
