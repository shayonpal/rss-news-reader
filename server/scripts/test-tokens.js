#!/usr/bin/env node

const TokenManager = require('../lib/token-manager');

async function testTokens() {
  console.log('🔍 Testing Token Manager...\n');
  
  const tokenManager = new TokenManager();
  
  try {
    // Try to load tokens
    console.log('📂 Loading tokens...');
    const tokens = await tokenManager.loadTokens();
    console.log('✅ Tokens loaded successfully');
    console.log(`   Token type: ${tokens.token_type}`);
    console.log(`   Scope: ${tokens.scope}`);
    console.log(`   Created: ${new Date(tokens.created_at).toLocaleString()}`);
    
    // Check if refresh is needed
    const needsRefresh = tokenManager.needsRefresh();
    console.log(`\n🔄 Token refresh needed: ${needsRefresh ? 'Yes' : 'No'}`);
    
    if (!needsRefresh) {
      const expiresAt = tokens.created_at + (tokens.expires_in * 1000);
      const timeLeft = expiresAt - Date.now();
      const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      console.log(`   Token expires in: ${hoursLeft}h ${minutesLeft}m`);
    }
    
    // Test API call
    console.log('\n🌐 Testing API call...');
    const response = await tokenManager.makeAuthenticatedRequest(
      'https://www.inoreader.com/reader/api/0/user-info'
    );
    
    if (response.ok) {
      const userInfo = await response.json();
      console.log('✅ API call successful');
      console.log(`   User ID: ${userInfo.userId}`);
      console.log(`   User Email: ${userInfo.userEmail}`);
    } else {
      console.error('❌ API call failed:', response.status, response.statusText);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('No tokens found')) {
      console.log('\n💡 Run "npm run setup:oauth" to set up authentication');
    }
  }
}

testTokens().catch(console.error);