/**
 * Shared constants for validation commands and error messages
 * Used by both the pre-commit hook tests and actual implementation
 */

export const VALIDATION_COMMANDS = {
  TYPE_CHECK: "npm run type-check",
  LINT: "npm run lint",
  FORMAT: "npm run format:check",
  FORMAT_FIX: "npm run format",
  DOCS_VALIDATE: "npm run docs:validate",
  PRE_COMMIT: "npm run pre-commit",
} as const;

export const ERROR_MESSAGES = {
  TYPE_CHECK: "Type check failed: TS2304: Cannot find name 'unknown'",
  TYPE_CHECK_PATTERN: "Type check failed",
  LINT: "Lint check failed: 'unused-variable' is defined but never used",
  LINT_PATTERN: "Lint check failed",
  FORMAT: "Format check failed: Code style issues found",
  FORMAT_PATTERN: "Format check failed",
  OPENAPI: "❌ OpenAPI documentation validation failed",
  OPENAPI_PATTERN: "OpenAPI documentation validation failed",
  SUCCESS: "🎉 SUCCESS: All endpoints are properly documented!",
  NETWORK_TIMEOUT: "ETIMEDOUT: connection timed out",
  PERMISSION_DENIED: "EACCES: permission denied",
  SERVER_UNAVAILABLE: "Error: Could not connect to development server",
} as const;

export const TIMEOUT_DURATIONS = {
  BASIC_CHECKS: 30000, // 30 seconds for type-check, lint, format
  OPENAPI_VALIDATION: 60000, // 60 seconds for OpenAPI validation
} as const;

export const EXIT_CODES = {
  SUCCESS: 0,
  FAILURE: 1,
  PERMISSION_ERROR: 126,
} as const;
