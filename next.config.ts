import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@travelboard/core"],
  webpack: (config) => {
    // Allow .js imports to resolve to .ts source files in the core package
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
