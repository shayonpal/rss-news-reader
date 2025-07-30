# Security Documentation

This document outlines the security measures and policies implemented in the RSS News Reader application.

## Security Architecture

### Network Security
- **Tailscale VPN Required**: All access to the application requires connection to the Tailscale network (100.96.166.53)
- **No Public Exposure**: The application does not accept connections from the public internet
- **Network-Level Access Control**: Authentication handled at the network layer rather than application layer

### Authentication & Authorization
- **Server-Side OAuth**: All Inoreader authentication is handled server-side
- **Encrypted Token Storage**: OAuth tokens stored in `~/.rss-reader/tokens.json` using AES-256-GCM encryption
- **No Client-Side Authentication**: The client application requires no user authentication
- **Database RLS**: Row Level Security enabled on all Supabase tables with user-specific policies

### API Security
- **Rate Limiting**: Inoreader API calls limited to 100 per day
- **Service Role Protection**: Database service role key only used server-side
- **Input Validation**: All API endpoints validate input parameters
- **Error Handling**: Consistent error responses without sensitive information leakage

## Security Fixes

### RR-69: Test/Debug Endpoint Removal (July 30, 2025)

**Issue**: Test and debug endpoints were exposing sensitive system information without proper access controls.

**Endpoints Removed**:
- `/test-supabase` (page) - Exposed database schema and connection details
- `/test-server-api` (page) - Listed all API endpoints with examples
- `/test-performance` (page) - Revealed system performance metrics
- `/test-article-controls` (page) - Exposed article manipulation capabilities
- `/api/test-supabase` - Direct database testing endpoint
- `/api/test-prompt-config` - AI prompt configuration exposure
- `/api/test-api-endpoints` - Internal API structure exposure
- `/api/test-refresh-stats` - Unauthorized database operations
- `/api/debug/data-cleanup` - Data manipulation capabilities

**Impact**: 
- Removed potential attack vectors
- Eliminated information disclosure vulnerabilities
- Maintained all production functionality
- No impact on legitimate users

**Testing**: Comprehensive test suite created to prevent regression of removed endpoints.

## Security Best Practices

### Development
1. **Environment Variables**: All sensitive configuration stored in environment variables
2. **No Hardcoded Secrets**: API keys and credentials never committed to version control
3. **Build Validation**: Production builds validated to ensure no test endpoints included
4. **Code Review**: Security-sensitive changes require thorough review

### Deployment
1. **Process Management**: PM2 used for reliable service management with auto-restart
2. **Log Management**: Sensitive information excluded from logs
3. **File Permissions**: Restricted access to configuration and token files
4. **Service Isolation**: Different PM2 apps for different services

### Monitoring
1. **Health Checks**: Production health endpoints for monitoring without exposing internals
2. **Error Tracking**: Structured error logging without sensitive data
3. **Performance Monitoring**: System metrics tracking without user data exposure
4. **Audit Trail**: API usage tracking for security analysis

## Security Headers

The application implements security headers:
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff

## Data Protection

### Data Encryption
- **In Transit**: All connections use HTTPS/TLS
- **At Rest**: Supabase provides encryption at rest
- **Tokens**: OAuth tokens encrypted with AES-256-GCM

### Data Minimization
- Only necessary data stored locally
- Periodic cleanup of old articles and logs
- No user tracking or analytics

### Privacy
- No personal data collection beyond RSS feed preferences
- No third-party analytics or tracking
- User data stays within Tailscale network

## Incident Response

### Security Issue Reporting
1. Document the issue with full technical details
2. Assess impact and create Linear issue with "security" label
3. Implement fix with comprehensive testing
4. Update security documentation
5. Deploy fix immediately if critical

### Post-Incident Actions
1. Root cause analysis
2. Update security measures to prevent recurrence
3. Review and update documentation
4. Consider additional security hardening

## Security Checklist

### Pre-Deployment
- [ ] All test/debug endpoints removed
- [ ] Environment variables validated
- [ ] No hardcoded credentials in code
- [ ] Build validation passes
- [ ] Security tests pass

### Regular Security Reviews
- [ ] Review API endpoints for information disclosure
- [ ] Check for hardcoded credentials
- [ ] Validate access controls
- [ ] Review error messages for information leakage
- [ ] Test authentication mechanisms

## Related Documentation

- **API Security**: See `docs/api/server-endpoints.md`
- **Deployment Security**: See `docs/deployment/environment-variables.md`
- **Monitoring**: See `docs/tech/monitoring-and-alerting.md`
- **Test Documentation**: See `tests/rr-69-test-documentation.md`

---

_This security documentation is maintained to ensure the RSS News Reader application follows security best practices and maintains user privacy and data protection._