// Uptime Kuma Monitor Configuration for RSS News Reader
// This script should be run after initial setup to configure monitors

const monitors = [
  {
    name: "RSS Reader - Production App",
    type: "http",
    url: "http://100.96.166.53:3147/reader/api/health/app?ping=true",
    interval: 60,
    retryInterval: 20,
    maxretries: 3,
    accepted_statuscodes: ["200"],
    description: "Main production RSS Reader application",
  },
  {
    name: "RSS Reader - Sync Server",
    type: "http",
    url: "http://localhost:3001/server/health",
    interval: 60,
    retryInterval: 20,
    maxretries: 3,
    accepted_statuscodes: ["200"],
    description: "Bi-directional sync server",
  },
  {
    name: "RSS Reader - Dev App",
    type: "http",
    url: "http://100.96.166.53:3000/reader/api/health/app?ping=true",
    interval: 300, // Check dev less frequently
    retryInterval: 60,
    maxretries: 2,
    accepted_statuscodes: ["200"],
    description: "Development RSS Reader application",
  },
  {
    name: "RSS Reader - Database",
    type: "http",
    url: "http://100.96.166.53:3147/reader/api/health/db",
    interval: 300,
    retryInterval: 60,
    maxretries: 3,
    accepted_statuscodes: ["200"],
    description: "Supabase database connection",
  },
  {
    name: "RSS Reader - Production Port",
    type: "port",
    hostname: "100.96.166.53",
    port: 3147,
    interval: 300,
    retryInterval: 60,
    maxretries: 3,
    description: "Production application port",
  },
  {
    name: "RSS Reader - Sync Port",
    type: "port",
    hostname: "localhost",
    port: 3001,
    interval: 300,
    retryInterval: 60,
    maxretries: 3,
    description: "Sync server port",
  },
];

console.log("Monitor Configuration for Uptime Kuma");
console.log("=====================================");
console.log("");
console.log("Please add these monitors manually in Uptime Kuma:");
console.log("");

monitors.forEach((monitor, index) => {
  console.log(`${index + 1}. ${monitor.name}`);
  console.log(`   Type: ${monitor.type}`);
  console.log(`   URL/Host: ${monitor.url || monitor.hostname}`);
  if (monitor.port) console.log(`   Port: ${monitor.port}`);
  console.log(`   Interval: ${monitor.interval}s`);
  console.log(`   Description: ${monitor.description}`);
  console.log("");
});

console.log("Discord Webhook Configuration:");
console.log("==============================");
console.log(
  "URL: https://discord.com/api/webhooks/1398487627765649498/n6mIouChkYqBCL67vj5Jbn0X0XP3uU_rFXhSRcRmQdE2yiJBcvPL7sF9VphClpie5ObE"
);
console.log("Bot Display Name: Uptime Kuma - RSS Reader");
console.log("");

console.log("For Cron Monitoring (Push Monitor):");
console.log("===================================");
console.log("Create a 'Push' type monitor and add this to your cron job:");
console.log("curl -s http://localhost:3080/api/push/[PUSH_KEY]");
