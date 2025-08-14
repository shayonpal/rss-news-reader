# Environment Variable Management

This document explains how environment variables are managed in the RSS News Reader application.

## Overview

The RSS News Reader dev server uses environment variables for configuration. Core variables are validated before build/runtime. Some variables are optional (tooling/monitoring) and won't block builds.

## Variable Categories

### 1. Client-Side Variables (NEXT*PUBLIC*\*)

These variables MUST be available at **build time** as they are embedded into the client-side JavaScript bundle:

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key for client access
- `NEXT_PUBLIC_BASE_URL` - Base application URL without port (dev example: `http://100.96.166.53`)
- `NEXT_PUBLIC_APP_URL` - Full application URL with port (dev example: `http://100.96.166.53:3000`)
- `NEXT_PUBLIC_INOREADER_CLIENT_ID` - OAuth client ID
- `NEXT_PUBLIC_INOREADER_REDIRECT_URI` - OAuth redirect URL

### 2. Server-Side Variables

These variables are used at runtime by the server:

- `INOREADER_CLIENT_ID` - OAuth client ID (same as NEXT_PUBLIC version)
- `INOREADER_CLIENT_SECRET` - OAuth client secret
- `INOREADER_REDIRECT_URI` - OAuth callback URL
- `ANTHROPIC_API_KEY` - Claude API key
- `CLAUDE_SUMMARIZATION_MODEL` - AI model selection
- `TOKEN_ENCRYPTION_KEY` - For encrypting OAuth tokens
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side database access
- `SERVER_PORT` - OAuth server port
- `RSS_READER_TOKENS_PATH` - Token storage location
- `SYNC_MAX_ARTICLES` - Articles per incremental sync operation (default: 500, RR-149)
- `ARTICLES_RETENTION_LIMIT` - Maximum articles to retain (default: 1000, enforced during sync, RR-149)
- `SUMMARY_WORD_COUNT` - AI summary length
- `SUMMARY_FOCUS` - AI summary focus
- `SUMMARY_STYLE` - AI summary style
- `TEST_INOREADER_EMAIL` - Test account email
- `TEST_INOREADER_PASSWORD` - Test account password
- `NODE_ENV` - Environment mode

### 3. Environment-Specific Variables (Dev Only)

Production environment has been removed (RR-92). Only development overrides remain:

- `DEV_PORT` - Development server port
- `DEV_NODE_ENV` - Development environment setting
- `DEV_NEXT_PUBLIC_BASE_URL` - Development base URL

Additional development/runtime helpers:

- `PORT` - Port for Next.js dev server (used by PM2 dev app)
- `NEXT_BUILD_DIR` - Optional Next.js build directory override

## Loading Order and Precedence

1. **Development Server (`npm run dev`)**:
   - Loads from `.env` file
   - Next.js automatically handles NEXT*PUBLIC*\* variables
   - Server-side variables available via `process.env`

2. **Build (`npm run build`, optional for dev)**:
   - Pre-build validation runs via `prebuild` script
   - Environment variables must be loaded before build starts (if you build locally)
   - NEXT*PUBLIC*\* variables are embedded during build
   - Build script exports all required variables

3. **PM2-managed Processes (dev)**:
   - Loads from `.env` via `ecosystem.config.js`
   - Each app (dev server, cron, sync, monitors) injects its own env
   - Note: `NEXT_PUBLIC_*` must already be embedded at build time

## Build-Time vs Runtime Requirements

### Build-Time (Required for `npm run build`)

- All `NEXT_PUBLIC_*` variables
- `NODE_ENV`
- Build process will fail if any are missing

### Runtime (Required when server starts)

- All server-side variables
- Database credentials
- API keys
- Configuration values

## Validation System

### Automatic Validation

1. **Pre-build Validation**:

   ```bash
   npm run build  # Automatically runs ./scripts/validate-env.sh
   ```

2. **Manual Validation**:

   ```bash
   ./scripts/validate-env.sh
   ```

3. **PM2 Apps**:
   - `ecosystem.config.js` loads `.env` and passes vars to each app

### Validation Features

