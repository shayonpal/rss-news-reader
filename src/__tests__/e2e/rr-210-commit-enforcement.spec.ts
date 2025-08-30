import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, existsSync, chmodSync } from "fs";
import path from "path";

/**
 * End-to-End tests for RR-210: Pre-commit Hook for OpenAPI Enforcement
 *
 * These tests validate the complete workflow from git commit to OpenAPI validation
 * in a real git environment with actual file operations and command execution.
 */

test.describe("RR-210: Pre-commit Hook E2E Tests", () => {
  const testRepoPath = "/tmp/rss-reader-test-repo";
  const hookPath = `${testRepoPath}/.git/hooks/pre-commit`;

  test.beforeAll(async () => {
    // Clean up any existing test repo
    try {
      execSync(`rm -rf ${testRepoPath}`, { stdio: "ignore" });
    } catch {
      // Ignore errors if directory doesn't exist
    }

    // Create a temporary git repository for testing
    execSync(`mkdir -p ${testRepoPath}`);
    execSync("git init", { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('git config user.name "Test User"', { cwd: testRepoPath });

    // Create a basic package.json with required scripts
    const packageJson = {
      name: "test-repo",
      scripts: {
        "type-check": "echo 'Type check passed'",
        lint: "echo 'Lint passed'",
        "format:check": "echo 'Format check passed'",
        "docs:validate":
          "echo '🎉 SUCCESS: All endpoints are properly documented!'",
      },
    };

    writeFileSync(
      `${testRepoPath}/package.json`,
      JSON.stringify(packageJson, null, 2)
    );

    // Initial commit to establish the repository
    execSync("git add package.json", { cwd: testRepoPath });
    execSync('git commit -m "Initial commit"', { cwd: testRepoPath });
  });

  test.afterAll(async () => {
    // Clean up test repository
    try {
      execSync(`rm -rf ${testRepoPath}`, { stdio: "ignore" });
    } catch {
      // Ignore cleanup errors
    }
  });

  test("should install pre-commit hook successfully", async () => {
    const hookContent = `#!/bin/bash

# Pre-commit hook for RSS News Reader
# RR-210: Enforce OpenAPI documentation coverage

set -e

echo "🔍 Running pre-commit validations..."

# Run existing pre-commit workflow
echo "📋 Type checking..."
npm run type-check || {
  echo "❌ Type check failed"
  exit 1
}

echo "🔧 Linting..."
npm run lint || {
  echo "❌ Lint check failed"
  exit 1
}

echo "🎨 Format checking..."
npm run format:check || {
  echo "❌ Format check failed"
  exit 1
}

# RR-210: Validate OpenAPI documentation coverage
echo "📚 Validating OpenAPI documentation coverage..."
npm run docs:validate || {
  echo "❌ OpenAPI documentation validation failed"
  echo "💡 Please ensure the development server is running: npm run dev"
  echo "💡 Then visit: http://localhost:3000/reader/api-docs"
  echo "💡 All API endpoints must be documented for commit to proceed"
  exit 1
}

echo "✅ All pre-commit validations passed!"
exit 0
`;

    // Install the hook
    writeFileSync(hookPath, hookContent);
    chmodSync(hookPath, 0o755);

    // Verify hook was created and is executable
    expect(existsSync(hookPath)).toBe(true);

    const hookStats = execSync(`stat -c %a ${hookPath}`, {
      encoding: "utf8",
      cwd: testRepoPath,
    }).trim();

    expect(hookStats).toBe("755");
  });

  test("should allow commit when all validations pass", async () => {
    // Create a test file to commit
    writeFileSync(`${testRepoPath}/test-file.txt`, "Test content");

    try {
      // Stage the file
      execSync("git add test-file.txt", { cwd: testRepoPath, stdio: "pipe" });

      // Attempt to commit (should succeed)
      const commitOutput = execSync(
        'git commit -m "Test commit with passing validations"',
        {
          cwd: testRepoPath,
          encoding: "utf8",
        }
      );

      expect(commitOutput).toContain("Test commit with passing validations");

      // Verify commit was created
      const logOutput = execSync("git log --oneline -1", {
        cwd: testRepoPath,
        encoding: "utf8",
      });

      expect(logOutput).toContain("Test commit with passing validations");
    } catch (error: any) {
      // If commit fails, check the error message
      console.log("Commit error:", error.message);
      throw error;
    }
  });

  test("should block commit when type-check fails", async () => {
    // Modify package.json to make type-check fail
    const packageJson = JSON.parse(
      readFileSync(`${testRepoPath}/package.json`, "utf8")
    );
    packageJson.scripts["type-check"] = "echo 'Type check failed' && exit 1";

    writeFileSync(
      `${testRepoPath}/package.json`,
      JSON.stringify(packageJson, null, 2)
    );

    // Create another test file
    writeFileSync(`${testRepoPath}/test-fail-typecheck.txt`, "Test content");

    try {
      execSync("git add .", { cwd: testRepoPath, stdio: "pipe" });

      // This should fail
      await expect(async () => {
        execSync('git commit -m "This should fail on type-check"', {
          cwd: testRepoPath,
          stdio: "pipe",
        });
      }).rejects.toThrow();
    } catch (error: any) {
      expect(error.status).toBe(1);
    }

    // Restore working type-check for other tests
    packageJson.scripts["type-check"] = "echo 'Type check passed'";
    writeFileSync(
      `${testRepoPath}/package.json`,
      JSON.stringify(packageJson, null, 2)
    );
  });

  test("should block commit when lint fails", async () => {
    // Modify package.json to make lint fail
    const packageJson = JSON.parse(
      readFileSync(`${testRepoPath}/package.json`, "utf8")
    );
    packageJson.scripts.lint = "echo 'Lint check failed' && exit 1";

    writeFileSync(
      `${testRepoPath}/package.json`,
      JSON.stringify(packageJson, null, 2)
    );

    writeFileSync(`${testRepoPath}/test-fail-lint.txt`, "Test content");

    try {
      execSync("git add .", { cwd: testRepoPath, stdio: "pipe" });

      await expect(async () => {
        execSync('git commit -m "This should fail on lint"', {
          cwd: testRepoPath,
          stdio: "pipe",
        });
      }).rejects.toThrow();
    } catch (error: any) {
      expect(error.status).toBe(1);
    }

    // Restore working lint for other tests
    packageJson.scripts.lint = "echo 'Lint passed'";
    writeFileSync(
      `${testRepoPath}/package.json`,
      JSON.stringify(packageJson, null, 2)
    );
  });

  test("should block commit when format check fails", async () => {
    // Modify package.json to make format:check fail
    const packageJson = JSON.parse(
      readFileSync(`${testRepoPath}/package.json`, "utf8")
    );
    packageJson.scripts["format:check"] =
      "echo 'Format check failed' && exit 1";

    writeFileSync(
      `${testRepoPath}/package.json`,
      JSON.stringify(packageJson, null, 2)
    );

    writeFileSync(`${testRepoPath}/test-fail-format.txt`, "Test content");

    try {
      execSync("git add .", { cwd: testRepoPath, stdio: "pipe" });

      await expect(async () => {
        execSync('git commit -m "This should fail on format check"', {
          cwd: testRepoPath,
          stdio: "pipe",
        });
      }).rejects.toThrow();
    } catch (error: any) {
      expect(error.status).toBe(1);
    }

    // Restore working format:check for other tests
    packageJson.scripts["format:check"] = "echo 'Format check passed'";
    writeFileSync(
      `${testRepoPath}/package.json`,
      JSON.stringify(packageJson, null, 2)
    );
  });

  test("should block commit when OpenAPI validation fails", async () => {
    // Modify package.json to make docs:validate fail
    const packageJson = JSON.parse(
      readFileSync(`${testRepoPath}/package.json`, "utf8")
    );
    packageJson.scripts["docs:validate"] =
      "echo '❌ FAILURE: OpenAPI documentation is incomplete' && exit 1";

    writeFileSync(
      `${testRepoPath}/package.json`,
      JSON.stringify(packageJson, null, 2)
    );

    writeFileSync(`${testRepoPath}/test-fail-openapi.txt`, "Test content");

    try {
      execSync("git add .", { cwd: testRepoPath, stdio: "pipe" });

      await expect(async () => {
        execSync('git commit -m "This should fail on OpenAPI validation"', {
          cwd: testRepoPath,
          stdio: "pipe",
        });
      }).rejects.toThrow();
    } catch (error: any) {
      expect(error.status).toBe(1);
    }

    // Restore working docs:validate for other tests
    packageJson.scripts["docs:validate"] =
      "echo '🎉 SUCCESS: All endpoints are properly documented!'";
    writeFileSync(
      `${testRepoPath}/package.json`,
      JSON.stringify(packageJson, null, 2)
    );
  });

  test("should handle server unavailable gracefully", async () => {
    // Simulate server connection failure
    const packageJson = JSON.parse(
      readFileSync(`${testRepoPath}/package.json`, "utf8")
    );
    packageJson.scripts["docs:validate"] =
      "echo 'Error: Could not connect to development server' && exit 1";

    writeFileSync(
      `${testRepoPath}/package.json`,
      JSON.stringify(packageJson, null, 2)
    );

    writeFileSync(
      `${testRepoPath}/test-server-unavailable.txt`,
      "Test content"
    );

    try {
      execSync("git add .", { cwd: testRepoPath, stdio: "pipe" });

      await expect(async () => {
        execSync('git commit -m "Server unavailable test"', {
          cwd: testRepoPath,
          stdio: "pipe",
        });
      }).rejects.toThrow();
    } catch (error: any) {
      expect(error.status).toBe(1);
      // Error message should contain server guidance
      const hookOutput =
        error.stderr?.toString() || error.stdout?.toString() || "";
      expect(hookOutput).toContain("development server");
    }

    // Restore working validation
    packageJson.scripts["docs:validate"] =
      "echo '🎉 SUCCESS: All endpoints are properly documented!'";
    writeFileSync(
      `${testRepoPath}/package.json`,
      JSON.stringify(packageJson, null, 2)
    );
  });

  test("should allow bypassing hook with --no-verify flag", async () => {
    // Even with a failing validation, --no-verify should allow commit
    const packageJson = JSON.parse(
      readFileSync(`${testRepoPath}/package.json`, "utf8")
    );
    packageJson.scripts["docs:validate"] =
      "echo 'This would normally fail' && exit 1";

    writeFileSync(
      `${testRepoPath}/package.json`,
      JSON.stringify(packageJson, null, 2)
    );

    writeFileSync(`${testRepoPath}/test-no-verify.txt`, "Test content");

    try {
      execSync("git add .", { cwd: testRepoPath, stdio: "pipe" });

      // This should succeed despite failing validation
      const commitOutput = execSync(
        'git commit --no-verify -m "Bypassing hook with --no-verify"',
        {
          cwd: testRepoPath,
          encoding: "utf8",
        }
      );

      expect(commitOutput).toContain("Bypassing hook with --no-verify");
    } catch (error: any) {
      console.log("Unexpected error with --no-verify:", error.message);
      throw error;
    }

    // Restore working validation
    packageJson.scripts["docs:validate"] =
      "echo '🎉 SUCCESS: All endpoints are properly documented!'";
    writeFileSync(
      `${testRepoPath}/package.json`,
      JSON.stringify(packageJson, null, 2)
    );
  });

  test("should show helpful error messages when validations fail", async () => {
    // Test each type of validation failure for error message quality
    const failureScenarios = [
      {
        script: "type-check",
        command:
          "echo '❌ Type check failed: Missing type definitions' && exit 1",
        expectedMessage: "Type check failed",
      },
      {
        script: "lint",
        command:
          "echo '❌ Lint check failed: Unused variables found' && exit 1",
        expectedMessage: "Lint check failed",
      },
      {
        script: "format:check",
        command:
          "echo '❌ Format check failed: Code style violations' && exit 1",
        expectedMessage: "Format check failed",
      },
      {
        script: "docs:validate",
        command:
          "echo '❌ OpenAPI documentation validation failed: Missing endpoints' && exit 1",
        expectedMessage: "OpenAPI documentation validation failed",
      },
    ];

    for (const scenario of failureScenarios) {
      // Setup failure scenario
      const packageJson = JSON.parse(
        readFileSync(`${testRepoPath}/package.json`, "utf8")
      );
      packageJson.scripts[scenario.script] = scenario.command;

      writeFileSync(
        `${testRepoPath}/package.json`,
        JSON.stringify(packageJson, null, 2)
      );

      writeFileSync(
        `${testRepoPath}/test-${scenario.script}.txt`,
        "Test content"
      );

      try {
        execSync("git add .", { cwd: testRepoPath, stdio: "pipe" });

        await expect(async () => {
          execSync(`git commit -m "Testing ${scenario.script} failure"`, {
            cwd: testRepoPath,
            stdio: "pipe",
          });
        }).rejects.toThrow();
      } catch (error: any) {
        expect(error.status).toBe(1);

        // Check that error output contains helpful message
        const errorOutput =
          error.stderr?.toString() || error.stdout?.toString() || "";
        expect(errorOutput).toContain(scenario.expectedMessage);
      }

      // Restore working state
      if (scenario.script === "type-check") {
        packageJson.scripts[scenario.script] = "echo 'Type check passed'";
      } else if (scenario.script === "lint") {
        packageJson.scripts[scenario.script] = "echo 'Lint passed'";
      } else if (scenario.script === "format:check") {
        packageJson.scripts[scenario.script] = "echo 'Format check passed'";
      } else if (scenario.script === "docs:validate") {
        packageJson.scripts[scenario.script] =
          "echo '🎉 SUCCESS: All endpoints are properly documented!'";
      }

      writeFileSync(
        `${testRepoPath}/package.json`,
        JSON.stringify(packageJson, null, 2)
      );
    }
  });

  test("should maintain performance during commit process", async () => {
    // Test that the hook doesn't significantly slow down commits
    writeFileSync(
      `${testRepoPath}/performance-test.txt`,
      "Performance test content"
    );

    const startTime = Date.now();

    try {
      execSync("git add performance-test.txt", {
        cwd: testRepoPath,
        stdio: "pipe",
      });

      execSync('git commit -m "Performance test commit"', {
        cwd: testRepoPath,
        stdio: "pipe",
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Hook should complete in reasonable time (allowing for system overhead)
      // This is a loose check since we're running mocked commands
      expect(executionTime).toBeLessThan(10000); // 10 seconds max
    } catch (error: any) {
      console.log("Performance test error:", error.message);
      throw error;
    }
  });

  test("should work correctly with multiple file changes", async () => {
    // Test that hook works when committing multiple files at once
    const testFiles = [
      "src/api/new-endpoint.ts",
      "src/components/NewComponent.tsx",
      "docs/api-changes.md",
      "tests/new-tests.test.ts",
    ];

    // Create test directory structure
    execSync(`mkdir -p ${testRepoPath}/src/api`, { stdio: "pipe" });
    execSync(`mkdir -p ${testRepoPath}/src/components`, { stdio: "pipe" });
    execSync(`mkdir -p ${testRepoPath}/docs`, { stdio: "pipe" });
    execSync(`mkdir -p ${testRepoPath}/tests`, { stdio: "pipe" });

    // Create test files
    testFiles.forEach((file) => {
      writeFileSync(`${testRepoPath}/${file}`, `// Content for ${file}`);
    });

    try {
      execSync("git add .", { cwd: testRepoPath, stdio: "pipe" });

      const commitOutput = execSync(
        'git commit -m "Multiple file changes test"',
        {
          cwd: testRepoPath,
          encoding: "utf8",
        }
      );

      expect(commitOutput).toContain("Multiple file changes test");

      // Verify all files were committed
      const statusOutput = execSync("git status --porcelain", {
        cwd: testRepoPath,
        encoding: "utf8",
      });

      // Should be no uncommitted changes
      expect(statusOutput.trim()).toBe("");
    } catch (error: any) {
      console.log("Multiple files test error:", error.message);
      throw error;
    }
  });
});
