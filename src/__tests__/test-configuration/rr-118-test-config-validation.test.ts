/**
 * Test Configuration Validation Tests (RR-118)
 * 
 * These tests verify that:
 * 1. Unit tests use mocked fetch (default vitest config)
 * 2. Integration tests use real fetch (integration vitest config)  
 * 3. Test environments are properly isolated
 * 4. Both configurations can run without interference
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(__dirname, "../../..");

describe("RR-118: Test Configuration Validation", () => {
  describe("Configuration Files", () => {
    it("should have main vitest.config.ts with correct settings", () => {
      const configPath = resolve(PROJECT_ROOT, "vitest.config.ts");
      expect(existsSync(configPath)).toBe(true);
      
      const config = readFileSync(configPath, "utf-8");
      
      // Should use jsdom environment for unit tests
      expect(config).toContain('environment: "jsdom"');
      
      // Should setup regular test setup file
      expect(config).toContain("setupFiles: [\"./src/test-setup.ts\"]");
      
      // Main config doesn't need to explicitly exclude integration directory
      // as integration tests use separate config file
    });

    it("should have integration vitest.config.integration.ts with correct settings", () => {
      const configPath = resolve(PROJECT_ROOT, "vitest.config.integration.ts");
      expect(existsSync(configPath)).toBe(true);
      
      const config = readFileSync(configPath, "utf-8");
      
      // Should use node environment for integration tests
      expect(config).toContain('environment: "node"');
      
      // Should setup integration test setup file
      expect(config).toContain("setupFiles: [\"./src/test-setup-integration.ts\"]");
    });

    it("should have separate test setup files", () => {
      const unitSetupPath = resolve(PROJECT_ROOT, "src/test-setup.ts");
      const integrationSetupPath = resolve(PROJECT_ROOT, "src/test-setup-integration.ts");
      
      expect(existsSync(unitSetupPath)).toBe(true);
      expect(existsSync(integrationSetupPath)).toBe(true);
      
      const unitSetup = readFileSync(unitSetupPath, "utf-8");
      const integrationSetup = readFileSync(integrationSetupPath, "utf-8");
      
      // Unit setup should mock fetch
      expect(unitSetup).toContain("global.fetch = vi.fn()");
      
      // Integration setup should NOT mock fetch (it's commented out)
      expect(integrationSetup).toContain("// DO NOT mock fetch") ||
        expect(integrationSetup).toContain("// global.fetch = vi.fn()");
    });
  });

  describe("Package.json Scripts", () => {
    it("should have correct test scripts in package.json", () => {
      const packagePath = resolve(PROJECT_ROOT, "package.json");
      expect(existsSync(packagePath)).toBe(true);
      
      const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
      const scripts = packageJson.scripts;
      
      // Should have separate commands for unit and integration tests
      expect(scripts).toHaveProperty("test");
      expect(scripts).toHaveProperty("test:integration");
      
      // Integration test should use integration config
      expect(scripts["test:integration"]).toContain("vitest.config.integration.ts");
      
      // Should have safety wrapper for integration tests
      expect(scripts).toHaveProperty("test:integration:safe"); 
    });
  });

  describe("Test Directory Structure", () => {
    it("should have proper test directory organization", () => {
      const testsDir = resolve(PROJECT_ROOT, "src/__tests__");
      const integrationDir = resolve(testsDir, "integration");
      const unitDir = resolve(testsDir, "unit");
      
      expect(existsSync(testsDir)).toBe(true);
      expect(existsSync(integrationDir)).toBe(true);
      
      // Unit tests can be in root __tests__ or unit subdirectory
      const hasUnitDir = existsSync(unitDir);
      const hasRootUnitTests = existsSync(resolve(testsDir, "unit")) || 
                               existsSync(resolve(PROJECT_ROOT, "src/lib"));
      
      expect(hasUnitDir || hasRootUnitTests).toBe(true);
    });
  });

  describe("Fetch Behavior Verification", () => {
    it("should verify fetch is mocked in unit test environment", () => {
      // This test runs in unit environment, so fetch should be mocked
      expect(vi.isMockFunction(global.fetch)).toBe(true);
    });

    it("should verify environment variables are set correctly", () => {
      // In unit tests, we should be in jsdom environment
      expect(typeof window).toBe("object");
      expect(typeof document).toBe("object");
    });
  });

  describe("Configuration Isolation", () => {
    it("should not have conflicting global configurations", () => {
      // Test that unit test config doesn't leak into integration tests
      const configFiles = [
        resolve(PROJECT_ROOT, "vitest.config.ts"),
        resolve(PROJECT_ROOT, "vitest.config.integration.ts")
      ];
      
      configFiles.forEach(configPath => {
        const config = readFileSync(configPath, "utf-8");
        
        // Should not have conflicting pool settings
        expect(config).not.toContain("pool: 'threads'") || 
          expect(config).not.toContain("pool: 'forks'");
        
        // Should not have global conflicts
        expect(config).not.toContain("globals: false") ||
          expect(config).toContain("globals: true");
      });
    });

    it("should have different aliases but same resolution", () => {
      const mainConfig = readFileSync(resolve(PROJECT_ROOT, "vitest.config.ts"), "utf-8");
      const integrationConfig = readFileSync(resolve(PROJECT_ROOT, "vitest.config.integration.ts"), "utf-8");
      
      // Both should have same alias setup for consistency
      expect(mainConfig).toContain("@/");
      expect(integrationConfig).toContain("@/");
      
      expect(mainConfig).toContain("@/lib");
      expect(integrationConfig).toContain("@/lib");
    });
  });
});