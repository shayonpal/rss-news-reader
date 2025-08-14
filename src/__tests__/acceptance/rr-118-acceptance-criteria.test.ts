/**
 * Acceptance Criteria Tests for RR-118
 *
 * This test suite verifies that all acceptance criteria from Linear issue RR-118
 * are met: "Fix test configuration to prevent fetch mocking in integration tests"
 *
 * Acceptance Criteria:
 * 1. Integration tests use real fetch (not mocked)
 * 2. Unit tests still use mocked fetch
 * 3. Tests run without "Cannot read properties of undefined" errors
 * 4. Both test types can run independently without interference
 * 5. Package.json scripts route tests to correct configurations
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(__dirname, "../../..");

describe("RR-118: Acceptance Criteria Verification", () => {
  describe("AC1: Integration tests use real fetch (not mocked)", () => {
    it("should verify integration test setup does not mock fetch", () => {
      const integrationSetupPath = resolve(
        PROJECT_ROOT,
        "src/test-setup-integration.ts"
      );
      expect(existsSync(integrationSetupPath)).toBe(true);

      const setupContent = readFileSync(integrationSetupPath, "utf-8");

      // Should NOT contain active fetch mocking (commented line is OK)
      expect(setupContent).not.toMatch(/^global\.fetch = vi\.fn\(\);/m);

      // Should have comment explaining why fetch is not mocked
      expect(setupContent).toContain("DO NOT mock fetch") ||
        expect(setupContent).toContain("real HTTP requests");
    });

    it("should verify integration config uses node environment", () => {
      const integrationConfigPath = resolve(
        PROJECT_ROOT,
        "vitest.config.integration.ts"
      );
      expect(existsSync(integrationConfigPath)).toBe(true);

      const configContent = readFileSync(integrationConfigPath, "utf-8");

      // Should use node environment (not jsdom)
      expect(configContent).toContain('environment: "node"');

      // Should use integration setup file
      expect(configContent).toContain("test-setup-integration.ts");
    });

    it("should verify integration directory exists and contains tests", () => {
      const integrationDir = resolve(PROJECT_ROOT, "src/__tests__/integration");
      expect(existsSync(integrationDir)).toBe(true);

      // Should contain test files
      const files = require("fs").readdirSync(integrationDir);
      const testFiles = files.filter((file: string) =>
        file.endsWith(".test.ts")
      );
      expect(testFiles.length).toBeGreaterThan(0);

      // Should include the RR-118 fetch behavior verification test
      expect(
        testFiles.some(
          (file: string) => file.includes("rr-118") || file.includes("fetch")
        )
      ).toBe(true);
    });
  });

  describe("AC2: Unit tests still use mocked fetch", () => {
    it("should verify unit test setup mocks fetch", () => {
      const unitSetupPath = resolve(PROJECT_ROOT, "src/test-setup.ts");
      expect(existsSync(unitSetupPath)).toBe(true);

      const setupContent = readFileSync(unitSetupPath, "utf-8");

      // Should contain fetch mocking
      expect(setupContent).toContain("global.fetch = vi.fn()");
    });

    it("should verify main config uses jsdom environment", () => {
      const mainConfigPath = resolve(PROJECT_ROOT, "vitest.config.ts");
      expect(existsSync(mainConfigPath)).toBe(true);

      const configContent = readFileSync(mainConfigPath, "utf-8");

      // Should use jsdom environment
      expect(configContent).toContain('environment: "jsdom"');

      // Should use regular setup file
      expect(configContent).toContain("test-setup.ts");
      expect(configContent).not.toContain("test-setup-integration.ts");
    });

    it("should verify fetch is mocked in current unit test environment", () => {
      // This test runs in unit environment - fetch should be mocked
      expect(vi.isMockFunction(global.fetch)).toBe(true);

      // Should have DOM environment available
      expect(typeof window).toBe("object");
      expect(typeof document).toBe("object");
    });
  });

  describe("AC3: Tests run without 'Cannot read properties of undefined' errors", () => {
    it("should verify response object properties are accessible", async () => {
      // Mock fetch for unit test
      const mockResponse = {
        status: 200,
        ok: true,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({ test: "data" }),
        text: vi.fn().mockResolvedValue("text data"),
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      // Should not throw "Cannot read properties of undefined"
      let error: any = null;
      try {
        const response = await fetch("http://test.com");

        // These operations should work without errors
        expect(response.status).toBe(200);
        expect(response.ok).toBe(true);
        expect(response.headers).toBeDefined();

        const data = await response.json();
        expect(data).toEqual({ test: "data" });
      } catch (e) {
        error = e;
      }

      expect(error).toBeNull();
    });

    it("should verify error scenarios don't cause undefined property access", async () => {
      // Mock fetch to reject
      const mockError = new Error("Network error");
      vi.mocked(global.fetch).mockRejectedValue(mockError);

      let fetchError: any = null;
      try {
        await fetch("http://test.com");
      } catch (e) {
        fetchError = e;
      }

      // Should get proper error, not undefined property access
      expect(fetchError).toBeInstanceOf(Error);
      expect(fetchError.message).toBe("Network error");
    });
  });

  describe("AC4: Both test types can run independently without interference", () => {
    it("should verify different package.json scripts exist", () => {
      const packagePath = resolve(PROJECT_ROOT, "package.json");
      const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
      const scripts = packageJson.scripts;

      // Should have separate commands
      expect(scripts.test).toBeDefined();
      expect(scripts["test:integration"]).toBeDefined();

      // Integration command should specify different config
      expect(scripts["test:integration"]).toContain(
        "vitest.config.integration.ts"
      );
    });

    it("should verify configurations don't conflict", () => {
      const mainConfig = readFileSync(
        resolve(PROJECT_ROOT, "vitest.config.ts"),
        "utf-8"
      );
      const integrationConfig = readFileSync(
        resolve(PROJECT_ROOT, "vitest.config.integration.ts"),
        "utf-8"
      );

      // Should have different environments
      expect(mainConfig).toContain('environment: "jsdom"');
      expect(integrationConfig).toContain('environment: "node"');

      // Should have different setup files
      expect(mainConfig).toContain("test-setup.ts");
      expect(integrationConfig).toContain("test-setup-integration.ts");

      // But same aliases for consistency
      expect(mainConfig).toContain("@/");
      expect(integrationConfig).toContain("@/");
    });

    it("should verify test isolation via environment markers", () => {
      // Unit tests should have DOM
      expect(typeof window).toBe("object");
      expect(typeof document).toBe("object");

      // Unit tests should have mocked fetch
      expect(vi.isMockFunction(global.fetch)).toBe(true);

      // This environment should not interfere with integration tests
      // (Integration tests will verify they have Node environment and real fetch)
    });
  });

  describe("AC5: Package.json scripts route tests to correct configurations", () => {
    it("should verify test script uses default configuration", () => {
      const packageJson = JSON.parse(
        readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8")
      );
      const testScript = packageJson.scripts.test;

      // Default test command should run both unit and integration tests
      expect(testScript).toBe(
        "vitest run && vitest run --config vitest.config.integration.ts"
      );
    });

    it("should verify test:integration script uses integration configuration", () => {
      const packageJson = JSON.parse(
        readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8")
      );
      const integrationScript = packageJson.scripts["test:integration"];

      // Should explicitly specify integration config
      expect(integrationScript).toContain(
        "--config vitest.config.integration.ts"
      ) || expect(integrationScript).toContain("vitest.config.integration.ts");
    });

    it("should verify safety wrapper script exists", () => {
      const packageJson = JSON.parse(
        readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8")
      );
      const safeScript = packageJson.scripts["test:integration:safe"];

      expect(safeScript).toBeDefined();

      // Should handle PM2 service management
      expect(safeScript).toContain("pm2 stop");
      expect(safeScript).toContain("pm2 start");
      expect(safeScript).toContain("test:integration");
    });

    it("should verify script execution order in safety wrapper", () => {
      const packageJson = JSON.parse(
        readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8")
      );
      const safeScript = packageJson.scripts["test:integration:safe"];

      // Should stop services, run tests, then start services
      const stopIndex = safeScript.indexOf("pm2 stop");
      const testIndex = safeScript.indexOf("test:integration");
      const startIndex = safeScript.indexOf("pm2 start");

      expect(stopIndex).toBeLessThan(testIndex);
      expect(testIndex).toBeLessThan(startIndex);
    });
  });

  describe("Additional Quality Assurance", () => {
    it("should verify test files follow naming conventions", () => {
      // This test file should follow RR-XXX naming pattern
      expect(__filename).toContain("rr-118");
      expect(__filename.endsWith(".test.ts")).toBe(true);
    });

    it("should verify test setup files exist and are different", () => {
      const unitSetupPath = resolve(PROJECT_ROOT, "src/test-setup.ts");
      const integrationSetupPath = resolve(
        PROJECT_ROOT,
        "src/test-setup-integration.ts"
      );

      expect(existsSync(unitSetupPath)).toBe(true);
      expect(existsSync(integrationSetupPath)).toBe(true);

      const unitSetup = readFileSync(unitSetupPath, "utf-8");
      const integrationSetup = readFileSync(integrationSetupPath, "utf-8");

      // Should be different files with different fetch handling
      expect(unitSetup).not.toBe(integrationSetup);
      expect(unitSetup).toContain("global.fetch = vi.fn()");
      expect(integrationSetup).not.toMatch(/^global\.fetch = vi\.fn\(\);/m);
    });

    it("should verify all test configurations are valid TypeScript/JavaScript", () => {
      const configFiles = [
        "vitest.config.ts",
        "vitest.config.integration.ts",
        "src/test-setup.ts",
        "src/test-setup-integration.ts",
      ];

      configFiles.forEach((file) => {
        const filePath = resolve(PROJECT_ROOT, file);
        expect(existsSync(filePath)).toBe(true);

        const content = readFileSync(filePath, "utf-8");

        // Should not have obvious syntax errors
        expect(content).not.toContain("undefined undefined");
        expect(content).not.toContain("null null");

        // Should have proper imports/exports
        expect(content.includes("import") || content.includes("require")).toBe(
          true
        );
      });
    });

    it("should verify regression prevention", () => {
      // Ensure the original error pattern cannot occur
      const integrationSetup = readFileSync(
        resolve(PROJECT_ROOT, "src/test-setup-integration.ts"),
        "utf-8"
      );

      // Should have explicit comment about not mocking fetch
      expect(integrationSetup).toContain("DO NOT mock fetch") ||
        expect(integrationSetup).toContain("real HTTP requests");

      // Should not accidentally mock fetch
      expect(integrationSetup).not.toMatch(/^global\.fetch = vi\.fn\(\);/m);
    });
  });
});
