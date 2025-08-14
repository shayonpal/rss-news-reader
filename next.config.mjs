import { InjectManifest } from "workbox-webpack-plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/reader",
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  experimental: {
    typedRoutes: true,
  },
  async redirects() {
    // Only apply redirects in development to help with API path confusion
    if (process.env.NODE_ENV !== "development") {
      return [];
    }

    return [
      // Redirect common API patterns missing /reader prefix
      {
        source: "/api/:path*",
        destination: "/reader/api/:path*",
        permanent: false,
        basePath: false, // Important: bypass basePath for these redirects
      },
      {
        source: "/health",
        destination: "/reader/health",
        permanent: false,
        basePath: false,
      },
      {
        source: "/manifest.json",
        destination: "/reader/manifest.json",
        permanent: false,
        basePath: false,
      },
    ];
  },
  eslint: {
    // Ignore ESLint errors during production build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Skip TypeScript errors during production build
    ignoreBuildErrors: true,
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
          swSrc: "./src/sw.js",
          swDest: "../public/sw.js",
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
