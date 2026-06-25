import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.travelboard.app",
  appName: "TravelBoard",
  webDir: "out",

  // For development: point the native shell at the hosted Next.js server
  // so you get live updates without rebuilding static exports.
  // Comment this out (or remove) for production builds that bundle static files.
  server: {
    url: "http://100.71.253.30:3000", // Jupiter Tailscale — change to your dev server
    cleartext: true, // allow plain HTTP in dev
  },

  // Status bar + splash screen — dark theme to match the app
  plugins: {
    StatusBar: {
      backgroundColor: "#0f172a",
      style: "DARK",
    },
    SplashScreen: {
      backgroundColor: "#0f172a",
      launchAutoHide: true,
      launchShowDuration: 1500,
      showSpinner: false,
    },
  },

  // Android-specific overrides
  android: {
    allowMixedContent: true, // needed if dev server is HTTP
  },

  // iOS-specific overrides (applied when building on macOS)
  ios: {
    contentInset: "automatic",
  },
};

export default config;
