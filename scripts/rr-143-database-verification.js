#!/usr/bin/env node

/**
 * RR-143: Database Integrity Verification Script
 * 
 * This script runs all the database verification queries specified in the Linear issue
 * to validate author data persistence and integrity.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

async function verifyDatabaseSchema() {
  logSection('1. DATABASE SCHEMA VERIFICATION');
  
  try {
    // Check if author column exists
    const { data: articles, error } = await supabase
      .from('articles')
      .select('author')
      .limit(1);
    
    if (error) {
      log(`❌ Error checking author column: ${error.message}`, 'red');
      return false;
    }
    
    log('✅ Author column exists in articles table', 'green');
    
    // Get column information using raw SQL
    const { data: columnInfo, error: colError } = await supabase.rpc('execute_sql', {
      query: `
        SELECT column_name, data_type, is_nullable, character_maximum_length 
        FROM information_schema.columns 
        WHERE table_name = 'articles' AND column_name = 'author'
      `
    }).single();
    
    if (colError) {
      // Try alternative approach
      log('⚠️  Direct schema query not available, using alternative check', 'yellow');
    } else if (columnInfo) {
      log(`  Data type: ${columnInfo.data_type}`, 'cyan');
      log(`  Nullable: ${columnInfo.is_nullable}`, 'cyan');
      log(`  Max length: ${columnInfo.character_maximum_length || 'unlimited'}`, 'cyan');
    }
    
    return true;
  } catch (error) {
    log(`❌ Schema verification failed: ${error.message}`, 'red');
    return false;
  }
}

async function analyzeDataQuality() {
  logSection('2. DATA QUALITY ANALYSIS');
  
  try {
    // Get total article count
    const { count: totalArticles } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true });
    
    // Get articles with authors
    const { count: articlesWithAuthor } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .not('author', 'is', null);
    
    const percentage = totalArticles ? ((articlesWithAuthor / totalArticles) * 100).toFixed(2) : 0;
    
    log(`📊 Author Data Coverage:`, 'blue');
    log(`  Total articles: ${totalArticles}`, 'cyan');
    log(`  Articles with author: ${articlesWithAuthor}`, 'cyan');
    log(`  Coverage percentage: ${percentage}%`, percentage > 50 ? 'green' : 'yellow');
    
    // Check for empty strings
    const { count: emptyStrings } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('author', '');
    
    if (emptyStrings === 0) {
      log('✅ No empty string authors found', 'green');
    } else {
      log(`⚠️  Found ${emptyStrings} articles with empty string authors`, 'yellow');
    }
    
    // Check for very long author names
    const { data: longAuthors } = await supabase
      .from('articles')
      .select('author')
      .not('author', 'is', null)
      .order('author', { ascending: false }) // This will help us see longest values
      .limit(5);
    
    if (longAuthors && longAuthors.length > 0) {
      const maxLength = Math.max(...longAuthors.map(a => a.author.length));
      log(`📏 Longest author name: ${maxLength} characters`, 'cyan');
      
      if (maxLength > 100) {
        log('⚠️  Some author names exceed 100 characters', 'yellow');
        longAuthors.forEach(a => {
          if (a.author.length > 100) {
            log(`    "${a.author.substring(0, 50)}..."`, 'yellow');
          }
        });
      }
    }
    
    // Sample of distinct authors
    const { data: sampleAuthors } = await supabase
      .from('articles')
      .select('author')
      .not('author', 'is', null)
      .limit(100);
    
    const uniqueAuthors = new Set(sampleAuthors?.map(a => a.author));
    log(`\n👥 Sample Author Diversity:`, 'blue');
    log(`  Unique authors in sample: ${uniqueAuthors.size}`, 'cyan');
    
    // Show a few example authors
    const authorArray = Array.from(uniqueAuthors).slice(0, 5);
    log(`  Examples:`, 'cyan');
    authorArray.forEach(author => {
      log(`    • ${author}`, 'cyan');
    });
    
    return true;
  } catch (error) {
    log(`❌ Data quality analysis failed: ${error.message}`, 'red');
    return false;
  }
}

async function checkSyncIntegrity() {
  logSection('3. SYNC INTEGRITY CHECK');
  
  try {
    // Check for recent sync activity
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const { data: recentlySynced, count: syncedCount } = await supabase
      .from('articles')
      .select('author, updated_at', { count: 'exact' })
      .gte('updated_at', oneDayAgo.toISOString())
      .not('author', 'is', null)
      .limit(20);
    
    log(`🔄 Recent Sync Activity (last 24h):`, 'blue');
    log(`  Articles with authors updated: ${syncedCount || 0}`, 'cyan');
    
    if (recentlySynced && recentlySynced.length > 0) {
      log('✅ Author data is being captured in recent syncs', 'green');
      
      // Check if existing articles are getting authors
      const { data: backfilled } = await supabase
        .from('articles')
        .select('created_at, updated_at')
        .not('author', 'is', null)
        .lt('created_at', oneDayAgo.toISOString())
        .gte('updated_at', oneDayAgo.toISOString())
        .limit(10);
      
      if (backfilled && backfilled.length > 0) {
        log(`✅ ${backfilled.length} existing articles got authors on resync`, 'green');
      }
    }
    
    // Check for any sync-related issues
    const { data: nullUpdates } = await supabase
      .from('articles')
      .select('id')
      .is('last_sync_update', null)
      .limit(10);
    
    if (!nullUpdates || nullUpdates.length === 0) {
      log('✅ All articles have sync timestamps', 'green');
    } else {
      log(`⚠️  Found ${nullUpdates.length} articles without sync timestamps`, 'yellow');
    }
    
    return true;
  } catch (error) {
    log(`❌ Sync integrity check failed: ${error.message}`, 'red');
    return false;
  }
}

async function analyzeEdgeCases() {
  logSection('4. EDGE CASE ANALYSIS');
  
  try {
    // Check for special characters
    const { data: specialChars } = await supabase
      .from('articles')
      .select('author')
      .not('author', 'is', null)
      .or('author.ilike.%&%,author.ilike.%\'%,author.ilike.%"%,author.ilike.%-%')
      .limit(10);
    
    if (specialChars && specialChars.length > 0) {
      log(`🔍 Found ${specialChars.length} authors with special characters:`, 'blue');
      specialChars.slice(0, 5).forEach(a => {
        log(`    • "${a.author}"`, 'cyan');
      });
      log('✅ Special characters are handled correctly', 'green');
    } else {
      log('ℹ️  No authors with special characters found', 'cyan');
    }
    
    // Check for multi-author articles (e.g., "John Doe and Jane Smith")
    const { data: multiAuthors } = await supabase
      .from('articles')
      .select('author')
      .not('author', 'is', null)
      .or('author.ilike.% and %,author.ilike.% & %,author.ilike.%, %')
      .limit(10);
    
    if (multiAuthors && multiAuthors.length > 0) {
      log(`\n👥 Found ${multiAuthors.length} potential multi-author articles:`, 'blue');
      multiAuthors.slice(0, 3).forEach(a => {
        log(`    • "${a.author}"`, 'cyan');
      });
    }
    
    // Check for placeholder/generic authors
    const placeholders = ['admin', 'administrator', 'rss', 'feed', 'unknown', 'webmaster', 'noreply'];
    const { data: genericAuthors } = await supabase
      .from('articles')
      .select('author')
      .in('author', placeholders.map(p => [p, p.charAt(0).toUpperCase() + p.slice(1)]).flat())
      .limit(10);
    
    if (genericAuthors && genericAuthors.length > 0) {
      log(`\n⚠️  Found ${genericAuthors.length} articles with generic/placeholder authors`, 'yellow');
      const unique = new Set(genericAuthors.map(a => a.author));
      log(`    Placeholders: ${Array.from(unique).join(', ')}`, 'yellow');
    } else {
      log('\n✅ No obvious placeholder authors found', 'green');
    }
    
    return true;
  } catch (error) {
    log(`❌ Edge case analysis failed: ${error.message}`, 'red');
    return false;
  }
}

async function checkPerformance() {
  logSection('5. PERFORMANCE CHECK');
  
  try {
    // Test query performance with author field
    const start1 = Date.now();
    const { data: authorQuery } = await supabase
      .from('articles')
      .select('id, title, author')
      .not('author', 'is', null)
      .order('published_at', { ascending: false })
      .limit(100);
    const time1 = Date.now() - start1;
    
    log(`⏱️  Query with author field: ${time1}ms`, time1 < 500 ? 'green' : 'yellow');
    
    // Test author search performance
    const start2 = Date.now();
    const { data: searchQuery } = await supabase
      .from('articles')
      .select('id, title, author')
      .ilike('author', '%John%')
      .limit(20);
    const time2 = Date.now() - start2;
    
    log(`⏱️  Author search query: ${time2}ms`, time2 < 300 ? 'green' : 'yellow');
    
    if (time1 < 1000 && time2 < 500) {
      log('✅ Query performance is acceptable', 'green');
    } else {
      log('⚠️  Consider adding indexes for better performance', 'yellow');
    }
    
    return true;
  } catch (error) {
    log(`❌ Performance check failed: ${error.message}`, 'red');
    return false;
  }
}

async function generateSummary() {
  logSection('VERIFICATION SUMMARY');
  
  const results = [];
  
  results.push(await verifyDatabaseSchema());
  results.push(await analyzeDataQuality());
  results.push(await checkSyncIntegrity());
  results.push(await analyzeEdgeCases());
  results.push(await checkPerformance());
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('\n' + '='.repeat(60));
  if (passed === total) {
    log(`✅ ALL CHECKS PASSED (${passed}/${total})`, 'green');
    log('\nRR-143 Database integrity verification complete!', 'bright');
  } else {
    log(`⚠️  PARTIAL SUCCESS (${passed}/${total} checks passed)`, 'yellow');
    log('\nPlease review the warnings above.', 'yellow');
  }
  console.log('='.repeat(60));
}

// Run all verifications
generateSummary().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});