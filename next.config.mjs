import { InjectManifest } from 'workbox-webpack-plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Handle PWA service worker
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    // Add Workbox service worker in production
    if (!dev && !isServer) {
      config.plugins.push(
        new InjectManifest({
          swSrc: './src/sw.js',
          swDest: '../public/sw.js',
          exclude: [/\.map$/, /manifest$/, /\.DS_Store$/],
          maximumFileSizeToCacheInBytes: 5000000,
        })
      );
    }

    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Permissions-Policy",
            value: "browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
