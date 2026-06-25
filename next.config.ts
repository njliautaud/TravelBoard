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
  // Keep `sharp` (native module) external so Next's file-tracing bundles its
  // platform binary into the serverless function on Vercel.
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/@img/**"],
  },
  devIndicators: false,
  allowedDevOrigins: ["100.127.72.12", "*.ts.net", "10.0.0.73", "192.168.56.1"],
  transpilePackages: ["@travelboard/core"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
