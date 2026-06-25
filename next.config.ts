import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep `sharp` (native module) external so Next's file-tracing bundles its
  // platform binary into the serverless function on Vercel. Without this, any
  // route importing sharp (e.g. /api/locations -> instagramCover) 500s in prod
  // with "Could not load the sharp module using the linux-x64 runtime".
  serverExternalPackages: ["sharp"],
  // ...but tracing still misses sharp's libvips .so dependency, giving
  // "libvips-cpp.so...: cannot open shared object file". Force-include every
  // @img platform binary for the API routes so the .so ships in the bundle.
  // Glob is platform-agnostic: matches win32 locally, linux-x64 on Vercel.
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/@img/**"],
  },
  // Hide the Next.js dev-tools indicator (the little "N" badge, bottom-left,
  // that turns red on errors). It only ever shows in `next dev`; production
  // never renders it. Keeps it off the map screen.
  devIndicators: false,
  // Accessed over Tailscale (100.127.72.12 / *.ts.net) and the LAN (10.0.0.73),
  // so allow those dev origins. Otherwise Next warns on every cross-origin
  // /_next/* + HMR request, which shows as red "issues" in dev tools. NOTE:
  // defining this switches Next to *block* unlisted origins, so list every
  // host the app is opened from (localhost is always allowed). CIDR ranges are
  // NOT supported — exact host or *.wildcard only.
  allowedDevOrigins: ["100.127.72.12", "*.ts.net", "10.0.0.73", "192.168.56.1"],
};

export default nextConfig;
