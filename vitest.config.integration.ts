/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node", // Use node environment for integration tests
    setupFiles: ["./src/test-setup-integration.ts"], // Different setup file
    include: ['**/src/__tests__/integration/**'],
    // Resource limits to prevent memory exhaustion (RR-123)
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        maxForks: 2,
      },
    },
    maxConcurrency: 1,
    testTimeout: 30000, // 30 seconds
    hookTimeout: 30000, // 30 seconds
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