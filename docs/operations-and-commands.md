# Operations & Commands Reference

A consolidated reference of common commands (npm scripts, PM2, and helper scripts) for developing, running, and operating the RSS News Reader.

## npm scripts (package.json)

- dev: Start Next.js dev server
  - `npm run dev`
- dev:network: Start dev server listening on 0.0.0.0
  - `npm run dev:network`
- dev:https: Start custom HTTPS dev server via `server.js`
  - `npm run dev:https`
- dev:debug: Start dev server with Node inspector
  - `npm run dev:debug`
- dev:turbo: Start dev with Turbo mode
  - `npm run dev:turbo`
- prebuild: Validate env before build
  - runs automatically before build
- build: Production build
  - `npm run build`
- start: Start production server
  - `npm run start`
- lint: ESLint
  - `npm run lint`
- type-check: TypeScript check (dev config)
  - `npm run type-check`
- type-check:prod: TypeScript check (prod config)
  - `npm run type-check:prod`
- test (safe runner): Memory-safe test runner
  - `npm test`
- test:unit: Unit tests
  - `npm run test:unit`
- test:integration: Integration tests
  - `npm run test:integration`
- test:integration:safe: Integration tests with PM2 service management
  - `npm run test:integration:safe`
- test:e2e: Playwright e2e tests
  - `npm run test:e2e`
- test:watch: Vitest watch mode
  - `npm run test:watch`
- analyze: Bundle analyzer (build)
  - `npm run analyze`
- clean: Remove build caches
  - `npm run clean`
- format / format:check: Prettier write/check
  - `npm run format`
  - `npm run format:check`
- pre-commit: Type-check, lint, format check
  - `npm run pre-commit`
- setup:oauth: One-time OAuth setup (server)
  - `npm run setup:oauth`
- server / server:dev: Run legacy/aux server (if needed)
  - `npm run server`
  - `npm run server:dev`
- backup:claude: Backup Claude data to dev
  - `npm run backup:claude`
- export:insomnia: Export OpenAPI spec to Insomnia format
  - `npm run export:insomnia`

### Documentation Workflow Scripts (RR-208)

- docs:validate: Validate OpenAPI coverage (45/45 endpoints, <2s)
  - `npm run docs:validate`
- docs:coverage: Generate detailed OpenAPI coverage report
  - `npm run docs:coverage`
- docs:serve: Start dev server and open Swagger UI
  - `npm run docs:serve`

## PM2 processes (ecosystem.config.js)

- rss-reader-dev: Next.js dev app (port 3000)
- rss-sync-cron: Scheduled sync (6x daily)
- rss-sync-server: Bi-directional sync server (port 3001)
- rss-services-monitor: Service recovery/monitoring script
- kuma-push-monitor: Uptime Kuma push daemon

> Important: Always use PM2 to start/stop/restart the development server (`rss-reader-dev`). Avoid managing it directly with raw npm commands during operations, as that bypasses monitoring and stability controls.

### Common PM2 commands

- Start all services
  - `pm2 start ecosystem.config.js`
- Start one service
  - `pm2 start ecosystem.config.js --only <name>`
- Status / List
  - `pm2 status`
  - `pm2 list`
- Logs (all / specific)
  - `pm2 logs`
  - `pm2 logs rss-reader-dev --lines 50`
  - `pm2 logs rss-sync-cron --lines 50`
  - `pm2 logs rss-sync-server --lines 50`
- Describe / Env / Show
  - `pm2 describe <name>`
  - `pm2 env <name>`
  - `pm2 show <name>`
- Restart / Stop
  - `pm2 restart <name>`
  - `pm2 restart all`
  - `pm2 stop <name>`
  - `pm2 stop all`
- Monitor resources
  - `pm2 monit`
- Persist startup (optional)
  - `pm2 save`
  - `pm2 startup` (follow printed instructions)

### Service-specific examples

- rss-reader-dev (app)
  - Start: `pm2 start ecosystem.config.js --only rss-reader-dev`
  - Logs: `pm2 logs rss-reader-dev --lines 50`
  - Restart: `pm2 restart rss-reader-dev`
  - Stop: `pm2 stop rss-reader-dev`
- rss-sync-cron (scheduled sync)
  - Start only: `pm2 start ecosystem.config.js --only rss-sync-cron`
  - Logs: `pm2 logs rss-sync-cron --lines 50`
  - Details: `pm2 show rss-sync-cron`
- rss-sync-server (bi-directional)
  - Logs: `pm2 logs rss-sync-server --lines 50`
  - Restart: `pm2 restart rss-sync-server`
- rss-services-monitor (recovery)
  - Start only: `pm2 start ecosystem.config.js --only rss-services-monitor`
  - Logs: `pm2 logs rss-services-monitor --lines 50`
- kuma-push-monitor (Uptime Kuma)
  - Logs: `pm2 logs kuma-push-monitor --lines 50`

## Helper scripts (./scripts)

- monitor-dashboard.sh: One-shot consolidated status dashboard
  - `./scripts/monitor-dashboard.sh`
- sync-health-monitor.sh: Check/daemonize sync health monitoring
  - `./scripts/sync-health-monitor.sh check`
  - `./scripts/sync-health-monitor.sh daemon`
- monitor-services.sh: Service recovery monitor
  - `./scripts/monitor-services.sh start`
- validate-env.sh: Validate environment variables
  - `./scripts/validate-env.sh`
- validate-build.sh: Validate build safety (basic/full)
  - `./scripts/validate-build.sh --mode basic`
  - `./scripts/validate-build.sh --mode full`
- kill-test-processes.sh / monitor-test-processes.sh: Test process management
  - `./scripts/kill-test-processes.sh`
  - `./scripts/monitor-test-processes.sh`

## Health endpoints (dev)

- Application health: `GET /reader/api/health/app`
- Database health: `GET /reader/api/health/db`
- Cron status: `GET /reader/api/health/cron`

Example:

```bash
curl -s http://localhost:3000/reader/api/health/app | jq .
```
