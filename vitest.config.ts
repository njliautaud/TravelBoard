import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@travelboard/core": path.resolve(__dirname, "packages/core/src"),
      "@travelboard/core/*": path.resolve(__dirname, "packages/core/src/*"),
    },
  },
  test: {
    include: ["__tests__/**/*.test.ts"],
    globals: false,
  },
});
