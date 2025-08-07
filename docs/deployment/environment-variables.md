# Environment Variable Management

This document explains how environment variables are managed in the RSS News Reader application.

## Overview

The RSS News Reader uses environment variables for configuration, with ALL variables being critical for proper application functioning. Missing any variable will cause build or runtime failures.

## Variable Categories

### 1. Client-Side Variables (NEXT*PUBLIC*\*)

These variables MUST be available at **build time** as they are embedded into the client-side JavaScript bundle:

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key for client access
- `NEXT_PUBLIC_BASE_URL` - Base application URL without port
- `NEXT_PUBLIC_APP_URL` - Full application URL with port
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

### 3. Environment-Specific Variables

These allow different configurations for production vs development:

- `PROD_PORT` - Production server port
- `PROD_NODE_ENV` - Production environment setting
- `PROD_NEXT_PUBLIC_BASE_URL` - Production base URL
- `DEV_PORT` - Development server port
- `DEV_NODE_ENV` - Development environment setting
- `DEV_NEXT_PUBLIC_BASE_URL` - Development base URL

## Loading Order and Precedence

1. **Development Server (`npm run dev`)**:

   - Loads from `.env` file
   - Next.js automatically handles NEXT*PUBLIC*\* variables
   - Server-side variables available via `process.env`

2. **Production Build (`npm run build`)**:

   - Pre-build validation runs via `prebuild` script
   - Environment variables must be loaded before build starts
   - NEXT*PUBLIC*\* variables are embedded during build
   - Build script exports all required variables

3. **PM2 Production (`pm2 start`)**:
   - Loads from `.env` file via ecosystem.config.js
   - Runtime variables injected into process
   - Note: NEXT*PUBLIC*\* must already be in the build

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

3. **Production Build & Deploy**:
   ```bash
   ./scripts/build-and-start-prod.sh  # Includes validation
   ```

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

3. **Production Deployment**:
   - Ensure all NEXT*PUBLIC*\* variables are set
   - Run validation before building
   - Use production URLs and ports

## Troubleshooting

### Common Issues

1. **"Missing NEXT*PUBLIC*\* variable" during build**:

   - Variable not exported before build
   - Check `.env` file has the variable
   - Run validation script to verify

2. **"Internal Server Error" in production**:

   - Database credentials missing or incorrect
   - Run validation on production server
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

## PM2 Integration

The `ecosystem.config.js` file:

- Loads `.env` at the top with `require('dotenv').config()`
- Maps variables to each PM2 app's env section
- Handles both development and production configs
- Supports environment-specific overrides

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
