# Configuration Hierarchy

This document describes the configuration structure after the RR-74 cleanup.

## Configuration Files

### TypeScript Configuration

- **tsconfig.json** - Primary TypeScript configuration for the project
  - Used for development and build processes
  - Extends Next.js base configuration
  - Production configuration has been consolidated (tsconfig.prod.json removed)

### Vitest Test Configuration

- **vitest.config.ts** - Unit test configuration
- **vitest.config.integration.ts** - Integration test configuration
- **vitest.config.e2e.ts** - End-to-end test configuration

### PM2 Process Management

- **ecosystem.config.js** - PM2 configuration for all services
  - rss-reader-dev (port 3000)
  - rss-sync-server (port 3001)
  - rss-sync-cron (scheduled sync)
  - rss-services-monitor (health monitoring)
  - kuma-push-monitor (Uptime Kuma integration - currently inactive)

## Scripts Organization

### Core Test Runners

These scripts serve distinct purposes and should be maintained:

- **run-critical-tests.sh** - CI/CD critical test execution
- **safe-test-runner.sh** - Fallback test runner with npm test
- **optimized-test-runner.sh** - Primary test runner with optimization

### Monitoring Scripts

- **monitor-services-pm2.sh** - PM2-specific monitoring wrapper (used in ecosystem.config.js)
- **monitor-services.sh** - Standalone monitoring script with command arguments
- **monitor-dashboard.sh** - Visual dashboard for monitoring
- **check-services.sh** - Quick service status check

### Validation Scripts

- **validate-env.sh** - Environment variable validation (pre-build)
- **validate-build.sh** - Build output validation

## Environment Configuration

- **.env** - Primary environment variables file
- All production-specific configurations have been removed
- Development-only setup maintained

## Package Scripts

Key npm scripts in package.json:

- `npm run dev` - Start development server
- `npm run build` - Build the application
- `npm test` - Run unit tests
- `npm run test:integration` - Run integration tests
- `npm run test:e2e` - Run E2E tests
- `npm run type-check` - TypeScript type checking
- `npm run lint` - ESLint checking
- `npm run pre-commit` - Pre-commit validation

## Notes

- All production configurations have been removed as per RR-92 through RR-104
- Uptime Kuma integration is currently inactive but scripts retained for future use
- Configuration follows a single-environment (development) approach
