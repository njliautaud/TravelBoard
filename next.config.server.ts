import type { NextConfig } from "next";

/**
 * Server-mode config — used by the Jupiter backend (PM2) to serve API routes.
 * The static export config (next.config.ts) is only used at build time for
 * Cloudflare Pages deployment.
 */
const serverConfig: NextConfig = {
  // NO output: "export" — this runs as a real Next.js server
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  transpilePackages: ["@travelboard/core"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default serverConfig;
