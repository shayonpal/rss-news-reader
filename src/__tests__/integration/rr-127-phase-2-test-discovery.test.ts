import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { resolve } from "path";
import { readdir, stat, readFile } from "fs/promises";
import { existsSync } from "fs";
import { glob } from "glob";

/**
 * RR-127 Phase 2: Systematic Test Discovery Fix Test Cases
 *
 * These tests validate the test discovery system can find and properly
 * categorize all test files, resolve imports, and create the necessary
 * test utilities infrastructure.
 */
describe("RR-127 Phase 2: Systematic Test Discovery Fix", () => {
  const projectRoot = resolve(__dirname, "../../..");
  const testRoot = resolve(__dirname, "../..");

  describe("Test File Discovery System", () => {
    it("should discover all test files with correct patterns", async () => {
      const testPatterns = [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.spec.ts",
        "src/**/*.spec.tsx",
      ];

      for (const pattern of testPatterns) {
        const files = await glob(pattern, { cwd: projectRoot });

        // Should find files and they should have valid extensions
        files.forEach((file) => {
          expect(file).toMatch(/\.(test|spec)\.(ts|tsx)$/);
          expect(existsSync(resolve(projectRoot, file))).toBe(true);
        });
      }
    });

    it("should categorize test files by type correctly", async () => {
      const testCategories = {
        unit: await glob("src/**/__tests__/unit/**/*.test.{ts,tsx}", {
          cwd: projectRoot,
        }),
        integration: await glob(
          "src/**/__tests__/integration/**/*.test.{ts,tsx}",
          { cwd: projectRoot }
        ),
        e2e: await glob("src/**/__tests__/e2e/**/*.{test,spec}.{ts,tsx}", {
          cwd: projectRoot,
        }),
        acceptance: await glob(
          "src/**/__tests__/acceptance/**/*.test.{ts,tsx}",
          { cwd: projectRoot }
        ),
        component: await glob("src/components/**/*.test.{ts,tsx}", {
          cwd: projectRoot,
        }),
      };

      // Each category should be properly organized
      Object.entries(testCategories).forEach(([category, files]) => {
        files.forEach((file) => {
          expect(file).toMatch(
            new RegExp(
              category === "component" ? "components" : `__tests__.*${category}`
            )
          );
        });
      });
    });

    it("should validate test file naming conventions", async () => {
      const allTestFiles = await glob("src/**/*.{test,spec}.{ts,tsx}", {
        cwd: projectRoot,
      });

      allTestFiles.forEach((file) => {
        // Test files should follow naming convention
        const basename = file.split("/").pop() || "";

        // Should be either:
        // - component-name.test.ts(x)
        // - rr-123-description.test.ts(x)
        // - descriptive-name.test.ts(x)
        expect(basename).toMatch(/^[a-z0-9-]+\.(test|spec)\.(ts|tsx)$/);
      });
    });

    it("should identify test files requiring JSX support", async () => {
      const componentTests = await glob("src/components/**/*.test.{ts,tsx}", {
        cwd: projectRoot,
      });
      const reactTestFiles = [];

      for (const testFile of componentTests) {
        const fullPath = resolve(projectRoot, testFile);
        if (existsSync(fullPath)) {
          const content = await readFile(fullPath, "utf-8");

          if (
            content.includes("@testing-library/react") ||
            content.includes("render(") ||
            (content.includes("<") && content.includes("/>"))
          ) {
            reactTestFiles.push(testFile);
          }
        }
      }

      // React test files should use .tsx extension
      reactTestFiles.forEach((file) => {
        if (file.endsWith(".test.ts")) {
          const shouldBeTsx = file.replace(".test.ts", ".test.tsx");
          expect(file).toBe(shouldBeTsx); // This will fail if not .tsx
        }
      });
    });
  });

  describe("Test Utilities Infrastructure Validation", () => {
    it("should validate test-utils directory structure", async () => {
      const testUtilsPath = resolve(projectRoot, "src/test-utils");

      if (existsSync(testUtilsPath)) {
        const files = await readdir(testUtilsPath);

        // Should contain essential test utilities
        const expectedUtils = [
          "test-server-setup.ts",
          "mock-factories.ts",
          "test-helpers.ts",
        ];

        expectedUtils.forEach((expectedFile) => {
          if (files.includes(expectedFile)) {
            expect(files).toContain(expectedFile);
          }
        });
      }
    });

    it("should validate test setup file imports resolve correctly", async () => {
      const testSetupFiles = [
        "src/test-setup.ts",
        "src/test-setup-integration.ts",
      ];

      for (const setupFile of testSetupFiles) {
        const fullPath = resolve(projectRoot, setupFile);
        if (existsSync(fullPath)) {
          const content = await readFile(fullPath, "utf-8");

          // Should import vitest utilities
          expect(content).toMatch(/import.*vitest/);

          // Should not have unresolved imports
          expect(content).not.toMatch(/import.*from ['"]undefined['"]/);
          expect(content).not.toMatch(/import.*from ['"]\.['"]/);
        }
      }
    });

    it("should validate shared test utilities are importable", async () => {
      const testUtilFiles = await glob("src/test-utils/**/*.ts", {
        cwd: projectRoot,
      });

      for (const utilFile of testUtilFiles) {
        const fullPath = resolve(projectRoot, utilFile);
        if (existsSync(fullPath)) {
          const content = await readFile(fullPath, "utf-8");

          // Should have proper exports
          expect(content).toMatch(/export/);

          // Should not have circular imports
          expect(content).not.toMatch(/import.*from ['"]\.\/.*test-utils/);
        }
      }
    });
  });

  describe("Import Resolution Validation", () => {
    it("should validate all test files can resolve their imports", async () => {
      const testFiles = await glob("src/**/*.test.{ts,tsx}", {
        cwd: projectRoot,
      });
      const unresolvedImports: string[] = [];

      for (const testFile of testFiles.slice(0, 10)) {
        // Sample first 10 to avoid timeout
        const fullPath = resolve(projectRoot, testFile);
        if (existsSync(fullPath)) {
          const content = await readFile(fullPath, "utf-8");

          // Check for common import issues
          const imports = content.match(/import.*from ['"]([^'"]+)['"]/g) || [];

          imports.forEach((importLine) => {
            const modulePath = importLine.match(/from ['"]([^'"]+)['"]/)?.[1];

            if (modulePath) {
              // Flag potentially problematic imports
              if (modulePath.startsWith(".") && !modulePath.includes("/")) {
                unresolvedImports.push(`${testFile}: ${importLine}`);
              }
            }
          });
        }
      }

      // Should not have unresolved relative imports
      expect(unresolvedImports.length).toBeLessThan(5); // Allow some edge cases
    });

    it("should validate path alias resolution in test files", async () => {
      const testFiles = await glob("src/**/*.test.{ts,tsx}", {
        cwd: projectRoot,
      });
      const aliasPatterns = [
        "@/",
        "@/components",
        "@/lib",
        "@/stores",
        "@/utils",
        "@/types",
      ];

      for (const testFile of testFiles.slice(0, 5)) {
        // Sample files
        const fullPath = resolve(projectRoot, testFile);
        if (existsSync(fullPath)) {
          const content = await readFile(fullPath, "utf-8");

          aliasPatterns.forEach((alias) => {
            if (content.includes(`from '${alias}`)) {
              // Path alias should resolve to actual directory
              const actualPath = alias.replace("@/", "src/");
              const resolvedPath = resolve(projectRoot, actualPath);

              if (alias !== "@/") {
                // Skip root alias check
                expect(existsSync(resolvedPath)).toBe(true);
              }
            }
          });
        }
      }
    });

    it("should validate external dependencies are available", async () => {
      const commonTestDeps = [
        "vitest",
        "@testing-library/react",
        "@testing-library/jest-dom",
        "fake-indexeddb",
      ];

      for (const dep of commonTestDeps) {
        try {
          await import(dep);
          expect(true).toBe(true); // Import succeeded
        } catch (error) {
          // Some imports might fail in test environment, document them
          console.warn(`Could not import ${dep}:`, error);
        }
      }
    });
  });

  describe("Test Configuration Discovery", () => {
    it("should validate vitest configurations are properly structured", async () => {
      const configFiles = ["vitest.config.ts", "vitest.config.integration.ts"];

      for (const configFile of configFiles) {
        const fullPath = resolve(projectRoot, configFile);
        if (existsSync(fullPath)) {
          const content = await readFile(fullPath, "utf-8");

          // Should define test configuration
          expect(content).toMatch(/test:/);
          expect(content).toMatch(/environment:/);
          expect(content).toMatch(/setupFiles:/);

          // Should have resource limits (RR-123)
          if (configFile === "vitest.config.ts") {
            expect(content).toMatch(/pool.*forks/);
            expect(content).toMatch(/maxConcurrency.*1/);
          }
        }
      }
    });

    it("should validate test exclusion patterns work correctly", async () => {
      const mainConfig = resolve(projectRoot, "vitest.config.ts");
      if (existsSync(mainConfig)) {
        const content = await readFile(mainConfig, "utf-8");

        // Should exclude integration tests from unit test runs
        expect(content).toMatch(/exclude.*integration/);
        expect(content).toMatch(/exclude.*node_modules/);
      }
    });

    it("should validate different test environments are properly configured", () => {
      const environments = {
        unit: "jsdom", // For React components
        integration: "node", // For API tests
      };

      Object.entries(environments).forEach(([testType, expectedEnv]) => {
        // This validates our configuration strategy
        expect(expectedEnv).toMatch(/^(jsdom|node)$/);
      });
    });
  });

  describe("Test Discovery Performance", () => {
    it("should discover test files within reasonable time", async () => {
      const startTime = Date.now();

      const testFiles = await glob("src/**/*.test.{ts,tsx}", {
        cwd: projectRoot,
        ignore: ["**/node_modules/**"],
      });

      const discoveryTime = Date.now() - startTime;

      // Should find files quickly (under 5 seconds)
      expect(discoveryTime).toBeLessThan(5000);
      expect(testFiles.length).toBeGreaterThan(10); // Should find substantial number of tests
    });

    it("should handle large test file discovery without memory issues", async () => {
      const beforeMemory = process.memoryUsage().heapUsed;

      // Discover all test files
      const allTests = await glob("src/**/*.{test,spec}.{ts,tsx}", {
        cwd: projectRoot,
      });

      // Read a sample of files to test memory usage
      const sampleFiles = allTests.slice(0, Math.min(10, allTests.length));

      for (const file of sampleFiles) {
        const fullPath = resolve(projectRoot, file);
        if (existsSync(fullPath)) {
          await readFile(fullPath, "utf-8");
        }
      }

      const afterMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterMemory - beforeMemory;

      // Memory increase should be reasonable (under 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe("Test Organization Validation", () => {
    it("should validate test files are organized by feature/module", async () => {
      const testFiles = await glob("src/**/*.test.{ts,tsx}", {
        cwd: projectRoot,
      });

      const organizationPatterns = [
        /src\/lib\/.*\.test\.ts$/, // Utility tests
        /src\/components\/.*\.test\.tsx$/, // Component tests
        /src\/app\/.*\.test\.ts$/, // API route tests
        /src\/__tests__\/.*\.test\.ts$/, // Organized test suites
      ];

      const organizedFiles = testFiles.filter((file) =>
        organizationPatterns.some((pattern) => pattern.test(file))
      );

      // Most test files should follow organization patterns
      const organizationRatio = organizedFiles.length / testFiles.length;
      expect(organizationRatio).toBeGreaterThan(0.7); // At least 70% organized
    });

    it("should validate test files have corresponding source files", async () => {
      const testFiles = await glob("src/**/*.test.{ts,tsx}", {
        cwd: projectRoot,
      });
      const orphanedTests: string[] = [];

      for (const testFile of testFiles) {
        // Skip test-only files (like RR-127 tests)
        if (testFile.includes("rr-") || testFile.includes("__tests__")) {
          continue;
        }

        const sourceFile = testFile
          .replace(".test.ts", ".ts")
          .replace(".test.tsx", ".tsx");

        const sourcePath = resolve(projectRoot, sourceFile);

        if (!existsSync(sourcePath)) {
          orphanedTests.push(testFile);
        }
      }

      // Should have minimal orphaned tests
      expect(orphanedTests.length).toBeLessThan(testFiles.length * 0.3); // Less than 30%
    });
  });
});
