#!/usr/bin/env bash
# Lightweight auto-deploy to Cloudflare Pages
# Called by post-commit hook and can be run manually
# IMPORTANT: Uses a temp build dir so the server .next/ is never corrupted
# NOTE: Static export strips Clerk (server actions incompatible with static export)
#       Clerk auth works via the server-rendered version (PM2 travelboard process)
#       The static site uses the tunnel to reach the server for auth
set -euo pipefail
cd /home/jupiter/TravelBoard

source .env

# Get tunnel URL
TUNNEL_URL=$(pm2 logs travelboard-tunnel --lines 30 --nostream 2>&1 | grep -oP 'https://[a-z-]+\.trycloudflare\.com' | tail -1)
TUNNEL_URL="${TUNNEL_URL:-https://documented-runtime-workflow-friends.trycloudflare.com}"

echo "$(date) — Deploying to Cloudflare Pages (API: $TUNNEL_URL)"

# Build static in a temp directory to avoid corrupting the server .next/
TMPDIR=$(mktemp -d)
DEPLOY_DIR="$TMPDIR/travelboard-deploy"

# Copy source (excluding .next, node_modules, .git)
rsync -a --exclude='.next' --exclude='node_modules' --exclude='.git' --exclude='out' . "$DEPLOY_DIR/"

# Symlink node_modules to avoid reinstalling
ln -s /home/jupiter/TravelBoard/node_modules "$DEPLOY_DIR/node_modules"

# Remove API routes and middleware for static build
rm -rf "$DEPLOY_DIR/src/app/api"
mkdir -p "$DEPLOY_DIR/src/app/api"
rm -f "$DEPLOY_DIR/src/middleware.ts"

# Remove sign-in/sign-up catch-all routes (they use Clerk dynamic imports)
rm -rf "$DEPLOY_DIR/src/app/sign-in"
rm -rf "$DEPLOY_DIR/src/app/sign-up"

# Replace layout with Clerk-free version for static export
cat > "$DEPLOY_DIR/src/app/layout.tsx" << 'LAYOUT'
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ApiPatchProvider from "@/components/ApiPatchProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TravelBoard",
  description: "Your personal travel map — wishlist, journal, deals & more",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ApiPatchProvider>{children}</ApiPatchProvider>
      </body>
    </html>
  );
}
LAYOUT

# Strip Clerk imports from AppShell (replace with no-ops)
sed -i 's/import.*useClerkSafe.*/const useClerkUser = () => ({ user: null }); const useClerkAuth = () => ({ signOut: () => {} }); const CLERK_ENABLED = false;/' "$DEPLOY_DIR/src/components/AppShell.tsx"
sed -i 's/import ClerkUserButton.*//' "$DEPLOY_DIR/src/components/AppShell.tsx"

# Remove any remaining @clerk imports from components
find "$DEPLOY_DIR/src" -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/import.*@clerk.*//' 2>/dev/null || true

# Hardcode static export config
cat > "$DEPLOY_DIR/next.config.ts" << 'NEXTCFG'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
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
NEXTCFG

# Build static in temp dir
cd "$DEPLOY_DIR"
NEXT_PUBLIC_API_URL="$TUNNEL_URL" NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="" npx next build 2>&1

if [ ! -d "out" ]; then
  echo "ERROR: Static export did not produce out/ directory"
  rm -rf "$TMPDIR"
  exit 1
fi

# Deploy from temp dir
cd /home/jupiter/TravelBoard
export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_KEY"
export CLOUDFLARE_ACCOUNT_ID
npx wrangler pages deploy "$DEPLOY_DIR/out/" --project-name travelboard --branch main --commit-dirty=true 2>&1

# Cleanup
rm -rf "$TMPDIR"

echo "$(date) — Deploy complete: https://travelboard-9q0.pages.dev"
