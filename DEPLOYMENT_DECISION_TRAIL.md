# RSS News Reader - Deployment Decision Trail

## Date: July 31, 2025

This document captures the investigation and decision-making process for resolving production server stability issues and exploring deployment alternatives.

## Initial Problem

### Symptoms
- **Both** production and development servers experiencing frequent crashes
- Production server: 51 restarts in 4 hours
- Development server: Also unstable with restarts
- Dev and prod servers running from same project directory
- CSS/JS files not loading properly in dev environment
- Build artifacts getting corrupted/shared between environments
- Claude Code (AI assistant) would accidentally mix prod/dev configurations
- Service disruptions "all too often"

### Root Cause Analysis

**Initial Diagnostics (July 30, 2025 - During Crisis)**:
- **Memory Usage**: 21GB/24GB (87.5% utilized)
- **Free Memory**: Only 2.1GB available
- **Compressed Memory**: 8.4GB (system under heavy pressure)
- **Node.js Processes**: Consuming ~2.5GB total
- **PM2 Status**: Both apps crashing frequently

**Current Diagnostics (July 31, 2025 - 12+ Hours Later)**:
- **Memory Usage**: 17GB/24GB (71% utilized) ✅ Improved
- **Free Memory**: 6.3GB available ✅ 3x improvement
- **Compressed Memory**: 5.3GB (reduced pressure)
- **Node.js Processes**: Only ~338MB total ✅ 87% reduction
- **PM2 Status**: 
  - Dev: Stable (37h uptime, only 2 restarts)
  - Prod: Still showing 51 restarts from earlier
  - Sync: Stable (21h uptime, 1 restart)
- **Load Average**: 5.10 (still elevated but manageable)
- **CPU**: 88% idle (plenty of capacity)

**Primary Causes**:
1. **Memory pressure**: System running at capacity
2. **Shared directory conflicts**: Both environments using same codebase
3. **Build artifact contamination**: Webpack builds interfering with each other
4. **File lock contention**: Concurrent processes competing for same files
5. **Configuration overlap**: Environment variables and build outputs mixing

**Conclusion**: Running two Next.js environments from the same directory on a memory-constrained system created cascading failures.

## Deployment Alternatives Explored

### 1. Vercel Deployment ❌

**Initial Attempt**: Deploy to Vercel for free cloud hosting

**Issues Encountered**:
1. **Dependency Conflicts**: `vitest@2.0.5` vs `@vitest/ui@3.2.4` mismatch
2. **Environment Variables**: Validation script required `.env` file (not present on Vercel)
3. **OAuth Architecture Problem**: 
   - Current setup stores tokens at `~/.rss-reader/tokens.json`
   - Vercel has no persistent filesystem
   - Would require major refactoring to store tokens in Supabase

**Why Discarded**: 
- Requires significant code changes for token management
- OAuth redirect URI conflicts between local dev and production
- Complexity outweighs benefits for a personal project

### 2. Digital Ocean Droplet 💰

**Proposed Setup**: 2GB Droplet at $12/month

**Architecture**:
```
DigitalOcean Droplet ($12/mo)
├── Next.js App (PM2)
├── Sync Services (PM2)
├── Nginx (reverse proxy)
└── OAuth tokens in Supabase
```

**Pros**:
- Full control over environment
- Persistent storage
- Can run all services

**Why Discarded**:
- Monthly cost for personal project
- Still requires OAuth token refactoring
- Server maintenance overhead
- Overkill for single-user application

### 3. GitHub Codespaces 💸

**Proposed Setup**: 4-core, 16GB RAM Codespace

**Cost Analysis**:
- Estimated by user: $20.30/month (10 hrs/week)
- Actual for 24/7: $259.20/month (720 hrs)
- Storage: Additional $0.70/month

**Why Discarded**:
- Extremely expensive for always-on hosting
- 18x more expensive than initial estimate
- Not designed for production hosting
- Better suited for development environments

### 4. Docker on Mac Mini 🐳

