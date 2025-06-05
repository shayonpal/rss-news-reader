# ADR-006: Self-Hosted Mac Mini Deployment

## Status
Accepted

## Context
The RSS Reader needs to be deployed for personal use with these requirements:
- Available 24/7 for access from any device
- Running on existing Mac Mini hardware
- No external hosting costs
- Easy to maintain and update
- Secure from external threats
- Running on non-standard port for security

Constraints:
- Single user (personal use)
- Local network access primarily
- Mac Mini already available
- Want to avoid cloud hosting complexity/costs

## Decision
Deploy the application as a self-hosted service on Mac Mini using:
- PM2 process manager for reliability
- Port 7419 (non-standard) for security through obscurity
- Local network access only (no public internet exposure)
- Automatic startup and restart capabilities

## Consequences

### Positive
- **Zero hosting costs**: Uses existing hardware
- **Full control**: Complete control over data and updates
- **Low latency**: Local network access is fast
- **Privacy**: No data leaves personal infrastructure
- **Learning opportunity**: Understanding deployment processes
- **Easy updates**: Direct access to deployment

### Negative
- **Maintenance burden**: Must maintain hardware and software
- **No redundancy**: Single point of failure
- **Power costs**: Mac Mini running 24/7
- **Network dependency**: Requires local network access
- **No public access**: Can't access from outside network (without VPN)

### Neutral
- **Security responsibility**: Must handle security ourselves
- **Backup responsibility**: Must manage backups
- **Update process**: Manual update process

## Alternatives Considered

### Alternative 1: Vercel Deployment
- **Description**: Deploy to Vercel's cloud platform
- **Pros**: Zero-config deployment, global CDN, automatic scaling, free tier
- **Cons**: Data privacy concerns, requires internet, potential costs
- **Reason for rejection**: Want local control and privacy

### Alternative 2: Docker on NAS
- **Description**: Containerized deployment on Network Attached Storage
- **Pros**: Better for 24/7 operation, lower power usage
- **Cons**: More complex setup, need to buy NAS
- **Reason for rejection**: Mac Mini already available

### Alternative 3: Raspberry Pi
- **Description**: Deploy on Raspberry Pi for lower power usage
- **Pros**: Very low power, cheap hardware, perfect for 24/7
- **Cons**: Lower performance, need to buy hardware, ARM compatibility
- **Reason for rejection**: Mac Mini already available and more powerful

### Alternative 4: VPS Hosting
- **Description**: Deploy on cloud VPS (DigitalOcean, Linode)
- **Pros**: Public access, professional infrastructure, backups
- **Cons**: Monthly costs, data privacy, more complex
- **Reason for rejection**: Want to avoid recurring costs

### Alternative 5: Static Export
- **Description**: Export as static site, host on GitHub Pages
- **Pros**: Free hosting, simple deployment
- **Cons**: No API routes, no server-side functionality
- **Reason for rejection**: Need server-side features for API proxying

## Implementation Notes

### Process Management
```bash
# PM2 Configuration
module.exports = {
  apps: [{
    name: 'shayon-news',
    script: 'node_modules/.bin/next',
    args: 'start',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 7419
    },
    error_file: 'logs/error.log',
    out_file: 'logs/output.log',
    time: true
  }]
}
```

### Security Considerations
1. **Non-standard port**: 7419 reduces automated scanning
2. **Local network only**: No port forwarding
3. **Firewall rules**: Only allow Node.js through firewall
4. **HTTPS**: Self-signed certificate for local HTTPS
5. **Environment variables**: Secure storage of API keys

### Reliability Features
```bash
# Auto-restart on crash
pm2 start ecosystem.config.js

# Auto-start on boot
pm2 startup
pm2 save

# Prevent system sleep
caffeinate -i -s  # In launch agent
```

### Update Process
```bash
#!/bin/bash
# update.sh
cd ~/Applications/shayon-news
pm2 stop shayon-news
git pull
npm install
npm run build
pm2 restart shayon-news
```

### Monitoring
```bash
# Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date()
  })
})

# Cron job for monitoring
*/15 * * * * curl -f http://localhost:7419/api/health || pm2 restart shayon-news
```

### Backup Strategy
- Daily backup of environment files
- Weekly backup of PM2 configuration
- Application data in browser (IndexedDB) - user responsibility

### Performance Tuning
```javascript
// Mac Mini specific optimizations
const nextConfig = {
  experimental: {
    // Optimize for single user
    isrMemoryCacheSize: 0,
  },
  
  // Disable telemetry
  telemetry: false,
  
  // Optimize build
  swcMinify: true,
  compress: true
}
```

## Operational Procedures

### Daily Operations
- Automatic health checks via cron
- PM2 handles crashes and restarts
- Logs rotate automatically

### Weekly Maintenance
- Check logs for errors
- Verify backup completion
- Check for updates

### Monthly Tasks
- Review API usage statistics
- Update dependencies if needed
- Check Mac Mini system updates

### Troubleshooting Guide
1. **App not accessible**: Check PM2 status
2. **High memory usage**: Restart with PM2
3. **Port conflict**: Check with `lsof -i :7419`
4. **Update failed**: Check git status and npm logs

## Future Considerations
- Add Tailscale for secure remote access
- Implement automated backups to cloud
- Add monitoring dashboard
- Consider migration to dedicated mini PC

## References
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Mac Mini Server Guide](https://support.apple.com/guide/mac-mini/)
- [Node.js Production Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Self-Hosting Guide](https://github.com/awesome-selfhosted/awesome-selfhosted)