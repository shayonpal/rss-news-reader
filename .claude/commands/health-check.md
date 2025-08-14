---
description: Run comprehensive read-only health analysis on RSS News Reader services, database, and sync pipeline
argument-hint: [component - api, db, sync, services, all]
---

Perform a comprehensive health check of this RSS News Reader PWA using read-only analysis.

## What to Check

Parse $ARGUMENTS for component specification:

- **api**: Test API endpoints and server health
- **db**: Verify database connections and performance
- **sync**: Validate sync pipeline and Inoreader integration
- **services**: Inspect PM2 services and processes
- **all** or empty: Run complete system health check (default)

## Required Checks

### 0. Testing Infrastructure Health

Quick validation of test infrastructure:

```bash
npm run type-check  # Should exit 0
npm run lint  # Should pass
npx vitest run --no-coverage src/__tests__/unit/rr-176-auto-parse-logic.test.ts  # Test discovery
```

If any fail → Infrastructure issue detected, use `infra-expert` for fixes

### 1. Service Status

Use `devops-expert-readonly` to check PM2 service status:

- Verify all RSS reader services are running
- Check for any services in error state
- Monitor restart counts and uptime

### 2. API Health

Test both health endpoints and measure response times:

- Hit `/api/health/app` for application health
- Hit `/api/health/db` for database connectivity
- Record status codes and response times

### 3. Database Health

Use `db-expert-readonly` to examine:

- Connection pool status and utilization
- Recent slow queries and performance bottlenecks
- Materialized view `feed_stats` freshness
- Row counts for articles, feeds, and sync tables

### 4. Sync Pipeline

Use read command to check OAuth token file exists:

- Check `~/.rss-reader/tokens.json` file exists
  Use `db-expert-readonly` to analyze:
- Time since last successful sync from sync_metadata
- Sync queue backlog from sync_queue table
- Recent errors from fetch_logs table
- API usage patterns from api_usage table

### 5. Network Access

Verify connectivity using curl or fetch:

- Test Tailscale network access to 100.96.166.53
- Confirm main URL responds on port 3000

### 6. System Resources

Use `devops-expert-readonly` to monitor:

- Disk space usage and availability
- Memory utilization patterns
- Process resource consumption
- PM2 service health metrics

### 7. Error Analysis

Use `devops-expert-readonly` to analyze:

- Recent PM2 error logs
- Sync log error patterns in logs/sync-cron.jsonl
- Service restart frequencies
- Resource constraint warnings

### 8. Performance Metrics

Check test suite and runtime performance:

```bash
# Test execution baseline
npm test  # Should complete in <20s

# Performance regression check
node scripts/check-performance-regression.js
```

## How to Report

Format your findings as a health report using these indicators:

- 🟢 **Healthy**: Component passes all checks
- 🟡 **Warning**: Minor issues detected that need attention soon
- 🔴 **Critical**: Major problems affecting functionality

Include:

- Specific metrics and measurements
- Root cause analysis for any issues
- Clear recommendations for fixes
- Urgency level for each issue

## Read-Only Agent Usage

This command uses read-only agents to gather data:

- `db-expert-readonly`: Database health metrics and query analysis
- `devops-expert-readonly`: System resources and service monitoring
- `docs-expert-readonly`: Configuration and documentation verification

## Reporting Issues

If critical issues are found:

1. Document the problem with specific metrics
2. Suggest using `linear-expert` to create tracking issue
3. Recommend appropriate specialist agent for resolution
4. Provide clear remediation steps

Note: This exercise is to be performed read-only. No files are to be modified or created during health checks.