**Proposed Setup**: Containerized services on local Mac Mini

```yaml
services:
  app:
    ports: ["3147:3000"]
    volumes: ["~/.rss-reader:/app/tokens"]
  sync-cron:
    volumes: ["~/.rss-reader:/app/tokens"]
```

**Pros**:
- Isolation between services
- Easy updates and rollbacks
- No architecture changes needed

**Why Discarded**:
- Doesn't solve the underlying resource issue
- Adds container overhead to already constrained system
- More complexity without addressing root cause

### 5. Hybrid Approach (Vercel + Mac Mini) 🔄

**Proposed Setup**:
- Vercel: Read-only public viewer
- Mac Mini: Auth & sync server only

**Why Discarded**:
- Still maintains two environments
- Doesn't reduce resource usage on Mac Mini
- Adds deployment complexity

## OAuth Constraint Analysis

### The Single App Problem
- Inoreader allows only ONE OAuth application
- Current redirect URI: `http://localhost:8080/auth/callback`
- Cloud deployment needs: `https://shayon.one/reader/api/auth/callback`
- Cannot have both without manual switching

### Token Storage Challenge
- Current: Local file at `~/.rss-reader/tokens.json`
- Cloud needs: Database storage (Supabase) or KV store
- Requires significant refactoring of token management code

## Final Decision: Dev-Only Environment ✅

### What This Means
1. **Stop production server** permanently
2. **Run only development server** on Mac Mini
3. **Access via**: `http://100.96.166.53:3000/reader`
4. **Defer cloud deployment** until actually needed

### Git Branch Strategy
1. **`dev` branch**: Active development and testing
   - All feature development happens here
   - All testing conducted on dev environment
   - Daily usage and experimentation
   - May contain work-in-progress features

2. **`main` branch**: Stable, tested releases only
   - Only receives tested code from dev
   - Used for future cloud deployments
   - Represents production-ready state
   - No direct development on main

### Implementation
```bash
pm2 stop rss-reader-prod
pm2 delete rss-reader-prod
pm2 save
# Dev server continues running at port 3000
```

### Why This Works
1. **Immediate Resource Relief**:
   - Frees ~50MB direct memory
   - Eliminates crash/restart cycles
   - Reduces overall system load by ~50%

2. **Simplification**:
   - One environment to maintain
   - No prod/dev synchronization issues
   - No duplicate build processes
   - Clear separation between development (dev branch) and releases (main branch)

3. **Development Workflow**:
   - All experimentation on dev branch/environment
   - Test features thoroughly before merging to main
   - Main branch stays deployment-ready
   - No risk of breaking "production" during development

4. **Cost Effective**:
   - $0/month (existing hardware)
   - No cloud services to manage
   - No refactoring required

5. **Future Flexibility**:
   - Can deploy to cloud when needed
   - Architecture decisions deferred
   - Time to properly plan OAuth strategy
   - Main branch ready for deployment at any time

### Supporting Data
- Dev server: Only 2 restarts (stable)
- Prod server: 51 restarts in 4 hours (unstable)
- Dev server already handles the workload fine

## Lessons Learned

1. **Resource Constraints**: Running duplicate environments on limited hardware causes instability
2. **OAuth Limitations**: Single app restriction significantly complicates cloud deployment
3. **Over-Engineering**: Production environment unnecessary for single-user application
4. **Cost Reality**: Cloud hosting for 24/7 apps is expensive ($12-260/month)
5. **Pragmatism Wins**: Simplest solution often best for personal projects

## Future Considerations

When ready for public release, revisit with:
1. Proper OAuth token management design
2. Budget for cloud hosting
3. Clear user requirements
4. Potentially multiple Inoreader accounts for dev/prod OAuth apps

## Decision Summary

**From**: Unstable dual-environment setup causing crashes
**To**: Stable single development environment
**Result**: Immediate problem solved, complexity reduced, options preserved

---

*"I'm not even a dev" - Sometimes the best production environment is no production environment.*