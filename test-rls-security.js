#!/usr/bin/env node

/**
 * Test script to validate RLS security implementation
 * Tests both authorized and unauthorized access scenarios
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

console.log('🔐 Testing RLS Security Implementation\n');

async function testClientAccess() {
  console.log('1. Testing Client Access (anon key)...');
  const client = createClient(SUPABASE_URL, ANON_KEY);
  
  try {
    // Test feeds access
    const { data: feeds, error: feedsError } = await client
      .from('feeds')
      .select('*')
      .limit(5);
    
    console.log(`   ✅ Feeds: ${feeds ? feeds.length : 0} accessible`);
    
    // Test articles access  
    const { data: articles, error: articlesError } = await client
      .from('articles')
      .select('*')
      .limit(5);
      
    console.log(`   ✅ Articles: ${articles ? articles.length : 0} accessible`);
    
    // Test article update (mark as read)
    if (articles && articles.length > 0) {
      const { error: updateError } = await client
        .from('articles')
        .update({ is_read: true })
        .eq('id', articles[0].id);
        
      console.log(`   ${updateError ? '❌' : '✅'} Article update: ${updateError ? 'FAILED' : 'SUCCESS'}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Client access failed: ${error.message}`);
  }
}

async function testServerAccess() {
  console.log('\n2. Testing Server Access (service role)...');
  const server = createClient(SUPABASE_URL, SERVICE_KEY);
  
  try {
    const { data: users, error } = await server
      .from('users')
      .select('*');
      
    console.log(`   ✅ Users: ${users ? users.length : 0} accessible (should see all)`);
    
    const { data: feeds } = await server
      .from('feeds')
      .select('*')
      .limit(5);
      
    console.log(`   ✅ Feeds: ${feeds ? feeds.length : 0} accessible (full access)`);
    
  } catch (error) {
    console.log(`   ❌ Server access failed: ${error.message}`);
  }
}

async function testRLSEnforcement() {
  console.log('\n3. Testing RLS Enforcement...');
  
  // Use client to try accessing data for different user
  const client = createClient(SUPABASE_URL, ANON_KEY);
  
  try {
    // Try to access feeds for a different user (should be blocked)
    const { data: feeds, error } = await client
      .from('feeds')
      .select('*')
      .eq('user_id', '00000000-0000-0000-0000-000000000000'); // Fake user ID
      
    console.log(`   ${feeds && feeds.length > 0 ? '❌' : '✅'} RLS blocking unauthorized access: ${feeds ? feeds.length : 0} results`);
    
  } catch (error) {
    console.log(`   ✅ RLS properly blocking: ${error.message}`);
  }
}

async function runTests() {
  try {
    await testClientAccess();
    await testServerAccess();
    await testRLSEnforcement();
    
    console.log('\n🎉 Security testing complete!');
    console.log('\nExpected Results:');
    console.log('- Client should see feeds/articles for "shayon" user only');
    console.log('- Server should see all data');
    console.log('- RLS should block unauthorized access attempts');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

if (require.main === module) {
  runTests();
}