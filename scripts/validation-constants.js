#!/usr/bin/env node

/**
 * Export validation constants for use by shell scripts
 * This ensures consistency between tests and the actual pre-commit hook
 */

const VALIDATION_COMMANDS = {
  TYPE_CHECK: "npm run type-check",
  LINT: "npm run lint",
  FORMAT: "npm run format:check",
  FORMAT_FIX: "npm run format",
  DOCS_VALIDATE: "npm run docs:validate",
  PRE_COMMIT: "npm run pre-commit",
};

const TIMEOUT_DURATIONS = {
  BASIC_CHECKS: 30, // 30 seconds for type-check, lint, format
  OPENAPI_VALIDATION: 60, // 60 seconds for OpenAPI validation
};

// Export as shell script variables when run directly
if (require.main === module) {
  const command = process.argv[2];
  if (command === "--export") {
    // Output shell export statements
    console.log(`# Validation Commands`);
    Object.entries(VALIDATION_COMMANDS).forEach(([key, value]) => {
      console.log(`export VALIDATION_CMD_${key}="${value}"`);
    });
    console.log(`\n# Timeout Durations (seconds)`);
    Object.entries(TIMEOUT_DURATIONS).forEach(([key, value]) => {
      console.log(`export TIMEOUT_${key}=${value}`);
    });
  } else if (command === "--json") {
    // Output as JSON
    console.log(
      JSON.stringify({ VALIDATION_COMMANDS, TIMEOUT_DURATIONS }, null, 2)
    );
  } else {
    // Default: show usage
    console.log(
      "Usage: node scripts/validation-constants.js [--export|--json]"
    );
    console.log("  --export: Output as shell export statements");
    console.log("  --json: Output as JSON");
  }
}

module.exports = { VALIDATION_COMMANDS, TIMEOUT_DURATIONS };
