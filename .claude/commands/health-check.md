---
description: Run comprehensive health checks on RSS News Reader services, database, and sync pipeline
argument-hint: [component]
---

Perform a comprehensive health check of the RSS News Reader system and report back on its status.

## What to Check

Check the component I specify, or perform a complete system check if I don't specify one:
- **api**: Test API endpoints and server health
- **db**: Verify database connections and performance
- **sync**: Validate sync pipeline and Inoreader integration
- **services**: Inspect PM2 services and processes
- **all**: Run complete system health check (default)

## Required Checks

### 1. Service Status
Run PM2 status checks and verify all RSS reader services are running:
```bash
pm2 status | grep -E "rss-reader|sync"
```

### 2. API Health
Test both health endpoints and measure response times:
- Hit `/api/health/app` for application health
- Hit `/api/health/db` for database connectivity
- Record status codes and response times

### 3. Database Health
Work with `supabase-dba` to examine:
- Connection pool status and utilization
- Recent slow queries and performance bottlenecks
- Materialized view `feed_stats` freshness
- Row counts for articles, feeds, and sync tables

### 4. Sync Pipeline
Collaborate with `sync-reliability-monitor` to check:
- OAuth token validity at `~/.rss-reader/tokens.json`
- Time since last successful sync
- Inoreader API usage (must stay under 100/day limit)
- Sync queue backlog
- Error patterns in sync logs

### 5. Network Access
Verify connectivity:
- Test Tailscale network access to 100.96.166.53
- Confirm production URL responds on port 3147
- Check development URL on port 3000. Dev server should aleady be running.

### 6. System Resources
Monitor resource usage:
```bash
# Check disk space
df -h | grep -E "/$|/Users"

# Check memory usage
vm_stat | grep -E "free|active|wired"

# Check process resources
ps aux | grep -E "node|pm2" | grep -v grep
```

### 7. Error Analysis
Search for recent errors:
```bash
# Scan PM2 logs
pm2 logs --lines 50 | grep -i error

# Check sync logs
tail -n 20 logs/sync-cron.jsonl | jq '.level' | grep -i error
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

## Agent Coordination

- Engage `devops-expert` for infrastructure problems
- Involve `sync-reliability-monitor` for sync issues
- Consult `supabase-dba` for database optimizations
- Have `program-manager` create Linear issues for problems requiring fixes