#!/usr/bin/env node

// Additional Uptime Kuma monitors for sync health

const syncMonitors = [
  {
    name: 'RSS Reader - Sync API Endpoint',
    type: 'http',
    url: 'http://100.96.166.53:3147/reader/api/sync',
    method: 'GET',
    interval: 300, // 5 minutes
    retryInterval: 60,
    maxretries: 2,
    accepted_statuscodes: ['200', '405'], // GET returns 405, POST returns 200
    description: 'Monitor sync API endpoint availability'
  },
  {
    name: 'RSS Reader - Article Freshness',
    type: 'http', 
    url: 'http://100.96.166.53:3147/reader/api/health/freshness',
    interval: 1800, // 30 minutes
    retryInterval: 300,
    maxretries: 3,
    description: 'Check if articles are being updated'
  },
  {
    name: 'RSS Reader - Sync Success Rate',
    type: 'push',
    interval: 43200, // 12 hours - alert if no successful sync
    description: 'Push monitor for successful sync completion'
  },
  {
    name: 'RSS Reader - Cron Health File',
    type: 'http',
    url: 'http://100.96.166.53:3147/reader/api/health/cron',
    interval: 900, // 15 minutes
    retryInterval: 180,
    maxretries: 2,
    description: 'Monitor cron service health status'
  }
];

console.log('Add these monitors to Uptime Kuma:');
console.log('================================\n');

syncMonitors.forEach((monitor, index) => {
  console.log(`Monitor ${index + 1}: ${monitor.name}`);
  console.log('Settings:');
  Object.entries(monitor).forEach(([key, value]) => {
    if (key !== 'name') {
      console.log(`  ${key}: ${value}`);
    }
  });
  console.log('\n');
});

console.log('For Push monitors, save the push URL to:');
console.log('/Users/shayon/.rss-reader/uptime-kuma-push-keys.json');
console.log('\nExample format:');
console.log(JSON.stringify({
  cron: "existing-push-key",
  sync_success: "new-push-key-for-sync-success"
}, null, 2));