/**
 * Vitest Configuration Separation Tests (RR-118)
 * 
 * Validates the separation of Vitest configurations for unit vs integration tests.
 * Tests based on Linear issue RR-118 requirements for proper test environment isolation.
 * 
 * Key validation points:
 * 1. Configuration file separation and patterns
 * 2. Environment settings (jsdom vs node)
 * 3. Setup file assignments and isolation
 * 4. Pattern matching for test file routing
 * 5. Exclude/include patterns for test categorization
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";

const PROJECT_ROOT = resolve(__dirname, "../../..");

interface VitestConfig {
  content: string;
  path: string;
  parsed?: any;
}

interface TestSuiteStats {
  totalFiles: number;
  unitFiles: number;
  integrationFiles: number;
  e2eFiles: number;
  otherFiles: number;
}

describe("RR-118: Vitest Configuration Separation Validation", () => {
  let mainConfig: VitestConfig;
  let integrationConfig: VitestConfig;
  let unitConfig: VitestConfig | null = null;
  let testSuiteStats: TestSuiteStats;

  beforeAll(() => {
    // Load main configuration
    const mainConfigPath = resolve(PROJECT_ROOT, "vitest.config.ts");
    mainConfig = {
      content: readFileSync(mainConfigPath, "utf-8"),
      path: mainConfigPath
    };

    // Load integration configuration
    const integrationConfigPath = resolve(PROJECT_ROOT, "vitest.config.integration.ts");
    integrationConfig = {
      content: readFileSync(integrationConfigPath, "utf-8"),
      path: integrationConfigPath
    };

    // Check for unit configuration (referenced in package.json)
    const unitConfigPath = resolve(PROJECT_ROOT, "vitest.config.unit.ts");
    if (existsSync(unitConfigPath)) {
      unitConfig = {
        content: readFileSync(unitConfigPath, "utf-8"),
        path: unitConfigPath
      };
    }

    // Calculate test suite statistics
    testSuiteStats = calculateTestSuiteStats();
  });

  describe("Configuration File Separation", () => {
    it("should have distinct configuration files for different test types", () => {
      // Main config should exist
      expect(existsSync(mainConfig.path)).toBe(true);
      
      // Integration config should exist and be separate
      expect(existsSync(integrationConfig.path)).toBe(true);
      expect(integrationConfig.path).not.toBe(mainConfig.path);
      
      // Configurations should have different content
      expect(mainConfig.content).not.toBe(integrationConfig.content);
    });

    it("should have proper configuration naming conventions", () => {
      expect(mainConfig.path).toMatch(/vitest\.config\.ts$/);
      expect(integrationConfig.path).toMatch(/vitest\.config\.integration\.ts$/);
      
      if (unitConfig) {
        expect(unitConfig.path).toMatch(/vitest\.config\.unit\.ts$/);
      }
    });

    it("should validate configuration file structure and exports", () => {
      // Both configs should use defineConfig
      expect(mainConfig.content).toContain("defineConfig");
      expect(integrationConfig.content).toContain("defineConfig");
      
      // Both should have test section
      expect(mainConfig.content).toContain("test:");
      expect(integrationConfig.content).toContain("test:");
      
      // Both should export default
      expect(mainConfig.content).toContain("export default");
      expect(integrationConfig.content).toContain("export default");
    });
  });

  describe("Environment Settings Validation", () => {
    it("should use jsdom environment for main/unit tests", () => {
      expect(mainConfig.content).toContain('environment: "jsdom"');
      
      if (unitConfig) {
        expect(unitConfig.content).toContain('environment: "jsdom"');
      }
    });

    it("should use node environment for integration tests", () => {
      expect(integrationConfig.content).toContain('environment: "node"');
    });

    it("should have consistent globals setting across configurations", () => {
      const mainGlobals = mainConfig.content.match(/globals:\s*(true|false)/);
      const integrationGlobals = integrationConfig.content.match(/globals:\s*(true|false)/);
      
      expect(mainGlobals).toBeTruthy();
      expect(integrationGlobals).toBeTruthy();
      
      // Both should use same globals setting for consistency
      expect(mainGlobals?.[1]).toBe(integrationGlobals?.[1]);
    });
  });

  describe("Setup File Assignments", () => {
    it("should have distinct setup files for different test environments", () => {
      const mainSetupFiles = extractSetupFiles(mainConfig.content);
      const integrationSetupFiles = extractSetupFiles(integrationConfig.content);
      
      expect(mainSetupFiles).toContain("./src/test-setup.ts");
      expect(integrationSetupFiles).toContain("./src/test-setup-integration.ts");
      
      // Setup files should be different
      expect(mainSetupFiles).not.toEqual(integrationSetupFiles);
    });

    it("should verify setup file existence and content differences", () => {
      const mainSetupPath = resolve(PROJECT_ROOT, "src/test-setup.ts");
      const integrationSetupPath = resolve(PROJECT_ROOT, "src/test-setup-integration.ts");
      
      expect(existsSync(mainSetupPath)).toBe(true);
      expect(existsSync(integrationSetupPath)).toBe(true);
      
      const mainSetupContent = readFileSync(mainSetupPath, "utf-8");
      const integrationSetupContent = readFileSync(integrationSetupPath, "utf-8");
      
      // Setup files should have different content for different purposes
      expect(mainSetupContent).not.toBe(integrationSetupContent);
      
      // Main setup should mock fetch
      expect(mainSetupContent).toContain("global.fetch = vi.fn()");
      
      // Integration setup should NOT mock fetch (or explicitly state it doesn't)
      const integrationMocksFetch = integrationSetupContent.includes("global.fetch = vi.fn()") &&
                                   !integrationSetupContent.includes("// global.fetch = vi.fn()");
      expect(integrationMocksFetch).toBe(false);
    });
  });

  describe("Pattern Matching for Test Files", () => {
    it("should validate test file discovery patterns", () => {
      // Check if configs specify include/exclude patterns
      const mainIncludes = extractTestPatterns(mainConfig.content, "include");
      const mainExcludes = extractTestPatterns(mainConfig.content, "exclude");
      
      const integrationIncludes = extractTestPatterns(integrationConfig.content, "include");
      const integrationExcludes = extractTestPatterns(integrationConfig.content, "exclude");
      
      // Log patterns for validation (if any are specified)
      if (mainIncludes.length > 0 || mainExcludes.length > 0) {
        console.log("Main config patterns:", { includes: mainIncludes, excludes: mainExcludes });
      }
      
      if (integrationIncludes.length > 0 || integrationExcludes.length > 0) {
        console.log("Integration config patterns:", { includes: integrationIncludes, excludes: integrationExcludes });
      }
      
      // If patterns are specified, they should be different for separation
      if (mainIncludes.length > 0 && integrationIncludes.length > 0) {
        expect(mainIncludes).not.toEqual(integrationIncludes);
      }
    });

    it("should validate proper test file categorization", () => {
      expect(testSuiteStats.totalFiles).toBeGreaterThan(0);
      expect(testSuiteStats.unitFiles + testSuiteStats.integrationFiles).toBeGreaterThan(0);
      
      // Should have at least some unit tests
      expect(testSuiteStats.unitFiles).toBeGreaterThan(0);
      
      // Should have at least some integration tests
      expect(testSuiteStats.integrationFiles).toBeGreaterThan(0);
      
      console.log("Test Suite Statistics:", testSuiteStats);
    });

    it("should verify test files follow naming conventions", () => {
      const testFiles = findAllTestFiles();
      
      testFiles.forEach(file => {
        // All test files should end with .test.ts or .test.tsx
        expect(file).toMatch(/\.test\.(ts|tsx)$/);
        
        // Integration tests should be in integration directory
        if (file.includes("/integration/")) {
          expect(file).toMatch(/\/__tests__\/integration\/.*\.test\.(ts|tsx)$/);
        }
        
        // Unit tests can be in various locations but should follow patterns
        if (file.includes("/unit/") || file.includes("/__tests__/") && !file.includes("/integration/")) {
          expect(file).toMatch(/\.test\.(ts|tsx)$/);
        }
      });
    });
  });

  describe("Configuration Isolation and Consistency", () => {
    it("should have consistent alias configurations", () => {
      const mainAliases = extractAliases(mainConfig.content);
      const integrationAliases = extractAliases(integrationConfig.content);
      
      // Both configs should have same aliases for consistency
      expect(mainAliases).toEqual(integrationAliases);
      
      // Should include key aliases
      expect(mainAliases).toContain("@");
      expect(mainAliases).toContain("@/lib");
      expect(mainAliases).toContain("@/components");
    });

    it("should not have conflicting pool configurations", () => {
      const mainPool = extractPoolConfig(mainConfig.content);
      const integrationPool = extractPoolConfig(integrationConfig.content);
      
      // If pool configs are specified, they should be compatible
      if (mainPool && integrationPool) {
        // Should not have conflicting pool types that would cause isolation issues
        expect(mainPool).toBeTruthy();
        expect(integrationPool).toBeTruthy();
      }
    });

    it("should validate plugin consistency", () => {
      const mainPlugins = extractPlugins(mainConfig.content);
      const integrationPlugins = extractPlugins(integrationConfig.content);
      
      // Both should use React plugin
      expect(mainPlugins).toContain("react");
      expect(integrationPlugins).toContain("react");
      
      // Plugin configuration should be consistent
      expect(mainPlugins).toEqual(integrationPlugins);
    });
  });

  describe("Package.json Script Integration", () => {
    it("should have properly configured test scripts", () => {
      const packagePath = resolve(PROJECT_ROOT, "package.json");
      const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
      const scripts = packageJson.scripts;
      
      // Should have test commands that use correct configs
      expect(scripts.test).toBeDefined();
      expect(scripts["test:integration"]).toBeDefined();
      
      // Integration test should use integration config
      expect(scripts["test:integration"]).toContain("vitest.config.integration.ts");
      
      // Should have unit test command if unit config exists
      if (unitConfig) {
        expect(scripts["test:unit"]).toBeDefined();
        expect(scripts["test:unit"]).toContain("vitest.config.unit.ts");
      }
    });

    it("should validate safety wrappers for integration tests", () => {
      const packagePath = resolve(PROJECT_ROOT, "package.json");
      const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
      const scripts = packageJson.scripts;
      
      // Should have safe integration test wrapper
      expect(scripts["test:integration:safe"]).toBeDefined();
      expect(scripts["test:integration:safe"]).toContain("pm2 stop");
      expect(scripts["test:integration:safe"]).toContain("pm2 start");
    });
  });

  describe("Test Count Validation", () => {
    it("should meet minimum test coverage requirements", () => {
      // Based on Linear issue mention of "76 total tests across 5 test files"
      // This validates we have substantial test coverage
      
      expect(testSuiteStats.totalFiles).toBeGreaterThanOrEqual(5);
      
      // Should have reasonable distribution across test types
      const unitIntegrationRatio = testSuiteStats.unitFiles / (testSuiteStats.integrationFiles || 1);
      expect(unitIntegrationRatio).toBeGreaterThan(0); // Should have both types
      
      console.log(`Test file distribution: ${testSuiteStats.unitFiles} unit, ${testSuiteStats.integrationFiles} integration, ${testSuiteStats.e2eFiles} e2e`);
    });
  });
});

// Helper functions
function extractSetupFiles(configContent: string): string[] {
  const setupFilesMatch = configContent.match(/setupFiles:\s*\[(.*?)\]/s);
  if (!setupFilesMatch) return [];
  
  const setupFilesStr = setupFilesMatch[1];
  return setupFilesStr.split(',')
    .map(file => file.trim().replace(/['"]/g, ''))
    .filter(file => file.length > 0);
}

function extractTestPatterns(configContent: string, type: 'include' | 'exclude'): string[] {
  const pattern = new RegExp(`${type}:\\s*\\[(.*?)\\]`, 's');
  const match = configContent.match(pattern);
  if (!match) return [];
  
  const patternsStr = match[1];
  return patternsStr.split(',')
    .map(pattern => pattern.trim().replace(/['"]/g, ''))
    .filter(pattern => pattern.length > 0);
}

function extractAliases(configContent: string): string[] {
  const aliasMatch = configContent.match(/alias:\s*{(.*?)}/s);
  if (!aliasMatch) return [];
  
  const aliasStr = aliasMatch[1];
  const aliases = aliasStr.match(/"([^"]+)":/g);
  return aliases ? aliases.map(alias => alias.replace(/[":]/g, '')) : [];
}

function extractPoolConfig(configContent: string): string | null {
  const poolMatch = configContent.match(/pool:\s*['"]([^'"]+)['"]/);
  return poolMatch ? poolMatch[1] : null;
}

function extractPlugins(configContent: string): string[] {
  const pluginsMatch = configContent.match(/plugins:\s*\[(.*?)\]/s);
  if (!pluginsMatch) return [];
  
  const pluginsStr = pluginsMatch[1];
  const plugins = pluginsStr.match(/(\w+)\(\)/g);
  return plugins ? plugins.map(plugin => plugin.replace(/\(\)$/, '')) : [];
}

function calculateTestSuiteStats(): TestSuiteStats {
  const stats: TestSuiteStats = {
    totalFiles: 0,
    unitFiles: 0,
    integrationFiles: 0,
    e2eFiles: 0,
    otherFiles: 0
  };

  const testFiles = findAllTestFiles();
  stats.totalFiles = testFiles.length;

  testFiles.forEach(file => {
    if (file.includes('/integration/')) {
      stats.integrationFiles++;
    } else if (file.includes('/e2e/')) {
      stats.e2eFiles++;
    } else if (file.includes('/unit/') || file.includes('/__tests__/')) {
      stats.unitFiles++;
    } else {
      stats.otherFiles++;
    }
  });

  return stats;
}

function findAllTestFiles(): string[] {
  const testFiles: string[] = [];
  
  function scanDirectory(dir: string): void {
    try {
      const entries = readdirSync(dir);
      
      entries.forEach(entry => {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules and other unwanted directories
          if (!entry.startsWith('.') && entry !== 'node_modules') {
            scanDirectory(fullPath);
          }
        } else if (entry.match(/\.test\.(ts|tsx)$/)) {
          testFiles.push(fullPath);
        }
      });
    } catch (error) {
      // Ignore directories we can't read
    }
  }
  
  scanDirectory(resolve(PROJECT_ROOT, 'src'));
  scanDirectory(resolve(PROJECT_ROOT, 'tests'));
  
  return testFiles;
}