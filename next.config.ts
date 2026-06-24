import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
