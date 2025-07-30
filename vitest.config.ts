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
