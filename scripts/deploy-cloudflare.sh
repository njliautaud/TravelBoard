#!/usr/bin/env bash
# Lightweight auto-deploy to Cloudflare Pages
# Called by post-commit hook and can be run manually
# IMPORTANT: Uses a temp build dir so the server .next/ is never corrupted
# Clerk auth works client-side via @clerk/react (not @clerk/nextjs which needs server actions)
set -euo pipefail
cd /home/jupiter/TravelBoard

source .env

# PERMANENT API URL — Cloudflare Worker proxy, never changes
API_URL="https://travelboard-api.relentlessrobotics.workers.dev"

echo "$(date) — Deploying to Cloudflare Pages (API: $API_URL — permanent, no tunnel URL rotation)"

# Build static in a temp directory to avoid corrupting the server .next/
TMPDIR=$(mktemp -d)
DEPLOY_DIR="$TMPDIR/travelboard-deploy"

# Copy source (excluding .next, node_modules, .git)
rsync -a --exclude='.next' --exclude='node_modules' --exclude='.git' --exclude='out' . "$DEPLOY_DIR/"

# Symlink node_modules to avoid reinstalling
ln -s /home/jupiter/TravelBoard/node_modules "$DEPLOY_DIR/node_modules"

# Remove API routes, middleware, and admin page for static build
rm -rf "$DEPLOY_DIR/src/app/api"
mkdir -p "$DEPLOY_DIR/src/app/api"
rm -f "$DEPLOY_DIR/src/middleware.ts"
# Admin page is role-gated (OWNER only) — keep it in production
# rm -rf "$DEPLOY_DIR/src/app/admin"

# Replace layout: use dynamic imports to avoid SSR prerender crash with Clerk
cat > "$DEPLOY_DIR/src/app/layout.tsx" << 'LAYOUT'
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientShell from "@/components/ClientShell";

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
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
LAYOUT

# Create a ClientShell that dynamically loads Clerk (avoids SSR prerender crash)
cat > "$DEPLOY_DIR/src/components/ClientShell.tsx" << 'CLIENTSHELL'
"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const ClerkClientProvider = dynamic(
  () => import("@/components/ClerkClientProvider"),
  { ssr: false }
);

const ApiPatchProvider = dynamic(
  () => import("@/components/ApiPatchProvider"),
  { ssr: false }
);

export default function ClientShell({ children }: { children: ReactNode }) {
  return (
    <ClerkClientProvider>
      <ApiPatchProvider>{children}</ApiPatchProvider>
    </ClerkClientProvider>
  );
}
CLIENTSHELL

# Replace sign-in page to use @clerk/react (dynamic import to avoid SSR prerender crash)
# Use routing="hash" so Clerk multi-step flows work without catch-all routes (static export compatible)
cat > "$DEPLOY_DIR/src/app/sign-in/page.tsx" << 'SIGNIN'
"use client";

import dynamic from "next/dynamic";

const SignIn = dynamic(
  () => import("@clerk/react").then((mod) => mod.SignIn),
  { ssr: false, loading: () => <div className="flex min-h-dvh items-center justify-center bg-slate-950"><p className="text-slate-400">Loading...</p></div> }
);

export default function SignInPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950">
      <SignIn
        routing="hash"
        signUpUrl="/sign-up"
        appearance={{
          variables: {
            colorPrimary: "#f59e0b",
            colorBackground: "#020617",
            colorText: "#e2e8f0",
            colorTextSecondary: "#94a3b8",
            colorInputBackground: "#0f172a",
            colorInputText: "#e2e8f0",
          },
          elements: {
            rootBox: "mx-auto",
            card: "bg-slate-950 border border-slate-700/70 shadow-2xl",
            headerTitle: "text-slate-100",
            headerSubtitle: "text-slate-400",
            formFieldLabel: "text-slate-300",
            formFieldInput: "bg-slate-900 text-slate-100 border-slate-700",
            footerActionLink: "text-amber-400 hover:text-amber-300",
            formButtonPrimary: "bg-amber-500 hover:bg-amber-400 text-slate-950",
            dividerLine: "bg-slate-700",
            dividerText: "text-slate-500",
            socialButtonsBlockButton: "border-slate-700 text-slate-200 hover:bg-slate-800",
            socialButtonsBlockButtonText: "text-slate-200",
          },
        }}
      />
    </div>
  );
}
SIGNIN

