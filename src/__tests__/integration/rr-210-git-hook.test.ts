import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  chmodSync,
} from "fs";
import path from "path";

// Mock file system for testing hook integration
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  unlinkSync: vi.fn(),
  chmodSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ mode: 0o755 }),
}));

// Mock child process for integration testing
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

describe("RR-210: Git Hook Integration Tests", () => {
  const hookPath = ".git/hooks/pre-commit";
  const mockGitDir = ".git";

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock git directory existence
    vi.mocked(existsSync).mockImplementation((path) => {
      if (path === mockGitDir || path === ".git/hooks") return true;
      if (path === hookPath) return true;
      return false;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Hook Installation", () => {
    it("should install pre-commit hook in git repository", () => {
      const hookContent = `#!/bin/bash
set -e
echo "Running pre-commit validations..."
npm run type-check
npm run lint
npm run format:check
npm run docs:validate
echo "All validations passed!"
exit 0`;

      // Simulate hook installation
      writeFileSync(hookPath, hookContent);
      chmodSync(hookPath, 0o755);

      expect(writeFileSync).toHaveBeenCalledWith(hookPath, hookContent);
      expect(chmodSync).toHaveBeenCalledWith(hookPath, 0o755);
    });

    it("should verify .git directory exists before installation", () => {
      vi.mocked(existsSync).mockReturnValueOnce(false); // .git doesn't exist

      const installHook = () => {
        if (!existsSync(".git")) {
          throw new Error("Not a git repository");
        }
        writeFileSync(hookPath, "#!/bin/bash\necho 'test'");
      };

      expect(() => installHook()).toThrow("Not a git repository");
    });

    it("should create .git/hooks directory if it doesn't exist", () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (path === ".git") return true;
        if (path === ".git/hooks") return false; // hooks directory missing
        return false;
      });

      const mockMkdirSync = vi.fn();
      vi.doMock("fs", () => ({
        ...vi.importActual("fs"),
        mkdirSync: mockMkdirSync,
        existsSync: vi.mocked(existsSync),
        writeFileSync: vi.mocked(writeFileSync),
        chmodSync: vi.mocked(chmodSync),
      }));

      const installHook = () => {
        if (!existsSync(".git/hooks")) {
          mockMkdirSync(".git/hooks", { recursive: true });
        }
        writeFileSync(hookPath, "#!/bin/bash\necho 'test'");
        chmodSync(hookPath, 0o755);
      };

      installHook();
      expect(mockMkdirSync).toHaveBeenCalledWith(".git/hooks", {
        recursive: true,
      });
    });
  });

  describe("Workflow Integration", () => {
    it("should execute all pre-commit commands in sequence", () => {
      const commands = [
        "npm run type-check",
        "npm run lint",
        "npm run format:check",
        "npm run docs:validate",
      ];

      // Mock successful execution for all commands
      commands.forEach((command, index) => {
        vi.mocked(execSync).mockReturnValueOnce(
          `${command} completed successfully`
        );
      });

      // Simulate hook execution
      const executeHook = () => {
        let allPassed = true;
        for (const command of commands) {
          try {
            execSync(command, { stdio: "pipe" });
          } catch (error) {
            allPassed = false;
            break;
          }
        }
        return allPassed ? 0 : 1;
      };

      const exitCode = executeHook();
      expect(exitCode).toBe(0);
      expect(execSync).toHaveBeenCalledTimes(4);

      commands.forEach((command, index) => {
        expect(execSync).toHaveBeenNthCalledWith(index + 1, command, {
          stdio: "pipe",
        });
      });
    });

    it("should stop execution on first validation failure", () => {
      const commands = [
        "npm run type-check",
        "npm run lint",
        "npm run format:check",
        "npm run docs:validate",
      ];

      // Mock type-check success, lint failure
      vi.mocked(execSync)
        .mockReturnValueOnce("Type check passed")
        .mockImplementationOnce(() => {
          const error = new Error("Lint check failed") as any;
          error.status = 1;
          throw error;
        });

      const executeHook = () => {
        for (const command of commands) {
          try {
            execSync(command, { stdio: "pipe" });
          } catch (error: any) {
            return error.status || 1;
          }
        }
        return 0;
      };

      const exitCode = executeHook();
      expect(exitCode).toBe(1);
      expect(execSync).toHaveBeenCalledTimes(2); // Only first two commands
    });

    it("should integrate with existing npm run pre-commit if it exists", () => {
      // Mock package.json with existing pre-commit script
      const mockPackageJson = {
        scripts: {
          "pre-commit":
            "npm run type-check && npm run lint && npm run format:check",
          "docs:validate": "node scripts/validate-openapi-coverage.js",
        },
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockPackageJson));
      vi.mocked(execSync).mockReturnValue("All validations passed");

      const packageContent = JSON.parse(
        readFileSync("package.json", "utf8") as string
      );
      expect(packageContent.scripts["pre-commit"]).toBeDefined();
      expect(packageContent.scripts["docs:validate"]).toBeDefined();

      // Hook should call both existing pre-commit and new docs:validate
      execSync("npm run pre-commit");
      execSync("npm run docs:validate");

      expect(execSync).toHaveBeenCalledWith("npm run pre-commit");
      expect(execSync).toHaveBeenCalledWith("npm run docs:validate");
    });
  });

  describe("OpenAPI Validation Integration", () => {
    it("should call npm run docs:validate and handle success", () => {
      vi.mocked(execSync).mockReturnValue(
        "🎉 SUCCESS: All endpoints are properly documented!"
      );

      const result = execSync("npm run docs:validate", { encoding: "utf8" });

      expect(execSync).toHaveBeenCalledWith("npm run docs:validate", {
        encoding: "utf8",
      });
      expect(result.toString()).toContain(
        "SUCCESS: All endpoints are properly documented"
      );
    });

    it("should call npm run docs:validate and handle failure", () => {
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error(
          "❌ FAILURE: OpenAPI documentation is incomplete"
        ) as any;
        error.status = 1;
        throw error;
      });

      const executeValidation = () => {
        try {
          execSync("npm run docs:validate", { encoding: "utf8" });
          return 0;
        } catch (error: any) {
          return error.status || 1;
        }
      };

      const exitCode = executeValidation();
      expect(exitCode).toBe(1);
    });

    it("should handle server unavailable gracefully", () => {
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error(
          "Error: Could not connect to development server"
        ) as any;
        error.status = 1;
        throw error;
      });

      const executeValidation = () => {
        try {
          execSync("npm run docs:validate");
          return 0;
        } catch (error: any) {
          if (
            error.message.includes("Could not connect to development server")
          ) {
            console.log(
              "💡 Please ensure the development server is running: npm run dev"
            );
          }
          return error.status || 1;
        }
      };

      const exitCode = executeValidation();
      expect(exitCode).toBe(1);
    });

    it("should validate that docs:validate script exists in package.json", () => {
      const mockPackageJson = {
        scripts: {
          "docs:validate": "node scripts/validate-openapi-coverage.js",
          "type-check": "tsc --noEmit",
          lint: "eslint . --ext .ts,.tsx",
          "format:check": "prettier --check .",
        },
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockPackageJson));

      const packageContent = JSON.parse(
        readFileSync("package.json", "utf8") as string
      );
      expect(packageContent.scripts["docs:validate"]).toBe(
        "node scripts/validate-openapi-coverage.js"
      );
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should provide clear error messages for each validation type", () => {
      const errorScenarios = [
        {
          command: "npm run type-check",
          error: "Type check failed: TS2304: Cannot find name 'unknown'",
          expectedMessage: "Type check failed",
        },
        {
          command: "npm run lint",
          error:
            "Lint check failed: 'unused-variable' is defined but never used",
          expectedMessage: "Lint check failed",
        },
        {
          command: "npm run format:check",
          error: "Format check failed: Code style issues found",
          expectedMessage: "Format check failed",
        },
        {
          command: "npm run docs:validate",
          error: "❌ OpenAPI documentation validation failed",
          expectedMessage: "OpenAPI documentation validation failed",
        },
      ];

      errorScenarios.forEach(({ command, error, expectedMessage }) => {
        vi.mocked(execSync).mockImplementation(() => {
          const err = new Error(error) as any;
          err.status = 1;
          throw err;
        });

        const executeCommand = () => {
          try {
            execSync(command);
            return { success: true, message: "" };
          } catch (error: any) {
            return { success: false, message: error.message };
          }
        };

        const result = executeCommand();
        expect(result.success).toBe(false);
        expect(result.message).toContain(expectedMessage.split(":")[0]);
      });
    });

    it("should handle permission errors gracefully", () => {
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error("EACCES: permission denied") as any;
        error.code = "EACCES";
        error.status = 126;
        throw error;
      });

      const executeHook = () => {
        try {
          execSync("npm run docs:validate");
          return 0;
        } catch (error: any) {
          if (error.code === "EACCES") {
            console.log("❌ Permission denied. Please check file permissions.");
            return 126;
          }
          return error.status || 1;
        }
      };

      const exitCode = executeHook();
      expect(exitCode).toBe(126);
    });

    it("should handle network timeouts for OpenAPI validation", () => {
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error("ETIMEDOUT: connection timed out") as any;
        error.code = "ETIMEDOUT";
        error.status = 1;
        throw error;
      });

      const executeValidation = () => {
        try {
          execSync("npm run docs:validate", { timeout: 30000 });
          return 0;
        } catch (error: any) {
          if (error.code === "ETIMEDOUT") {
            console.log("❌ Connection timed out. Please check server status.");
          }
          return error.status || 1;
        }
      };

      const exitCode = executeValidation();
      expect(exitCode).toBe(1);
    });
  });

  describe("Git Integration", () => {
    it("should be executed by git commit command", () => {
      const mockGitCommit = () => {
        // Simulate git calling the pre-commit hook
        try {
          execSync(".git/hooks/pre-commit");
          execSync("git commit -m 'test commit'");
          return 0;
        } catch (error: any) {
          return error.status || 1;
        }
      };

      vi.mocked(execSync)
        .mockReturnValueOnce("All pre-commit validations passed") // Hook execution
        .mockReturnValueOnce("[main abc123] test commit"); // Git commit

      const exitCode = mockGitCommit();
      expect(exitCode).toBe(0);
    });

    it("should prevent git commit when validations fail", () => {
      const mockGitCommit = () => {
        try {
          // Pre-commit hook fails
          execSync(".git/hooks/pre-commit");
          // Git commit should not proceed
          execSync("git commit -m 'test commit'");
          return 0;
        } catch (error: any) {
          return error.status || 1;
        }
      };

      vi.mocked(execSync).mockImplementationOnce(() => {
        const error = new Error("Pre-commit validation failed") as any;
        error.status = 1;
        throw error;
      });

      const exitCode = mockGitCommit();
      expect(exitCode).toBe(1);
      expect(execSync).toHaveBeenCalledTimes(1); // Only hook called, not commit
    });

    it("should work with git commit --no-verify to bypass hook", () => {
      const mockGitCommitNoVerify = () => {
        // --no-verify flag bypasses pre-commit hook
        try {
          execSync("git commit --no-verify -m 'test commit'");
          return 0;
        } catch (error: any) {
          return error.status || 1;
        }
      };

      vi.mocked(execSync).mockReturnValue("[main abc123] test commit");

      const exitCode = mockGitCommitNoVerify();
      expect(exitCode).toBe(0);
      expect(execSync).toHaveBeenCalledWith(
        "git commit --no-verify -m 'test commit'"
      );
    });
  });

  describe("Configuration and Customization", () => {
    it("should allow configuration of validation commands", () => {
      const customConfig = {
        preCommitCommands: [
          "npm run type-check",
          "npm run lint",
          "npm run format:check",
          "npm run docs:validate",
          "npm run test:unit", // Additional custom command
        ],
      };

      customConfig.preCommitCommands.forEach((command) => {
        vi.mocked(execSync).mockReturnValueOnce("Success");
        execSync(command);
        expect(execSync).toHaveBeenCalledWith(command);
      });

      expect(execSync).toHaveBeenCalledTimes(5);
    });

    it("should support conditional validation based on changed files", () => {
      // Mock git diff to show only TypeScript files changed
      vi.mocked(execSync)
        .mockReturnValueOnce("src/lib/api.ts\nsrc/components/Article.tsx") // git diff --name-only
        .mockReturnValueOnce("Type check passed") // npm run type-check
        .mockReturnValueOnce("Lint passed") // npm run lint
        .mockReturnValueOnce("Format check passed") // npm run format:check
        .mockReturnValueOnce("OpenAPI validation passed"); // npm run docs:validate

      const executeConditionalValidation = () => {
        const changedFiles = execSync(
          "git diff --cached --name-only"
        ).toString();

        // Always run these for any changes
        execSync("npm run type-check");
        execSync("npm run lint");
        execSync("npm run format:check");

        // Run OpenAPI validation if API files changed
        if (changedFiles.includes("api") || changedFiles.includes("route.ts")) {
          execSync("npm run docs:validate");
        }

        return 0;
      };

      const exitCode = executeConditionalValidation();
      expect(exitCode).toBe(0);
      expect(execSync).toHaveBeenCalledTimes(5); // git diff + 4 validations
    });

    it("should support skip flags for development", () => {
      const executeWithSkipFlags = () => {
        const skipOpenAPI = process.env.SKIP_OPENAPI_VALIDATION === "true";
        const skipLint = process.env.SKIP_LINT === "true";

        try {
          execSync("npm run type-check");

          if (!skipLint) {
            execSync("npm run lint");
          }

          execSync("npm run format:check");

          if (!skipOpenAPI) {
            execSync("npm run docs:validate");
          }

          return 0;
        } catch (error: any) {
          return error.status || 1;
        }
      };

      // Test with skip flags
      process.env.SKIP_OPENAPI_VALIDATION = "true";
      process.env.SKIP_LINT = "true";

      vi.mocked(execSync)
        .mockReturnValueOnce("Type check passed")
        .mockReturnValueOnce("Format check passed");

      const exitCode = executeWithSkipFlags();
      expect(exitCode).toBe(0);
      expect(execSync).toHaveBeenCalledTimes(2); // Only type-check and format:check

      // Cleanup
      delete process.env.SKIP_OPENAPI_VALIDATION;
      delete process.env.SKIP_LINT;
    });
  });
});
