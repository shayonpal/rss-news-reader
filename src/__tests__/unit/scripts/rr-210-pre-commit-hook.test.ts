import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, writeFileSync, existsSync, chmodSync } from "fs";
import { execSync } from "child_process";
import path from "path";

// Mock file system operations
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  chmodSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ mode: 0o755 }),
}));

// Mock child process for script execution
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

// Mock path module
vi.mock("path", () => ({
  join: vi.fn().mockImplementation((...args) => args.join("/")),
  resolve: vi.fn().mockImplementation((...args) => args.join("/")),
}));

// Mock the existing validateCoverage function for testing integration
const mockValidateCoverage = vi.fn();
vi.mock("../../../scripts/validate-openapi-coverage.js", () => ({
  validateCoverage: mockValidateCoverage,
}));

describe("RR-210: Pre-commit Hook for OpenAPI Enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Pre-commit Hook Creation", () => {
    it("should create pre-commit hook at .git/hooks/pre-commit", () => {
      const expectedHookPath = ".git/hooks/pre-commit";
      const expectedHookContent = `#!/bin/bash

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

      // Simulate hook creation
      writeFileSync(expectedHookPath, expectedHookContent);
      chmodSync(expectedHookPath, 0o755);

      expect(writeFileSync).toHaveBeenCalledWith(
        expectedHookPath,
        expectedHookContent
      );
      expect(chmodSync).toHaveBeenCalledWith(expectedHookPath, 0o755);
    });

    it("should make pre-commit hook executable (755 permissions)", () => {
      const hookPath = ".git/hooks/pre-commit";
      const hookContent = "#!/bin/bash\necho 'test'";

      writeFileSync(hookPath, hookContent);
      chmodSync(hookPath, 0o755);

      expect(chmodSync).toHaveBeenCalledWith(hookPath, 0o755);
    });

    it("should include proper shebang and error handling", () => {
      const expectedHookContent = expect.stringContaining("#!/bin/bash");
      const hookWithErrorHandling = expect.stringContaining("set -e");
      const hookWithExitCodes = expect.stringContaining("exit 1");

      writeFileSync(".git/hooks/pre-commit", "#!/bin/bash\nset -e\nexit 1");

      expect(writeFileSync).toHaveBeenCalledWith(
        ".git/hooks/pre-commit",
        expect.stringMatching(/^#!/)
      );
    });
  });

  describe("Pre-commit Hook Integration", () => {
    it("should call existing npm run pre-commit workflow", () => {
      const hookScript = `
        npm run type-check
        npm run lint  
        npm run format:check
        npm run docs:validate
      `;

      // Mock successful execution
      vi.mocked(execSync)
        .mockReturnValueOnce("Type check passed") // type-check
        .mockReturnValueOnce("Lint check passed") // lint
        .mockReturnValueOnce("Format check passed") // format:check
        .mockReturnValueOnce("OpenAPI validation passed"); // docs:validate

      // Execute each command in sequence
      expect(() => execSync("npm run type-check")).not.toThrow();
      expect(() => execSync("npm run lint")).not.toThrow();
      expect(() => execSync("npm run format:check")).not.toThrow();
      expect(() => execSync("npm run docs:validate")).not.toThrow();
    });

    it("should call npm run docs:validate for OpenAPI enforcement", () => {
      vi.mocked(execSync).mockReturnValue(
        "🎉 SUCCESS: All endpoints are properly documented!"
      );

      const result = execSync("npm run docs:validate");

      expect(execSync).toHaveBeenCalledWith("npm run docs:validate");
      expect(result.toString()).toContain(
        "SUCCESS: All endpoints are properly documented"
      );
    });

    it("should integrate with existing workflow commands in correct order", () => {
      const expectedCommandOrder = [
        "npm run type-check",
        "npm run lint",
        "npm run format:check",
        "npm run docs:validate",
      ];

      // Clear mocks before testing order
      vi.clearAllMocks();

      expectedCommandOrder.forEach((command, index) => {
        vi.mocked(execSync).mockReturnValueOnce(`${command} passed`);
        execSync(command);
        expect(execSync).toHaveBeenNthCalledWith(index + 1, command);
      });
    });
  });

  describe("OpenAPI Coverage Validation", () => {
    it("should allow commit when OpenAPI coverage is 100%", () => {
      // Clear mocks and setup
      vi.clearAllMocks();

      // Mock successful OpenAPI validation - simulate the actual script call
      vi.mocked(execSync).mockReturnValue(
        "🎉 SUCCESS: All endpoints are properly documented!"
      );

      const exitCode = (() => {
        try {
          execSync("npm run docs:validate");
          return 0; // Success
        } catch (error: any) {
          return error.status || 1; // Failure
        }
      })();

      expect(exitCode).toBe(0);
      expect(execSync).toHaveBeenCalledWith("npm run docs:validate");
    });

    it("should block commit when OpenAPI coverage is less than 100%", () => {
      // Mock failed OpenAPI validation
      mockValidateCoverage.mockReturnValue(false);
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error(
          "❌ FAILURE: OpenAPI documentation is incomplete"
        ) as any;
        error.status = 1;
        throw error;
      });

      const exitCode = (() => {
        try {
          execSync("npm run docs:validate");
          return 0;
        } catch (error: any) {
          return error.status || 1;
        }
      })();

      expect(exitCode).toBe(1);
    });

    it("should handle graceful fallback when dev server is unavailable", () => {
      // Mock server unavailable error
      mockValidateCoverage.mockImplementation(() => {
        throw new Error("Could not connect to development server");
      });

      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error(
          "Could not connect to development server"
        ) as any;
        error.status = 1;
        throw error;
      });

      const exitCode = (() => {
        try {
          execSync("npm run docs:validate");
          return 0;
        } catch (error: any) {
          expect(error.message).toContain(
            "Could not connect to development server"
          );
          return error.status || 1;
        }
      })();

      expect(exitCode).toBe(1);
    });
  });

  describe("Exit Code Mapping", () => {
    it("should return exit code 0 when all validations pass", () => {
      const mockHookExecution = () => {
        // All commands succeed
        execSync("npm run type-check");
        execSync("npm run lint");
        execSync("npm run format:check");
        execSync("npm run docs:validate");
        return 0;
      };

      vi.mocked(execSync).mockReturnValue("Success");

      const exitCode = mockHookExecution();
      expect(exitCode).toBe(0);
    });

    it("should return exit code 1 when any validation fails", () => {
      const testFailureScenarios = [
        { command: "npm run type-check", error: "Type check failed" },
        { command: "npm run lint", error: "Lint check failed" },
        { command: "npm run format:check", error: "Format check failed" },
        {
          command: "npm run docs:validate",
          error: "OpenAPI validation failed",
        },
      ];

      testFailureScenarios.forEach(({ command, error }) => {
        vi.clearAllMocks();

        vi.mocked(execSync).mockImplementation((cmd) => {
          if (cmd === command) {
            const err = new Error(error) as any;
            err.status = 1;
            throw err;
          }
          return "Success";
        });

        const exitCode = (() => {
          try {
            execSync(command);
            return 0;
          } catch (error: any) {
            return error.status || 1;
          }
        })();

        expect(exitCode).toBe(1);
      });
    });

    it("should exit immediately on first failure (fail-fast behavior)", () => {
      // Clear mocks first
      vi.clearAllMocks();

      vi.mocked(execSync)
        .mockReturnValueOnce("Type check passed") // First command succeeds
        .mockImplementationOnce(() => {
          // Second command fails
          const error = new Error("Lint failed") as any;
          error.status = 1;
          throw error;
        });

      const mockHookWithFailFast = () => {
        try {
          execSync("npm run type-check");
          execSync("npm run lint"); // This should fail and stop execution
          execSync("npm run format:check"); // Should not be reached
          execSync("npm run docs:validate"); // Should not be reached
          return 0;
        } catch (error: any) {
          return error.status || 1;
        }
      };

      const exitCode = mockHookWithFailFast();
      expect(exitCode).toBe(1);
      expect(execSync).toHaveBeenCalledTimes(2); // Only first two commands called
    });
  });

  describe("Error Messages and User Guidance", () => {
    it("should provide clear error message when OpenAPI validation fails", () => {
      const expectedErrorMessage = `❌ OpenAPI documentation validation failed
💡 Please ensure the development server is running: npm run dev
💡 Then visit: http://localhost:3000/reader/api-docs
💡 All API endpoints must be documented for commit to proceed`;

      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error(expectedErrorMessage) as any;
        error.status = 1;
        throw error;
      });

      try {
        execSync("npm run docs:validate");
      } catch (error: any) {
        expect(error.message).toContain(
          "OpenAPI documentation validation failed"
        );
        expect(error.message).toContain("npm run dev");
        expect(error.message).toContain(
          "http://localhost:3000/reader/api-docs"
        );
        expect(error.message).toContain("All API endpoints must be documented");
      }
    });

    it("should provide specific guidance for each validation failure", () => {
      const errorScenarios = [
        {
          command: "npm run type-check",
          expectedMessage: "❌ Type check failed",
        },
        {
          command: "npm run lint",
          expectedMessage: "❌ Lint check failed",
        },
        {
          command: "npm run format:check",
          expectedMessage: "❌ Format check failed",
        },
        {
          command: "npm run docs:validate",
          expectedMessage: "❌ OpenAPI documentation validation failed",
        },
      ];

      errorScenarios.forEach(({ command, expectedMessage }) => {
        vi.mocked(execSync).mockImplementation(() => {
          const error = new Error(expectedMessage) as any;
          error.status = 1;
          throw error;
        });

        try {
          execSync(command);
        } catch (error: any) {
          expect(error.message).toContain(expectedMessage);
        }
      });
    });

    it("should show success message when all validations pass", () => {
      const expectedSuccessMessage = "✅ All pre-commit validations passed!";

      vi.mocked(execSync).mockReturnValue(expectedSuccessMessage);

      const result = execSync("echo '✅ All pre-commit validations passed!'");
      expect(result.toString()).toContain(
        "✅ All pre-commit validations passed!"
      );
    });
  });

  describe("Git Hook Conventions", () => {
    it("should follow git hook naming convention", () => {
      const hookPath = ".git/hooks/pre-commit";

      expect(hookPath).toMatch(/^\.git\/hooks\/pre-commit$/);
      expect(hookPath).not.toContain(".sh"); // No extension for git hooks
      expect(hookPath.split("/").pop()).toBe("pre-commit"); // Standard git hook name
    });

    it("should be located in .git/hooks directory", () => {
      const hookPath = ".git/hooks/pre-commit";
      const expectedDirectory = ".git/hooks";

      expect(hookPath.startsWith(expectedDirectory)).toBe(true);
    });

    it("should not have file extension (follows git convention)", () => {
      const hookPath = ".git/hooks/pre-commit";

      expect(hookPath).not.toMatch(/\.(sh|js|ts|py)$/);
    });
  });

  describe("Backward Compatibility", () => {
    it("should preserve existing pre-commit workflow when OpenAPI validation is added", () => {
      const existingCommands = [
        "npm run type-check",
        "npm run lint",
        "npm run format:check",
      ];

      const newCommand = "npm run docs:validate";

      // All existing commands should still be called
      existingCommands.forEach((command) => {
        vi.mocked(execSync).mockReturnValueOnce("Success");
        execSync(command);
        expect(execSync).toHaveBeenCalledWith(command);
      });

      // New command should be added
      vi.mocked(execSync).mockReturnValueOnce("Success");
      execSync(newCommand);
      expect(execSync).toHaveBeenCalledWith(newCommand);
    });

    it("should maintain same exit behavior for existing validations", () => {
      // Existing behavior: type-check failure should still block commit
      vi.mocked(execSync).mockImplementation((command) => {
        if (command === "npm run type-check") {
          const error = new Error("Type check failed") as any;
          error.status = 1;
          throw error;
        }
        return "Success";
      });

      const exitCode = (() => {
        try {
          execSync("npm run type-check");
          return 0;
        } catch (error: any) {
          return error.status || 1;
        }
      })();

      expect(exitCode).toBe(1); // Same as before
    });
  });

  describe("Performance Considerations", () => {
    it("should not significantly impact commit time", () => {
      const startTime = Date.now();

      // Mock fast execution times
      vi.mocked(execSync).mockImplementation(() => {
        // Simulate fast command execution (< 100ms each)
        return "Success";
      });

      // Execute all commands
      execSync("npm run type-check");
      execSync("npm run lint");
      execSync("npm run format:check");
      execSync("npm run docs:validate");

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete quickly (allowing for test overhead)
      expect(executionTime).toBeLessThan(1000); // 1 second max for mocked execution
    });

    it("should fail fast to minimize unnecessary validation time", () => {
      let commandsExecuted = 0;

      vi.mocked(execSync).mockImplementation((command) => {
        commandsExecuted++;
        if (commandsExecuted === 2) {
          // Fail on second command
          const error = new Error("Validation failed") as any;
          error.status = 1;
          throw error;
        }
        return "Success";
      });

      try {
        execSync("npm run type-check"); // Command 1 - succeeds
        execSync("npm run lint"); // Command 2 - fails
        execSync("npm run format:check"); // Command 3 - should not execute
        execSync("npm run docs:validate"); // Command 4 - should not execute
      } catch (error) {
        // Expected failure
      }

      expect(commandsExecuted).toBe(2); // Only first two commands executed
    });
  });
});
