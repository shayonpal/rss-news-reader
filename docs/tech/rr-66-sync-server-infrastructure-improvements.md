# RR-66: Sync Server Infrastructure Improvements

## Issue Summary

The sync server has experienced 25+ restarts due to:
1. Database schema mismatch (missing RPC function)
2. Extreme memory pressure (<100MB free RAM)
3. Suboptimal PM2 configuration
4. Lack of proper monitoring

## Immediate Actions Taken

### 1. Fixed Database API Usage Tracking
- Modified `/server/services/bidirectional-sync.js` to use direct table updates
- Replaced missing RPC function `increment_api_usage` with inline SQL
- This stops the constant error logging that may have contributed to instability

### 2. Created Memory Optimization Script
- `/scripts/optimize-sync-server.sh` - Reduces memory footprint
- Key optimizations:
  - Reduced memory limit: 200MB (from 256MB)
  - Explicit heap size: 192MB
  - Increased sync intervals: 10 minutes (from 5)
  - Reduced batch sizes: 50 items (from 100)
  - Reduced thread pool size

## Infrastructure Improvements Required

### Phase 1: Immediate Stabilization (Week 1)

1. **Database Schema Fix**
   ```sql
   -- Option A: Add missing column
   ALTER TABLE api_usage ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
   
   -- Option B: Create RPC function
   CREATE OR REPLACE FUNCTION increment_api_usage(
     p_service VARCHAR,
     p_date DATE,
     p_increment INTEGER
   ) RETURNS VOID AS $$
   BEGIN
     INSERT INTO api_usage (service, date, count, created_at)
     VALUES (p_service, p_date, p_increment, NOW())
     ON CONFLICT (service, date) 
     DO UPDATE SET count = api_usage.count + p_increment;
   END;
   $$ LANGUAGE plpgsql;
   ```

2. **Memory Monitoring Enhancement**
   - Add memory usage to health endpoints
   - Create memory pressure alerts in Uptime Kuma
   - Implement graceful degradation when memory is low

3. **PM2 Configuration Optimization**
   - Apply optimized configuration from `ecosystem.config.sync-optimized.js`
   - Implement service priority (production > sync > dev)
   - Add memory-based restart thresholds

### Phase 2: Monitoring & Alerting (Week 2)

1. **Enhanced Health Checks**
   ```javascript
   // Add to sync server health endpoint
   {
     memory: {
       heapUsed: process.memoryUsage().heapUsed,
       heapTotal: process.memoryUsage().heapTotal,
       rss: process.memoryUsage().rss,
       external: process.memoryUsage().external
     },
     restartCount: process.env.PM2_RESTART_COUNT || 0,
     uptime: process.uptime()
   }
   ```

2. **Uptime Kuma Integration**
   - Create memory threshold monitor
   - Add restart count tracking
   - Set up escalating alerts for repeated failures

3. **Automated Recovery**
   - Implement webhook handler for automatic PM2 recovery
   - Add circuit breaker pattern for sync operations
   - Create fallback mode for extreme memory pressure

### Phase 3: Architecture Improvements (Week 3-4)

1. **Service Isolation**
   - Consider moving sync server to separate process/container
   - Implement queue-based architecture with Redis/BullMQ
   - Add worker pool for sync operations

2. **Memory Optimization**
   - Implement streaming for large data operations
   - Add pagination for sync queue processing
   - Use connection pooling for database

3. **Monitoring Dashboard**
   - Create unified dashboard showing:
     - Service health status
     - Memory usage trends
     - API call counts
     - Sync queue depth
     - Error rates

## Monitoring Strategy

### Key Metrics to Track

1. **Service Health**
   - Restart count per hour
   - Memory usage percentage
   - Response time percentiles
   - Error rates by type

2. **Sync Performance**
   - Queue depth over time
   - Sync success/failure rates
   - API calls per sync operation
   - Average sync duration

3. **System Resources**
   - Free RAM trends
   - Swap usage
   - CPU utilization
   - Disk I/O

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Restarts/hour | >2 | >5 | Check logs, reduce memory limit |
| Memory usage | >80% | >95% | Restart service, clear caches |
| Queue depth | >100 | >500 | Increase sync frequency |
| API errors | >5/min | >20/min | Check database connectivity |
| Free RAM | <500MB | <100MB | Kill non-essential services |

## Implementation Checklist

- [x] Fix database API tracking implementation
- [ ] Apply optimized PM2 configuration
- [ ] Implement enhanced health checks
- [ ] Set up memory monitoring in Uptime Kuma
- [ ] Create automated recovery webhook
- [ ] Document rollback procedures
- [ ] Test under memory pressure scenarios
- [ ] Create runbook for incident response

## Emergency Procedures

### If sync server fails repeatedly:

1. **Immediate Actions**
   ```bash
   # Check current status
   pm2 status
   ./scripts/monitor-dashboard.sh
   
   # View recent errors
   pm2 logs rss-sync-server --err --lines 50
   
   # Emergency restart with reduced memory
   pm2 delete rss-sync-server
   NODE_OPTIONS="--max-old-space-size=128" pm2 start ecosystem.config.js --only rss-sync-server
   ```

2. **Temporary Disable Sync**
   ```bash
   # Stop sync server to preserve other services
   pm2 stop rss-sync-server
   
   # Manual sync when needed
   curl -X POST http://localhost:3147/reader/api/sync
   ```

3. **Memory Recovery**
   ```bash
   # Clear PM2 logs
   pm2 flush
   
   # Kill memory-hungry processes
   pkill -f "chrome|firefox|slack"
   
   # Clear system caches
   sudo purge  # macOS specific
   ```

## Long-term Solutions

1. **Hardware**: Consider upgrading Mac Mini RAM (if possible)
2. **Architecture**: Move to microservices with separate containers
3. **Cloud**: Offload sync operations to cloud workers
4. **Database**: Implement proper queue table with TTL
5. **Monitoring**: Deploy dedicated monitoring stack (Prometheus/Grafana)

## Success Criteria

- Sync server restarts <5 per day
- Memory usage stays below 200MB
- No database schema errors in logs
- Sync operations complete within 30 seconds
- Zero data loss during restarts

## Timeline

- Day 1-2: Apply immediate fixes and monitor
- Day 3-7: Implement enhanced monitoring
- Week 2: Deploy automated recovery
- Week 3-4: Architecture improvements
- Month 2: Evaluate long-term solutions