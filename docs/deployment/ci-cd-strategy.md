# CI/CD Strategy - Blue-Green Deployment

**Last Updated:** July 22, 2025  
**Status:** Final Implementation Strategy

## Overview

This document outlines the complete CI/CD strategy for the RSS News Reader PWA using a simplified Blue-Green Deployment pattern optimized for solo development. The strategy enables continuous development without disrupting the production application while maintaining a simple, manageable workflow.

## Architecture Overview

### Deployment Model: Blue-Green with GitFlow

- **Blue Environment**: Production (stable, user-facing)
- **Green Environment**: Development (staging, testing)
- **Git Strategy**: Two-branch model (main + dev)
- **Zero-downtime**: PM2 reload for seamless updates

### Key Components

1. **PM2 Process Manager**: Manages both production and development instances
2. **Port Allocation**:
   - Production: Port 3147 (uncommon port to avoid conflicts)
   - Development: Port 3000 (standard Next.js dev port)
3. **Database Strategy**: Separate development database (Option B from discussion)
4. **Reverse Proxy**: Caddy routes production traffic

## Development Workflow

### 1. Initial Setup (One-time)

```bash
# Clone repository
git clone https://github.com/shayonpal/rss-news-reader.git
cd rss-news-reader

# Create dev branch
git checkout -b dev

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 2. Environment Configuration

#### Single .env File Structure

```env
# ========================================
# SHARED CONFIGURATION
# ========================================
# OAuth Tokens (shared initially)
INOREADER_CLIENT_ID=your_client_id
INOREADER_CLIENT_SECRET=your_client_secret
INOREADER_REDIRECT_URI=http://localhost:8080/callback

# Claude API (shared)
ANTHROPIC_API_KEY=your_anthropic_key
CLAUDE_SUMMARIZATION_MODEL=claude-sonnet-4-20250514

# ========================================
# PRODUCTION CONFIGURATION
# ========================================
# Production Database (Supabase)
PROD_NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
PROD_SUPABASE_SERVICE_ROLE_KEY=your-prod-service-key

# Production Settings
PROD_PORT=3147
PROD_NODE_ENV=production
PROD_NEXT_PUBLIC_BASE_URL=http://100.96.166.53

# ========================================
# DEVELOPMENT CONFIGURATION
# ========================================
# Development Database (Separate Supabase Project)
DEV_NEXT_PUBLIC_SUPABASE_URL=https://your-dev-project.supabase.co
DEV_NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
DEV_SUPABASE_SERVICE_ROLE_KEY=your-dev-service-key

# Development Settings
DEV_PORT=3000
DEV_NODE_ENV=development
DEV_NEXT_PUBLIC_BASE_URL=http://100.96.166.53
```

### 3. PM2 Ecosystem Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    // Production App
    {
      name: "rss-reader-prod",
      script: "npm",
      args: "start",
      cwd: "/Users/shayon/DevProjects/rss-news-reader",
      instances: 1,
      exec_mode: "cluster",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3147,
        // Production database vars
        NEXT_PUBLIC_SUPABASE_URL: process.env.PROD_NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY:
          process.env.PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.PROD_SUPABASE_SERVICE_ROLE_KEY,
        // Shared vars
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        INOREADER_CLIENT_ID: process.env.INOREADER_CLIENT_ID,
        INOREADER_CLIENT_SECRET: process.env.INOREADER_CLIENT_SECRET,
      },
      error_file: "./logs/prod-error.log",
      out_file: "./logs/prod-out.log",
      time: true,
    },

    // Development App
    {
      name: "rss-reader-dev",
      script: "npm",
      args: "run dev",
      cwd: "/Users/shayon/DevProjects/rss-news-reader",
      instances: 1,
      exec_mode: "fork",
      watch: false, // Disable in PM2, Next.js handles HMR
      env: {
        NODE_ENV: "development",
        PORT: 3000,
        // Development database vars
        NEXT_PUBLIC_SUPABASE_URL: process.env.DEV_NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY:
          process.env.DEV_NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.DEV_SUPABASE_SERVICE_ROLE_KEY,
        // Shared vars
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        INOREADER_CLIENT_ID: process.env.INOREADER_CLIENT_ID,
        INOREADER_CLIENT_SECRET: process.env.INOREADER_CLIENT_SECRET,
      },
      error_file: "./logs/dev-error.log",
      out_file: "./logs/dev-out.log",
      time: true,
    },

    // Sync Cron (uses production database)
    {
      name: "rss-sync-cron",
      script: "./src/server/cron.js",
      instances: 1,
      exec_mode: "fork",
      cron_restart: "0 0 * * *", // Daily restart for stability
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
        ENABLE_AUTO_SYNC: "true",
        SYNC_CRON_SCHEDULE: "0 2,14 * * *",
        SYNC_LOG_PATH: "./logs/sync-cron.jsonl",
        // Use production database
        NEXT_PUBLIC_SUPABASE_URL: process.env.PROD_NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY:
          process.env.PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.PROD_SUPABASE_SERVICE_ROLE_KEY,
      },
      error_file: "./logs/cron-error.log",
      out_file: "./logs/cron-out.log",
      time: true,
    },
  ],
};
```

## Daily Development Workflow

### Starting Development

```bash
# 1. Ensure on dev branch
git checkout dev

# 2. Pull latest changes
git pull origin dev

# 3. Start development server (if not using PM2)
npm run dev

# OR start with PM2
pm2 start ecosystem.config.js --only rss-reader-dev

# 4. Access development app
open http://100.96.166.53:3000/reader
```

