# Suggested Commands for RSS News Reader

## Essential Development Commands

### Initial Setup

```bash
npm install                      # Install dependencies
./scripts/validate-env.sh        # Validate environment variables
npm run setup:oauth              # Set up OAuth tokens (one-time)
```

### Development Server

```bash
npm run dev                      # Start Next.js dev server
pm2 restart rss-dev-server       # Restart PM2 dev server
pm2 status                       # Check service status
pm2 logs rss-reader-dev          # View application logs
```

### Quality Checks (Run Before Commits)

```bash
npm run pre-commit               # Run all checks (type-check, lint, format)
npm run type-check               # TypeScript type checking
npm run lint                     # ESLint checking
npm run format:check             # Prettier format check
```

### Testing

```bash
npm run test                     # Run all tests safely
npm run test:unit                # Unit tests only
npm run test:integration         # Integration tests
npm run test:e2e                 # Playwright E2E tests
```

### Building & Deployment

```bash
npm run build                    # Build production bundle
pm2 start ecosystem.config.js    # Start all services
pm2 save                         # Save PM2 process list
```

### Monitoring & Debugging

```bash
pm2 monit                        # Interactive monitoring
./scripts/monitor-dashboard.sh   # Service health dashboard
./scripts/sync-health-monitor.sh # Sync status monitor
```

### Git Commands (Darwin/macOS)

```bash
git status                       # Check changes
git diff                         # View changes
git add .                        # Stage changes
git commit -m "message"          # Commit changes
git push origin dev              # Push to dev branch
```

### File System (Darwin/macOS)

```bash
ls -la                          # List files with details
find . -name "*.ts"             # Find TypeScript files
grep -r "pattern" src/          # Search in source files
tail -f logs/sync-cron.jsonl    # Follow sync logs
```

### Database

```bash
npx supabase db diff            # Check migration status
npx supabase migration new      # Create new migration
```

## Important Notes

- Always run `npm run pre-commit` before committing
- Never commit without explicit permission
- Tests are the specification - fix code, not tests
- All API routes require `/reader` prefix
