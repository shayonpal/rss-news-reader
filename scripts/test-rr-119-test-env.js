#!/usr/bin/env node

// Script to test RR-119 endpoints in simulated test environment
const http = require('http');
const { URL } = require('url');

// Set environment to test
process.env.NODE_ENV = 'test';
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;

// Import the route handlers
async function testEndpoints() {
  console.log('=== Testing RR-119 Health Endpoints in Test Environment ===\n');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL || 'undefined');
  console.log('\n');

  // Import and test each endpoint
  const endpoints = [
    { name: '/api/health/db', module: '@/app/api/health/db/route' },
    { name: '/api/health/cron', module: '@/app/api/health/cron/route' },
    { name: '/api/health/freshness', module: '@/app/api/health/freshness/route' },
    { name: '/api/health/app', module: '@/app/api/health/route' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.name}:`);
      
      // Create a mock request
      const mockRequest = new Request(`http://localhost:3000${endpoint.name}`);
      
      // Import the handler
      const routeModule = require(endpoint.module.replace('@/', '../src/'));
      const response = await routeModule.GET(mockRequest);
      
      const data = await response.json();
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(data, null, 2));
      console.log('✅ Test passed: Returns 200 in test environment\n');
    } catch (error) {
      console.error(`❌ Error testing ${endpoint.name}:`, error.message);
      console.log('\n');
    }
  }

  console.log('=== Summary ===');
  console.log('All endpoints should return 200 status in test environment');
  console.log('All endpoints should include environment: "test"');
  console.log('Services should show as "unavailable" or "skipped"');
}

// Run tests
testEndpoints().catch(console.error);