- Checks all required variables exist
- Validates URL formats
- Validates NODE_ENV values
- Validates numeric values
- Shows masked values for sensitive data
- Fails fast on any missing variable

## Setting Up Environment Variables

1. **Initial Setup**:

   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

2. **Verify Setup**:

   ```bash
   ./scripts/validate-env.sh
   ```

3. **Deployment**:
   - Ensure all NEXT*PUBLIC*\* variables are set
   - Run validation before building
   - Use environment-appropriate URLs and ports

## Troubleshooting

### Common Issues

1. **"Missing NEXT*PUBLIC*\* variable" during build**:
   - Variable not exported before build
   - Check `.env` file has the variable
   - Run validation script to verify

2. **"Internal Server Error" in production**:
   - Database credentials missing or incorrect
   - Run validation on development server
   - Check PM2 logs for specific errors

3. **Client features not working**:
   - NEXT*PUBLIC*\* variables not in build
   - Rebuild with proper environment
   - Verify build-time exports

### Debug Commands

```bash
# Check current environment
env | grep NEXT_PUBLIC

# Validate environment
./scripts/validate-env.sh

# Test build with validation
npm run build

# Check PM2 environment
pm2 env 0
```

## Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` as template
2. **Keep sensitive values secure** - API keys, passwords, secrets
3. **Use strong encryption keys** - Generate with `openssl rand -base64 32`
4. **Rotate credentials regularly** - Especially after team changes
5. **Limit access to production `.env`** - Use proper file permissions

## PM2 Integration (Dev Only)

The `ecosystem.config.js` file:

- Loads `.env` with `require('dotenv').config()`
- Maps variables to each PM2 app's `env` section
- Dev-only setup (production removed per RR-92)
- Adds extra variables for cron/sync/monitoring apps (see next section)

### PM2/Monitoring and Cron Variables

These are used by PM2-managed jobs and monitors (dev):

- `ENABLE_AUTO_SYNC` - Enable scheduled sync in cron job
- `SYNC_CRON_SCHEDULE` - Cron expression for sync cadence
- `SYNC_LOG_PATH` - Path for sync log jsonl
- `SYNC_INTERVAL_MINUTES` - Sync server interval minutes
- `SYNC_MIN_CHANGES` - Minimum changes before push
- `SYNC_BATCH_SIZE` - Batch size for sync operations
- `SYNC_MAX_RETRIES` - Max retries for failed batches
- `SYNC_RETRY_BACKOFF_MINUTES` - Backoff between retries
- `HEALTH_URL` - App health endpoint for monitor
- `DISCORD_WEBHOOK_URL` - Optional webhook for alerts
- `CHECK_INTERVAL` - Monitor check interval (seconds)
- `MAX_RESTARTS_PER_HOUR` - Monitor restart rate limit
- `RESTART_COOLDOWN` - Seconds between restart attempts
- `LOG_FILE` / `ERROR_LOG` - Monitor log paths
- `SYNC_PUSH_INTERVAL` - Uptime Kuma push interval for sync health
- `DB_PUSH_INTERVAL` - Uptime Kuma push interval for DB health
- `FETCH_PUSH_INTERVAL` - Uptime Kuma push interval for fetch stats
- `API_PUSH_INTERVAL` - Uptime Kuma push interval for API stats

These variables are app-specific inside `ecosystem.config.js` and are not required for `npm run dev`.

## Next.js Integration

Next.js handles NEXT*PUBLIC*\* variables specially:

- Must be available at build time
- Embedded into client JavaScript
- Cannot be changed at runtime
- Accessible in browser code

Regular variables:

- Only available server-side
- Can be changed at runtime
- Not exposed to client code
- More secure for sensitive data

## Optional / Tooling Variables

These are not required by the app build/runtime, but may be used by tooling or scripts:

- `OPENAI_API_KEY` - Optional, used for code review tooling
- `SUPABASE_URL` - Optional legacy compatibility (app prefers `NEXT_PUBLIC_SUPABASE_URL`)
- `INOREADER_OAUTH_REDIRECT_URI` - Optional override used by server OAuth scripts

Refer to `ecosystem.config.js` for PM2-only variables and defaults.
