/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    exclude: [
      "**/src/__tests__/integration/**",
      "**/src/__tests__/e2e/**",
      "**/node_modules/**",
    ],
    // RR-183: Optimized configuration for mass test execution
    // RR-188: Store isolation implemented - parallelism restored
    // Use threads for better performance with controlled concurrency
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: 4, // Restored parallel execution with store isolation fix
        minThreads: 1, // Start with minimum threads
        useAtomics: true, // Enable atomics for better synchronization
        isolate: true, // Isolate test environments
      },
    },
    // Progressive resource management
    maxConcurrency: 1, // CRITICAL: Force sequential execution to fix test isolation
    testTimeout: 30000, // 30 seconds per test
    hookTimeout: 10000, // 10 seconds for hooks

    // Memory and cleanup optimizations
    clearMocks: true, // Clear all mocks between tests
    mockReset: true, // Reset mock state between tests
    restoreMocks: true, // Restore original implementations

    // Execution order optimization
    sequence: {
      shuffle: false, // Keep predictable test order
      concurrent: false, // CRITICAL: Disable concurrent execution to fix test isolation
    },

    // Reporter configuration for progress monitoring
    reporters: process.env.CI ? ["verbose"] : ["default", "hanging-process"],

    // Bail on first test failure in CI
    bail: process.env.CI ? 1 : 0,
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