### Making Changes

1. **Edit code** - Next.js HMR provides instant feedback
2. **Test locally** - Verify changes work correctly
3. **Run quality checks**:
   ```bash
   npm run lint
   npm run type-check
   npm run test
   ```
4. **Commit to dev branch**:
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin dev
   ```

### Testing Build (When Needed)

```bash
# Build check without affecting production
npm run build

# The .next directory is git-ignored
# Production continues running unaffected
```

## Deployment Process

### First Production Deployment

```bash
# 1. Ensure production database is set up
# Create production Supabase project if not exists
# Run all migrations on production database

# 2. On main branch
git checkout main
git pull origin main

# 3. Build production
npm run build

# 4. Start all PM2 processes
pm2 start ecosystem.config.js

# 5. Save PM2 configuration
pm2 save
pm2 startup  # Follow the instructions

# 6. Configure Caddy (one-time)
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy

# 7. Verify production
open http://100.96.166.53/reader
```

### Routine Production Updates

```bash
# 1. Ensure all changes tested on dev branch
git checkout dev
npm run build  # Final build test
npm run test   # All tests pass

# 2. Merge to main
git checkout main
git pull origin main
git merge dev --no-ff -m "Deploy: description of changes"

# 3. Build production
npm run build

# 4. Zero-downtime reload
pm2 reload rss-reader-prod

# 5. Verify deployment
open http://100.96.166.53/reader

# 6. Push main branch
git push origin main

# 7. Continue development
git checkout dev
```

## Database Management

### Development Database Setup

```bash
# 1. Create new Supabase project for development
# 2. Get connection strings and keys
# 3. Add to .env file with DEV_ prefix

# 4. Run migrations on dev database
# Use Supabase dashboard SQL editor or CLI
```

### Database Sync (When Needed)

```bash
# Option 1: Fresh start (recommended)
# Just run a sync in development environment

# Option 2: Copy production data (if needed)
# Use Supabase dashboard to export/import
```

## URL Access Patterns

### Development

- **Direct**: http://100.96.166.53:3000/reader
- **API**: http://100.96.166.53:3000/api/*
- **Database**: Development Supabase project

### Production

- **Via Caddy**: http://100.96.166.53/reader
- **API**: http://100.96.166.53/api/*
- **Database**: Production Supabase project

## Monitoring and Logs

### PM2 Commands

```bash
# View all processes
pm2 status

# Monitor in real-time
pm2 monit

# View logs
pm2 logs rss-reader-prod
pm2 logs rss-reader-dev
pm2 logs rss-sync-cron

# View specific log files
tail -f logs/prod-out.log
tail -f logs/dev-out.log
tail -f logs/sync-cron.jsonl | jq .
```

### Health Checks

```bash
# Check production
curl http://100.96.166.53/reader

# Check development
curl http://100.96.166.53:3000/reader

# Check PM2 processes
pm2 list

# Check Caddy status
sudo systemctl status caddy
```

## Rollback Procedure

### Quick Rollback

```bash
# 1. Revert to previous PM2 saved state
pm2 resurrect

# OR manually restart previous version
pm2 restart rss-reader-prod
```

### Git-based Rollback

```bash
# 1. Find previous working commit
git log --oneline -10

# 2. Revert to specific commit
git checkout main
git revert HEAD  # Or specific commit
git push origin main

# 3. Rebuild and deploy
npm run build
pm2 reload rss-reader-prod
```

## Best Practices

### 1. Development Guidelines

- Always work on `dev` branch for new features
- Test thoroughly before merging to main
- Run quality checks before every commit
- Keep development database separate from production

### 2. Deployment Guidelines

- Build locally before deploying
- Use PM2 reload (not restart) for zero-downtime
- Monitor logs during deployment
- Verify deployment success before leaving

### 3. Branch Management

- `main` branch = production ready code only
- `dev` branch = active development and testing
- No feature branches needed for solo development
- Merge dev � main only when ready to deploy

### 4. Emergency Procedures

- If production fails: `pm2 restart rss-reader-prod`
- If Caddy fails: `sudo systemctl restart caddy`
- If database issues: Check Supabase dashboard
- Keep production logs for debugging

## Security Considerations

1. **Environment Variables**

   - Never commit .env file
   - Keep production keys separate
   - Rotate keys periodically

2. **Database Access**

   - Dev database has separate credentials
   - Use RLS policies on both databases
   - Service role keys server-side only

3. **Network Security**
   - Tailscale VPN restricts access
   - No public internet exposure
   - Internal network only

## Troubleshooting

### Common Issues

1. **Port 3147 already in use**

   ```bash
   # Find process using port
   lsof -i :3147
   # Kill if needed
   kill -9 <PID>
   ```

2. **PM2 process not starting**

   ```bash
   # Check logs
   pm2 logs rss-reader-prod --lines 50
   # Delete and restart
   pm2 delete rss-reader-prod
   pm2 start ecosystem.config.js --only rss-reader-prod
   ```

3. **Build failures**

   ```bash
   # Clear Next.js cache
   rm -rf .next
   npm run build
   ```

4. **Database connection issues**
   - Verify .env variables are correct
   - Check Supabase project is active
   - Ensure service role key is valid

## Summary

This Blue-Green deployment strategy provides:

- **Continuous development** without production impact
- **Simple workflow** suitable for solo developers
- **Zero-downtime deployments** via PM2
- **Clear separation** between dev and prod environments
- **Easy rollback** options for safety

The strategy prioritizes simplicity and reliability while maintaining professional deployment standards.
