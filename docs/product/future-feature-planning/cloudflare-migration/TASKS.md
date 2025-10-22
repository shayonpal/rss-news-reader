# CloudFlare Migration Tasks - Make App Accessible at https://reader.uberfolks.ca

## Phase 1: CloudFlare Tunnel Setup

### Infrastructure Setup

- [ ] Install cloudflared on Mac Mini (if not already installed)
- [ ] Authenticate cloudflared with CloudFlare account
- [ ] Create named tunnel "rss-reader"
- [ ] Configure tunnel ingress to point to localhost:3000
- [ ] Route DNS for reader.uberfolks.ca to tunnel
- [ ] Test tunnel connectivity and basic app access

### DNS & Domain Configuration

- [ ] Verify uberfolks.ca domain is in CloudFlare dashboard
- [ ] Create DNS route via Tunnel: `cloudflared tunnel route dns rss-reader reader.uberfolks.ca`
- [ ] Confirm the Tunnel CNAME exists and is proxied automatically (no "orange cloud" toggle needed)
- [ ] Test DNS propagation and domain resolution
- [ ] Verify SSL certificate auto-generation

### URL Redirect & Compatibility Rules

- [ ] Create Cloudflare Redirect Rule: 301 from `/` → `/reader` when Host = `reader.uberfolks.ca`
- [ ] Create temporary compatibility rule: rewrite `/api/*` → `/reader/api/*` (until basePath is removed)
- [ ] Test root domain https://reader.uberfolks.ca redirects to /reader
- [ ] Verify all existing /reader/\* paths work through tunnel
- [ ] Verify client fetches to `/api/*` succeed via the compatibility rule
- [ ] Validate static assets (manifest, icons) load correctly

## Phase 2 (Optional): OAuth Integration

Note: Current production uses the local Playwright setup and token file; there is no `/api/auth/inoreader/callback` route yet. Defer flipping the Inoreader callback until the callback route exists (ideally after basePath removal).

### Inoreader Configuration (do when callback route exists)

- [ ] Update Inoreader app callback URL to `https://reader.uberfolks.ca/reader/api/auth/inoreader/callback`
- [ ] Include `state` with environment hint and `returnTo` in the flow
- [ ] Test OAuth flow end-to-end via public domain
- [ ] Verify token storage and retrieval works through tunnel
- [ ] Validate redirect flow after OAuth completion

### Environment Variable Updates

- [ ] Update NEXT_PUBLIC_APP_URL to https://reader.uberfolks.ca
- [ ] Update INOREADER_REDIRECT_URI to new callback URL (when enabling OAuth via public domain)
- [ ] Update any hardcoded localhost references in config
- [ ] Note: With basePath active, code that builds `${NEXT_PUBLIC_APP_URL}/api/*` relies on the temporary `/api/* → /reader/api/*` rule—keep it in place until basePath removal
- [ ] Test environment variable changes locally
- [ ] Restart PM2 services with new environment

## Phase 3: Comprehensive Testing

### Core Functionality Testing

- [ ] Test homepage loads at https://reader.uberfolks.ca
- [ ] Test settings page access and functionality
- [ ] Test all navigation links work through tunnel
- [ ] Test RSS feed display and article reading
- [ ] Test article starring and read/unread marking

### API Endpoint Testing

- [ ] Test all health endpoints (/api/health/\*)
- [ ] Test sync endpoint functionality
- [ ] Test Inoreader API proxy endpoints
- [ ] Test manual sync trigger via UI
- [ ] Test bi-directional sync operations

### Authentication & Session Testing

- [ ] Test fresh user OAuth flow
- [ ] Test existing user session persistence
- [ ] Test logout functionality
- [ ] Test multi-device session behavior
- [ ] Test session auto-refresh across tunnel

### Background Service Testing

- [ ] Test automated sync continues working (6x daily)
- [ ] Test PM2 services remain stable with tunnel
- [ ] Test sync logs generation and access
- [ ] Test cron job execution through tunnel
- [ ] Test error handling and retry logic

## Phase 4: Production Readiness

### Performance & Monitoring

- [ ] Test response times through tunnel vs direct access
- [ ] Verify all PM2 logs continue working
- [ ] Test health monitoring endpoints
- [ ] Create a Cloudflare Monitor for `GET /reader/api/health/app` and `GET /reader/api/health/cron`
- [ ] Update Uptime Kuma (or other monitors) to point at `reader.uberfolks.ca`
- [ ] Check database connection performance
- [ ] Monitor sync operation timings

### Security Validation

- [ ] Test HTTPS certificate and SSL configuration
- [ ] Verify no HTTP traffic leakage
- [ ] (Optional) Gate access with Cloudflare Access during shakedown
- [ ] Validate token encryption and storage
- [ ] Check for any exposed sensitive endpoints

### Documentation Updates

- [ ] Update README.md with new public URL
- [ ] Update development setup instructions
- [ ] Update API documentation URLs
- [ ] Update any deployment documentation
- [ ] Update environment variable examples

## Phase 5: Tunnel Service Management

### Service Installation

- [ ] Install cloudflared as system service on Mac Mini
- [ ] Configure tunnel to auto-start on boot and auto-restart on crash
- [ ] Confirm cloudflared log location and rotation policy
- [ ] Test tunnel service restart behavior
- [ ] Verify tunnel reconnection after network issues
- [ ] Document tunnel management commands

### Monitoring & Maintenance

- [ ] Set up tunnel health monitoring (Cloudflare Monitor)
- [ ] Document troubleshooting procedures
- [ ] Test tunnel restart procedures
- [ ] Create rollback plan documentation
- [ ] Verify tunnel logs are accessible, rotated, and retained per policy

## Phase 6: User Communication & Rollout

### Internal Testing

- [ ] Test app access from different networks
- [ ] Test mobile device access (iOS PWA)
- [ ] Test different browsers and devices
- [ ] Validate all features work identically
- [ ] Performance testing under tunnel load

### Rollout Preparation

- [ ] Prepare user communication about URL change
- [ ] Update any shared bookmarks or links
- [ ] Test user onboarding flow via new URL
- [ ] Verify analytics and tracking continue working
- [ ] Prepare monitoring for first public users

## Rollback Plan Tasks

### Emergency Rollback

- [ ] Document tunnel shutdown procedure
- [ ] Document DNS record removal steps
- [ ] Document OAuth callback URL revert process
- [ ] Test rollback to Tailscale-only access
- [ ] Verify all functionality after rollback

### Gradual Rollback

- [ ] Support both tunnel and Tailscale access temporarily
- [ ] Test dual-access functionality
- [ ] Plan gradual user migration back if needed
- [ ] Document parallel access management

## Post-Migration Tasks

### Optimization

- [ ] Monitor tunnel performance metrics
- [ ] Optimize Mac Mini resource usage
- [ ] Fine-tune CloudFlare caching settings
- [ ] Monitor database connection patterns
- [ ] Assess need for future full CloudFlare migration

### Future Planning

- [ ] Document lessons learned from tunnel migration
- [ ] Plan potential CloudFlare Workers migration timeline
- [ ] Assess multi-user implementation readiness
- [ ] Update architecture documentation
- [ ] Plan scaling strategy for increased users

**Total Tasks: 47 items across 6 phases**
**Risk Level: Low (minimal code changes, preserves existing functionality)**
