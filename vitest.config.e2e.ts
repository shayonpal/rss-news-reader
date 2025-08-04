/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// E2E tests should be excluded from vitest since they use Playwright
// This config is just to ensure they're not picked up by vitest
export default defineConfig({
  plugins: [react()],
  test: {
    exclude: [
      '**/src/__tests__/e2e/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**'
    ],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@/components": resolve(__dirname, "./src/components"),
      "@/lib": resolve(__dirname, "./src/lib"),
      "@/types": resolve(__dirname, "./src/types"),
      "@/hooks": resolve(__dirname, "./src/hooks"),
      "@/constants": resolve(__dirname, "./src/constants"),
      "@/stores": resolve(__dirname, "./src/lib/stores"),
      "@/utils": resolve(__dirname, "./src/lib/utils"),
    },
  },
});