# Replace sign-up page to use @clerk/react (dynamic import to avoid SSR prerender crash)
cat > "$DEPLOY_DIR/src/app/sign-up/page.tsx" << 'SIGNUP'
"use client";

import dynamic from "next/dynamic";

const SignUp = dynamic(
  () => import("@clerk/react").then((mod) => mod.SignUp),
  { ssr: false, loading: () => <div className="flex min-h-dvh items-center justify-center bg-slate-950"><p className="text-slate-400">Loading...</p></div> }
);

export default function SignUpPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950">
      <SignUp
        routing="hash"
        signInUrl="/sign-in"
        appearance={{
          variables: {
            colorPrimary: "#f59e0b",
            colorBackground: "#020617",
            colorText: "#e2e8f0",
            colorTextSecondary: "#94a3b8",
            colorInputBackground: "#0f172a",
            colorInputText: "#e2e8f0",
          },
          elements: {
            rootBox: "mx-auto",
            card: "bg-slate-950 border border-slate-700/70 shadow-2xl",
            headerTitle: "text-slate-100",
            headerSubtitle: "text-slate-400",
            formFieldLabel: "text-slate-300",
            formFieldInput: "bg-slate-900 text-slate-100 border-slate-700",
            footerActionLink: "text-amber-400 hover:text-amber-300",
            formButtonPrimary: "bg-amber-500 hover:bg-amber-400 text-slate-950",
            dividerLine: "bg-slate-700",
            dividerText: "text-slate-500",
            socialButtonsBlockButton: "border-slate-700 text-slate-200 hover:bg-slate-800",
            socialButtonsBlockButtonText: "text-slate-200",
          },
        }}
      />
    </div>
  );
}
SIGNUP

# Remove dynamic journal/[id] route (breaks static export even with generateStaticParams)
# Journal entries are loaded via client-side navigation from /journal
rm -rf "$DEPLOY_DIR/src/app/journal/[id]"

# Replace ALL @clerk/nextjs imports with @clerk/react across source
find "$DEPLOY_DIR/src" -name "*.tsx" -o -name "*.ts" | xargs sed -i 's|@clerk/nextjs|@clerk/react|g' 2>/dev/null || true

# Hardcode static export config
# IMPORTANT: optimize.minimize = false prevents SWC from mangling Clerk's
# internal "packageName" variable (Next 15 uses SWC, NOT Terser, so the old
# TerserPlugin.reserved approach does nothing).  Bundle is ~200KB larger but
# the site actually works.
cat > "$DEPLOY_DIR/next.config.ts" << 'NEXTCFG'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  transpilePackages: ["@travelboard/core", "@clerk/react", "@clerk/shared", "@clerk/themes"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    // Disable minification entirely for the static export.
    // Next 15's SWC minifier mangles Clerk's internal "packageName" destructured
    // parameter, causing "ReferenceError: packageName is not defined" at runtime.
    // SWC has no "reserved" option like Terser, so we disable minimize instead.
    config.optimization.minimize = false;
    return config;
  },
};

export default nextConfig;
NEXTCFG

# Build static in temp dir — export all NEXT_PUBLIC_ vars for the build
cd "$DEPLOY_DIR"
export NEXT_PUBLIC_API_URL="$API_URL"
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
export NEXT_PUBLIC_CLERK_SIGN_IN_URL
export NEXT_PUBLIC_CLERK_SIGN_UP_URL
export NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL
export NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL
npx next build 2>&1

if [ ! -d "out" ]; then
  echo "ERROR: Static export did not produce out/ directory"
  rm -rf "$TMPDIR"
  exit 1
fi

# Copy Pages Functions alongside the output directory for wrangler to compile
if [ -d "/home/jupiter/TravelBoard/functions" ]; then
  cp -r /home/jupiter/TravelBoard/functions "$DEPLOY_DIR/functions"
fi

# Deploy from the parent of out/ so wrangler finds both out/ and functions/
cd "$DEPLOY_DIR"
export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_KEY"
export CLOUDFLARE_ACCOUNT_ID
npx wrangler pages deploy out/ --project-name travelboard --branch main --commit-dirty=true 2>&1

# Cleanup
rm -rf "$TMPDIR"

# Purge Cloudflare CDN cache so users never get stale HTML/JS
# Pages doesn't have a zone, so we purge via the pages deployment (wrangler handles this)
# Adding cache-control headers via _headers file in next deploy

echo "$(date) — Deploy complete: https://travelboard-9q0.pages.dev"
