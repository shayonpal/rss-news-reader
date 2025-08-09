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
- **XSS Protection**: HTML escaping implemented for all user-generated content and tag names (RR-128)

### Database Security

- **Row Level Security (RLS)**: Enabled on all tables with user-specific policies
- **SECURITY INVOKER Views**: All views respect RLS policies of the querying user (RR-67)
- **Function Search Path Protection**: Critical functions have explicit `search_path = public` to prevent SQL injection
- **No SECURITY DEFINER**: Eliminated all views with SECURITY DEFINER to prevent privilege escalation
- **Principle of Least Privilege**: Views and functions run with invoker's permissions, not definer's

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

### RR-128: XSS Protection Implementation (January 2025)

**Issue**: Tag names and user-generated content needed proper HTML escaping to prevent Cross-Site Scripting (XSS) attacks.

**Implementation**:

- **HTML Entity Decoding**: Tag names are decoded using HTML entity decoder to handle entities like &#x2F; properly
- **React XSS Protection**: Relies on React's built-in XSS protection for text content rendering instead of double-escaping
- **API Input Validation**: Tag creation endpoints validate and sanitize input before storage
- **Database Storage**: Tags stored with original content, HTML entity decoding applied during display
- **Comprehensive Testing**: XSS attack vectors tested in tag management functionality

**Update (RR-170 - August 2025)**: Removed redundant HTML escaping that was interfering with proper entity decoding. React's automatic XSS protection is sufficient for text content.

**Scope**:

- Tag names in sidebar navigation ("Topics" section)  
- Tag creation and editing forms
- Tag search and filtering functionality
- Article tag displays and associations
- All user-facing tag content rendering

**Impact**:

- Prevented potential XSS vulnerabilities in tag system
- Maintained user experience while ensuring security
- Established security patterns for future user-generated content
- No impact on existing functionality or performance

### RR-67: Database Security - SECURITY DEFINER and search_path (August 9, 2025)

**Issue**: Database views with SECURITY DEFINER bypassed Row Level Security policies, and functions without search_path were vulnerable to SQL injection attacks.

**Vulnerabilities Fixed**:

**Views (4 SECURITY DEFINER removed)**:
- `sync_queue_stats` - Sync monitoring view
- `author_quality_report` - Author coverage analysis
- `author_statistics` - Author metrics view
- `sync_author_health` - Sync health monitoring

**Functions (7 search_path added)**:
- `get_unread_counts_by_feed` - Core unread count functionality
- `get_articles_optimized` - Main article fetching
- `refresh_feed_stats` - Post-sync statistics update
- `add_to_sync_queue` - Bi-directional sync operations
- `update_updated_at_column` - Timestamp trigger
- `increment_api_usage` - API call tracking
- `clean_old_sync_queue_entries` - Queue maintenance

**Implementation**:
- Created migration `supabase/migrations/0001_security_fixes_rr67.sql`
- Views recreated with explicit `WITH (security_invoker = true)`
- Functions protected with `ALTER FUNCTION ... SET search_path = public`
- Comprehensive test suite with behavior contracts

**Impact**:
- 100% elimination of ERROR-level security issues
- 46% reduction in total security warnings (24 → 13)
- All views now respect RLS policies of querying user
- Functions protected against search_path manipulation attacks
- No data loss or functionality impact

**Testing**: Test-first development with 32 unit tests defining exact expected behavior

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
- [ ] XSS protection verified for all user-generated content
- [ ] HTML entity decoding implemented for tag names with React XSS protection

### Regular Security Reviews

- [ ] Review API endpoints for information disclosure
- [ ] Check for hardcoded credentials
- [ ] Validate access controls
- [ ] Review error messages for information leakage
- [ ] Test authentication mechanisms
- [ ] Verify XSS protection in all user input areas
- [ ] Check HTML entity decoding and React XSS protection in tag features

## Related Documentation

- **API Security**: See `docs/api/server-endpoints.md`
- **Deployment Security**: See `docs/deployment/environment-variables.md`
- **Monitoring**: See `docs/tech/monitoring-and-alerting.md`
- **Test Documentation**: See `tests/rr-69-test-documentation.md`

---

_This security documentation is maintained to ensure the RSS News Reader application follows security best practices and maintains user privacy and data protection._
