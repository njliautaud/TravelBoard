import type { NextConfig } from "next";

/**
 * When STATIC_EXPORT=1 is set (by the deploy script), build a static export
 * for Cloudflare Pages. Otherwise, run as a normal Next.js server with API routes.
 */
const isStaticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: "export" } : {}),
  trailingSlash: true,
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

export default nextConfig;
