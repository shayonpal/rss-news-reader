# Server Instability Issues Documentation

This directory contains investigation reports and analysis of server instability issues encountered with the RSS News Reader application.

## Documents

### Investigation Reports (July 26, 2025)

A series of detailed investigation reports documenting server crashes and recovery attempts:

1. **investigation-report-2025-07-26.md**
   - **Time**: Initial report
   - **Status**: Historical 📋
   - **Issue**: First documentation of server crashes affecting PM2 services
   - **Findings**: Initial crash patterns and recovery attempts

2. **investigation-report-2025-07-26_14-09-00.md**
   - **Time**: 2:09 PM
   - **Status**: Historical 📋
   - **Issue**: Continued analysis of PM2 service failures
   - **Findings**: Identified memory pressure and process management issues

3. **investigation-report-2025-07-26_14-16-10.md**
   - **Time**: 2:16 PM
   - **Status**: Historical 📋
   - **Issue**: Deep dive into root causes
   - **Findings**: Database connection pool exhaustion, memory leaks

4. **investigation-report-2025-07-26_14-30-00.md**
   - **Time**: 2:30 PM
   - **Status**: Historical 📋
   - **Issue**: Comprehensive analysis and recovery plan
   - **Findings**: Multiple contributing factors identified

5. **investigation-report-2025-07-26_14-30-20.md**
   - **Time**: 2:30:20 PM
   - **Status**: Most Recent ✅
   - **Issue**: Final report with resolution steps
   - **Resolution**: Successfully recovered all services

## Key Issues Identified

### Root Causes

1. **Memory Pressure**: Services consuming excessive memory
2. **Database Connections**: Connection pool exhaustion
3. **PM2 Configuration**: Suboptimal restart strategies
4. **Resource Contention**: Multiple services competing for resources
5. **Monitoring Gaps**: Lack of proactive monitoring

### Symptoms

- PM2 services showing "errored" status
- High memory usage (>90%)
- Database connection timeouts
- Cascading failures across services
- Automatic restart loops

## Resolution Actions Taken

1. **Immediate Recovery**:
   - Killed all Node.js processes
   - Cleared PM2 logs
   - Restarted services with proper sequencing
   - Implemented health checks

2. **Configuration Improvements**:
   - Added memory limits to PM2 ecosystem
   - Configured proper restart strategies
   - Implemented connection pooling limits
   - Added graceful shutdown handlers

3. **Monitoring Implementation**:
   - Set up Uptime Kuma monitoring
   - Added health check endpoints
   - Configured alert thresholds
   - Implemented log rotation

## Lessons Learned

1. **Proactive Monitoring**: Essential for catching issues early
2. **Resource Limits**: Always configure memory and CPU limits
3. **Graceful Degradation**: Services should fail gracefully
4. **Log Management**: Implement log rotation to prevent disk issues
5. **Health Checks**: Critical for automated recovery

## Related Documentation

- **Monitoring Setup**: See `/docs/tech/uptime-kuma-setup.md`
- **Deployment Config**: See `/docs/deployment/environment-variables.md`
- **Known Issues**: See `/docs/tech/known-issues.md`
<!-- CI/CD strategy doc removed to keep docs focused on current dev-only setup. -->

## Prevention Measures

### Implemented

- ✅ PM2 memory limits
- ✅ Database connection pooling
- ✅ Health check endpoints
- ✅ Automatic log rotation
- ✅ Uptime Kuma monitoring

### Planned

- 🔄 Implement circuit breakers
- 🔄 Add performance profiling
- 🔄 Set up automated alerts
- 🔄 Create disaster recovery playbook

## Quick Reference

### Check Service Health

```bash
pm2 list
pm2 monit
```

### View Recent Logs

```bash
pm2 logs --lines 100
```

### Emergency Recovery

```bash
# Kill all Node processes
pkill -f node

# Clear PM2
pm2 kill
pm2 flush

# Restart services
pm2 start ecosystem.config.js
pm2 save --force
```

---

_These investigation reports document a critical server instability incident on July 26, 2025. The issues have been resolved, and preventive measures have been implemented to avoid recurrence._
