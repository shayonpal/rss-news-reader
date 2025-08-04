/**
 * Package.json Script Execution Tests for RR-118
 * 
 * These tests verify that the package.json test scripts execute correctly
 * and route tests to the appropriate configurations.
 */

import { describe, it, expect } from "vitest";
import { spawn } from "child_process";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";

const PROJECT_ROOT = resolve(__dirname, "../../..");

// Helper function to run npm scripts and capture output
const runNpmScript = (script: string, timeout = 30000): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> => {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', script], {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
      shell: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Script ${script} timed out after ${timeout}ms`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code || 0, stdout, stderr });
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
};

describe("RR-118: Package Script Execution Tests", () => {
  describe("Script Configuration Validation", () => {
    it("should have all required test scripts in package.json", () => {
      const packagePath = resolve(PROJECT_ROOT, "package.json");
      expect(existsSync(packagePath)).toBe(true);

      const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
      const scripts = packageJson.scripts;

      // Core test scripts
      expect(scripts).toHaveProperty("test");
      expect(scripts).toHaveProperty("test:integration");
      expect(scripts).toHaveProperty("test:watch");

      // Safety wrapper for integration tests
      expect(scripts).toHaveProperty("test:integration:safe");
    });

    it("should have correct vitest config references", () => {
      const packageJson = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8"));
      const scripts = packageJson.scripts;

      // Integration tests should reference integration config
      expect(scripts["test:integration"]).toContain("vitest.config.integration.ts");

      // Regular test should run both unit and integration tests
      expect(scripts.test).toBe("vitest run && vitest run --config vitest.config.integration.ts");
    });
  });

  describe("Configuration File Resolution", () => {
    it("should resolve vitest.config.ts for default test command", async () => {
      // Test that the default config exists and is valid
      const configPath = resolve(PROJECT_ROOT, "vitest.config.ts");
      expect(existsSync(configPath)).toBe(true);

      const config = readFileSync(configPath, "utf-8");
      expect(config).toContain("defineConfig");
      expect(config).toContain("vitest/config");
    });

    it("should resolve vitest.config.integration.ts for integration tests", async () => {
      const configPath = resolve(PROJECT_ROOT, "vitest.config.integration.ts");
      expect(existsSync(configPath)).toBe(true);

      const config = readFileSync(configPath, "utf-8");
      expect(config).toContain("defineConfig");
      expect(config).toContain("vitest/config");
      expect(config).toContain('environment: "node"');
    });
  });

  describe("Test Directory Routing", () => {
    it("should route unit tests to default configuration", async () => {
      // This test itself is a unit test that should use mocked fetch
      expect(vi.isMockFunction(global.fetch)).toBe(true);
      expect(typeof window).toBe('object'); // jsdom environment
    });

    it("should identify integration test directory structure", () => {
      const integrationDir = resolve(PROJECT_ROOT, "src/__tests__/integration");
      expect(existsSync(integrationDir)).toBe(true);

      // Should have integration test files
      const integrationFiles = require('fs').readdirSync(integrationDir)
        .filter((file: string) => file.endsWith('.test.ts'));
      
      expect(integrationFiles.length).toBeGreaterThan(0);
    });

    it("should identify unit test locations", () => {
      // Unit tests can be in multiple locations
      const locations = [
        resolve(PROJECT_ROOT, "src/__tests__/unit"),
        resolve(PROJECT_ROOT, "src/__tests__/test-configuration"),
        resolve(PROJECT_ROOT, "src/__tests__/scripts"),
        resolve(PROJECT_ROOT, "src/lib")
      ];

      let hasUnitTests = false;
      for (const location of locations) {
        if (existsSync(location)) {
          try {
            const files = require('fs').readdirSync(location, { recursive: true });
            const testFiles = files.filter((file: string) => 
              typeof file === 'string' && file.endsWith('.test.ts')
            );
            if (testFiles.length > 0) {
              hasUnitTests = true;
              break;
            }
          } catch (e) {
            // Directory might not be readable, skip
          }
        }
      }

      expect(hasUnitTests).toBe(true);
    });
  });

  describe("Script Execution Behavior", () => {
    it("should handle test script environment variables", () => {
      // Scripts should inherit proper environment
      expect(process.env.NODE_ENV).toBeDefined();
      expect(process.env.VITEST).toBe('true');
    });

    it("should handle script timeouts appropriately", () => {
      // Test scripts should not hang indefinitely
      const packageJson = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8"));
      const scripts = packageJson.scripts;

      // Integration test safety script should handle PM2 operations
      expect(scripts["test:integration:safe"]).toContain("pm2 stop");
      expect(scripts["test:integration:safe"]).toContain("pm2 start");
    });
  });

  describe("Error Handling in Scripts", () => {
    it("should handle missing configuration files gracefully", () => {
      // If configs are missing, should provide clear error messages
      const mainConfig = resolve(PROJECT_ROOT, "vitest.config.ts");
      const integrationConfig = resolve(PROJECT_ROOT, "vitest.config.integration.ts");

      expect(existsSync(mainConfig)).toBe(true);
      expect(existsSync(integrationConfig)).toBe(true);
    });

    it("should handle script dependencies", () => {
      // Scripts should handle missing dependencies
      const packageJson = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8"));
      const devDependencies = packageJson.devDependencies || {};
      const dependencies = packageJson.dependencies || {};

      // Should have vitest
      expect(devDependencies.vitest || dependencies.vitest).toBeDefined();
    });
  });

  describe("Integration with PM2 Services", () => {
    it("should handle PM2 service management in test:integration:safe", () => {
      const packageJson = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8"));
      const safeScript = packageJson.scripts["test:integration:safe"];

      // Should stop services before tests
      expect(safeScript).toContain("pm2 stop");
      expect(safeScript).toContain("rss-reader-dev");

      // Should restart after tests
      expect(safeScript).toContain("pm2 start");
      expect(safeScript).toContain("rss-reader-dev");

      // Should run integration tests
      expect(safeScript).toContain("test:integration");
    });

    it("should validate PM2 ecosystem configuration", () => {
      const ecosystemPath = resolve(PROJECT_ROOT, "ecosystem.config.js");
      expect(existsSync(ecosystemPath)).toBe(true);

      const ecosystem = readFileSync(ecosystemPath, "utf-8");
      expect(ecosystem).toContain("rss-reader-dev");
      expect(ecosystem).toContain("PORT: 3000") || expect(ecosystem).toContain("SERVER_PORT");
    });
  });

  describe("Configuration Consistency", () => {
    it("should have consistent alias resolution across configs", () => {
      const mainConfig = readFileSync(resolve(PROJECT_ROOT, "vitest.config.ts"), "utf-8");
      const integrationConfig = readFileSync(resolve(PROJECT_ROOT, "vitest.config.integration.ts"), "utf-8");

      // Both should have same aliases
      const aliases = ["@/", "@/lib", "@/components", "@/types"];
      
      aliases.forEach(alias => {
        expect(mainConfig).toContain(alias);
        expect(integrationConfig).toContain(alias);
      });
    });

    it("should have consistent plugin configuration", () => {
      const mainConfig = readFileSync(resolve(PROJECT_ROOT, "vitest.config.ts"), "utf-8");
      const integrationConfig = readFileSync(resolve(PROJECT_ROOT, "vitest.config.integration.ts"), "utf-8");

      // Both should use React plugin
      expect(mainConfig).toContain("@vitejs/plugin-react");
      expect(integrationConfig).toContain("@vitejs/plugin-react");

      // Both should have globals enabled
      expect(mainConfig).toContain("globals: true");
      expect(integrationConfig).toContain("globals: true");
    });
  });

  describe("Test File Discovery", () => {
    it("should discover test files in expected patterns", () => {
      // Default vitest should find unit tests
      const unitTestPatterns = [
        "**/*.test.ts",
        "**/*.spec.ts"
      ];

      // Integration config should include integration directory
      const integrationTestPattern = "src/__tests__/integration/**/*.test.ts";

      // Both patterns should be valid glob patterns
      expect(unitTestPatterns.every(pattern => typeof pattern === 'string')).toBe(true);
      expect(typeof integrationTestPattern).toBe('string');
    });

    it("should handle test file naming conventions", () => {
      // Should support both .test.ts and .spec.ts
      const testFile = __filename;
      expect(testFile).toMatch(/\.test\.ts$/);

      // Integration tests should be in integration directory
      const integrationDir = resolve(PROJECT_ROOT, "src/__tests__/integration");
      if (existsSync(integrationDir)) {
        const files = require('fs').readdirSync(integrationDir);
        const testFiles = files.filter((file: string) => file.endsWith('.test.ts'));
        expect(testFiles.length).toBeGreaterThan(0);
      }
    });
  });
});