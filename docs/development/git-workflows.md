# Git Workflows & Quality Gates

This document describes the git workflows and automated quality gates implemented for the RSS News Reader project, including the comprehensive pre-commit hook system (RR-210).

## Git Pre-commit Hook (RR-210)

### Overview

The RSS News Reader implements a comprehensive git pre-commit hook that enforces 100% OpenAPI documentation coverage and code quality standards before allowing commits. This ensures that all code contributions maintain high quality and complete API documentation.

### Implementation Details

**Hook Location**: `.git/hooks/pre-commit`  
**Associated Files**:

- `src/lib/constants/validation-commands.ts` - Shared constants module
- `scripts/validation-constants.js` - Shell script constants
- `src/__tests__/integration/rr-210-git-hook.test.ts` - Comprehensive test suite

### Validation Steps

The pre-commit hook runs four validation steps in sequence with individual failure tracking:

#### 1. Type Check (30s timeout)

- **Command**: `npm run type-check`
- **Purpose**: Ensures TypeScript compilation succeeds
- **Failure Impact**: Blocks commit immediately

#### 2. Lint Check (30s timeout)

- **Command**: `npm run lint`
- **Purpose**: Validates ESLint code quality standards
- **Failure Impact**: Blocks commit immediately

#### 3. Format Check (30s timeout)

- **Command**: `npm run format:check`
- **Purpose**: Verifies Prettier code formatting
- **Failure Impact**: Non-blocking for OpenAPI validation (warning only if OpenAPI passes)

#### 4. OpenAPI Documentation (60s timeout)

- **Command**: `npm run docs:validate`
- **Purpose**: Enforces 100% API documentation coverage (45/45 endpoints)
- **Failure Impact**: Blocks commit if any endpoints lack proper documentation

### Hook Features

#### Individual Failure Tracking

- Each validation step is tracked separately
- Collects all failures before reporting
- Provides specific error messages for each failed check

#### Timeout Protection

- Prevents infinite loops or hanging on network issues
- 30 seconds for basic checks (type-check, lint, format)
- 60 seconds for OpenAPI validation (requires dev server connection)

#### Graceful Fallback

- Continues validation when development server is unavailable
- Warns user about skipped OpenAPI validation
- Provides recovery instructions

#### Clear Error Messages

```bash
❌ Type check failed
❌ Lint check failed
❌ Format check failed
❌ OpenAPI documentation validation failed

💡 Fix the above issues and try committing again.
   Run individual commands to debug specific failures:
   - npm run type-check
   - npm run lint
   - npm run format
   - npm run docs:validate
```

#### Emergency Bypass

```bash
# Not recommended - use only in true emergencies
git commit --no-verify -m "emergency commit"
```

### Performance Characteristics

- **Total Execution Time**: Under 90 seconds
- **Early Termination**: Stops on critical failures for faster feedback
- **Parallel Execution**: Where possible, optimized for concurrent validation
- **Resource Management**: Proper cleanup and timeout handling

### Integration with Existing Workflow

The pre-commit hook integrates seamlessly with the existing development workflow:

```bash
# Standard development flow - hook runs automatically
git add .
git commit -m "implement new feature"

# Manual validation - same checks as hook
npm run pre-commit

# Individual validation steps for debugging
npm run type-check
npm run lint
npm run format:check
npm run docs:validate
```

### Test Coverage

Comprehensive test suite at `src/__tests__/integration/rr-210-git-hook.test.ts` with 19 test scenarios:

**Core Functionality Tests**:

- Hook installation and executable permissions
- Integration with existing npm pre-commit workflow
- Individual validation step execution
- Error message formatting and clarity

**Edge Case Coverage**:

- Network timeout handling
- Development server unavailable scenarios
- Permission denied errors
- Mixed failure combinations
- Emergency bypass functionality

**Error Recovery Testing**:

- Clear recovery instructions for each failure type
- Validation of error message patterns
- Timeout behavior under various conditions

### OpenAPI Documentation Enforcement

The hook ensures 100% documentation coverage for all API endpoints:

**Current Coverage**: 45/45 endpoints (100%)

**Categories Enforced**:

- Health endpoints (6): System status monitoring
- Sync endpoints (7): Data synchronization operations
- Articles endpoints (4): Content management
- Tags endpoints (5): Tag CRUD operations
- Inoreader endpoints (8): External API integration
- Auth endpoints (1): Authentication status
- Test endpoints (7): Development utilities
- Analytics endpoints (1): Usage metrics
- Feeds endpoints (2): Feed management
- Users endpoints (2): User preferences
- Logs endpoints (1): API call logging
- Insomnia endpoints (1): Export functionality

**Validation Process**:

1. Starts development server if not running
2. Fetches OpenAPI specification from `/api-docs/openapi.json`
3. Validates each endpoint has complete documentation
4. Ensures all endpoints have proper schemas, examples, and descriptions
5. Blocks commit if any endpoint lacks proper documentation

### Developer Experience

**Positive Developer Experience**:

- Fast feedback on quality issues
- Clear error messages with recovery instructions
- Non-disruptive to normal development flow
- Consistent quality standards across all contributions

**Performance Optimized**:

- Parallel execution where possible
- Early termination on critical failures
- Reasonable timeout values
- Progress indicators during validation

**Emergency Procedures**:

- `--no-verify` flag available for true emergencies
- Clear documentation of bypass procedures
- Encouragement to fix issues rather than bypass

### Troubleshooting

**Common Issues and Solutions**:

#### Development Server Not Running

```bash
# Error: Could not connect to development server
# Solution: Start the development server
npm run dev
# Then retry commit
```

#### OpenAPI Validation Timeout

```bash
# Error: OpenAPI validation timed out
# Solution: Check server status and network connectivity
curl -s http://localhost:3000/reader/api/health
npm run docs:validate
```

#### Permission Denied

```bash
# Error: EACCES: permission denied
# Solution: Fix hook permissions
chmod +x .git/hooks/pre-commit
```

#### Multiple Validation Failures

```bash
# Hook reports all failures, fix them in order:
# 1. Fix TypeScript errors: npm run type-check
# 2. Fix linting issues: npm run lint
# 3. Fix formatting: npm run format
# 4. Ensure API documentation: npm run docs:validate
```

### Future Enhancements

**Planned Improvements**:

- Pre-push hook for comprehensive test suite execution
- Commit message format validation (conventional commits)
- Integration with CI/CD pipeline for enhanced validation
- Customizable timeout values via configuration
- Enhanced progress reporting during long operations

**Advanced Features Under Consideration**:

- Selective validation based on changed files
- Cache validation results for unchanged code
- Integration with IDE extensions for real-time feedback
- Custom validation rules per project area

### Comparison with CI/CD Pipeline

The pre-commit hook provides a subset of the full CI/CD validation:

**Pre-commit Hook (Local)**:

- Type checking
- Linting
- Formatting
- OpenAPI documentation
- ~90 seconds execution time

**CI/CD Pipeline (Remote)**:

- All pre-commit validations
- Full test suite execution
- Cross-browser E2E testing
- Security scanning
- Performance regression testing
- ~15-30 minutes execution time

This layered approach provides fast local feedback while ensuring comprehensive validation in the CI/CD pipeline.

---

The git pre-commit hook system ensures consistent code quality and complete API documentation across all contributions to the RSS News Reader project, providing fast feedback to developers while maintaining high standards.
