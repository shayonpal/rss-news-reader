# Quick Setup Guide

Get the RSS News Reader up and running in under 10 minutes.

## Prerequisites

Ensure you have:

- **Node.js** 18.17+ and **npm** 9.0+
- **Git**
- **Supabase account** (free tier works)
- **Inoreader account** (for RSS syncing)

## 5-Minute Setup

### 1. Clone & Install

```bash
# Clone stable version
git clone https://github.com/shayonpal/rss-news-reader.git
cd rss-news-reader

# Or clone latest features (may have bugs)
git clone -b dev https://github.com/shayonpal/rss-news-reader.git
cd rss-news-reader

# Install dependencies
npm install
```

### 2. Configure Environment

```bash
# Copy example config
cp .env.example .env
```

Edit `.env` and add your credentials:

```bash
# Required: Supabase (get from your project settings)
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Required: Inoreader OAuth (get from https://www.inoreader.com/developers/apps)
INOREADER_CLIENT_ID=your-client-id
INOREADER_CLIENT_SECRET=your-client-secret
INOREADER_REDIRECT_URI=http://localhost:3000/api/auth/inoreader/callback

# Optional: AI Summaries (get from https://console.anthropic.com)
ANTHROPIC_API_KEY=your-api-key

# Application URL (adjust for your setup)
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost
PORT=3000
```

### 3. Setup OAuth & Database

```bash
# One-time OAuth setup (opens browser for authorization)
npm run setup:oauth

# The script will:
# 1. Open Inoreader login in your browser
# 2. Save encrypted tokens to ~/.rss-reader/tokens.json
# 3. Confirm successful authentication
```

### 4. Start the Application

```bash
# Development mode (with hot reload)
npm run dev

# Or production mode with PM2
npm run pm2:start:dev
```

### 5. Access the App

Open your browser to: `http://localhost:3000/reader`

🎉 **That's it!** You should see your RSS feeds loading.

## Quick Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run pre-commit      # Run all quality checks

# PM2 Services
npm run pm2:start:dev   # Start all services
npm run pm2:stop        # Stop all services
npm run pm2:status      # Check service status
npm run pm2:logs        # View service logs

# Testing
npm test                # Run tests (fast mode)
npm run test:e2e        # Run E2E tests

# Maintenance
npm run sync:now        # Trigger manual sync
npm run cleanup         # Clean old articles
```

## Verify Installation

Check that everything is working:

1. **Health Check**: Visit `http://localhost:3000/reader/api/health/app`
   - Should show `"status": "healthy"`

2. **Database Connection**: Visit `http://localhost:3000/reader/api/health/db`
   - Should show database connected

3. **Sync Status**: Check PM2 logs

   ```bash
   npm run pm2:logs rss-sync-cron
   ```

   - Should show sync running every 4 hours

## Common Issues

### Port Already in Use

```bash
# Change port in .env
PORT=3001
```

### OAuth Token Issues

```bash
# Re-run OAuth setup
rm -rf ~/.rss-reader/tokens.json
npm run setup:oauth
```

### Database Connection Failed

- Check Supabase credentials in `.env`
- Ensure Supabase project is active
- Verify service role key has proper permissions

### Sync Not Working

```bash
# Check sync service
npm run pm2:logs rss-sync-server

# Restart sync services
npm run pm2:restart rss-sync-cron
npm run pm2:restart rss-sync-server
```

## Security Notes

⚠️ **Important**: The application has NO built-in authentication. Secure it by:

1. **Local Development**: No additional security needed
2. **Network Deployment**: Use one of:
   - VPN (like Tailscale)
   - Reverse proxy with authentication (nginx, Caddy)
   - Firewall rules
   - Cloud provider security groups

## Next Steps

- 📖 Read the [full README](../README.md) for detailed features
- 🎨 Explore the [UI/UX documentation](./ui-ux/liquid-glass-design-guidelines.md)
- 🔧 Check [API documentation](http://localhost:3000/reader/api-docs)
- 🚀 Learn about [deployment options](./deployment/README.md)

## Need Help?

- Check [troubleshooting guide](./troubleshooting/)
- Review [server health endpoints](./monitoring/server-health-endpoints.md)
- See [operations commands](./operations-and-commands.md)

---

**Tip**: For the absolute fastest setup, use the default localhost configuration and run `npm run dev` after setting up your `.env` file!
