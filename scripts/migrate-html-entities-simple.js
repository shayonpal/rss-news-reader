#!/usr/bin/env node

/**
 * RR-154: Simplified migration script for HTML entity decoding
 * 
 * Directly updates articles without backup columns since we can
 * always re-sync from Inoreader if needed.
 */

const { createClient } = require('@supabase/supabase-js');
const { decode } = require('he');

// Configuration
const BATCH_SIZE = 50;

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Progress tracking
let stats = {
  totalArticles: 0,
  processedArticles: 0,
  updatedTitles: 0,
  updatedContent: 0,
  errors: 0,
  startTime: Date.now()
};

/**
 * Same URL detection logic as TypeScript module
 */
function isSafeUrl(text) {
  if (!text || typeof text !== 'string') return false;
  return text.startsWith('http://') ||
         text.startsWith('https://') ||
         text.startsWith('feed://') ||
         text.startsWith('tag:') ||
         text.includes('://');
}

/**
 * Decode HTML entities using 'he' library
 */
function decodeHtmlEntities(text) {
  if (!text || typeof text !== 'string') return text || '';
  if (isSafeUrl(text)) return text;
  
  try {
    return decode(text);
  } catch (error) {
    console.warn(`⚠️ Failed to decode: "${text.substring(0, 50)}..." - ${error.message}`);
    stats.errors++;
    return text;
  }
}

/**
 * Process a batch of articles
 */
async function processBatch(articles) {
  const updates = [];
  
  for (const article of articles) {
    let hasChanges = false;
    const update = { id: article.id };

    // Check and decode title
    if (article.title && article.title.includes('&')) {
      const decoded = decodeHtmlEntities(article.title);
      if (decoded !== article.title) {
        update.title = decoded;
        hasChanges = true;
        stats.updatedTitles++;
      }
    }

    // Check and decode content - be more thorough with detection
    if (article.content) {
      // Check for any HTML entity patterns
      const hasEntities = /&[a-zA-Z]+;|&#[0-9]+;|&#x[0-9A-Fa-f]+;/.test(article.content);
      if (hasEntities) {
        const decoded = decodeHtmlEntities(article.content);
        if (decoded !== article.content) {
          update.content = decoded;
          hasChanges = true;
          stats.updatedContent++;
        }
      }
    }

    if (hasChanges) {
      updates.push(update);
    }
    
    stats.processedArticles++;
  }

  // Apply updates if any
  if (updates.length > 0) {
    // Update each article individually to avoid null constraint issues
    for (const update of updates) {
      const { error } = await supabase
        .from('articles')
        .update(update)
        .eq('id', update.id);

      if (error) {
        console.error(`❌ Failed to update article ${update.id}:`, error);
        stats.errors++;
        // Continue with other updates instead of failing completely
      }
    }

    console.log(`✅ Batch updated: ${updates.length} articles`);
  }

  return updates.length;
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🚀 Starting HTML entity migration...\n');

  try {
    // Find all articles with potential HTML entities
    console.log('📊 Scanning for articles with HTML entities...');
    
    const { data: articles, error, count } = await supabase
      .from('articles')
      .select('id, title, content')
      .or('title.like.%&%,content.like.%&%');

    if (error) throw error;

    stats.totalArticles = articles?.length || 0;
    console.log(`📌 Found ${stats.totalArticles} articles to check\n`);

    if (stats.totalArticles === 0) {
      console.log('✅ No articles with HTML entities found!');
      return;
    }

    // Process in batches
    const totalBatches = Math.ceil(stats.totalArticles / BATCH_SIZE);
    console.log(`🔄 Processing in ${totalBatches} batches of ${BATCH_SIZE}...\n`);

    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      
      process.stdout.write(`  Batch ${batchNum}/${totalBatches}: `);
      const updated = await processBatch(batch);
      
      // Progress bar
      const progress = Math.round((stats.processedArticles / stats.totalArticles) * 100);
      const bar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
      process.stdout.write(`[${bar}] ${progress}%\r`);
    }

    console.log('\n');

    // Verify results
    console.log('🔍 Verifying migration results...');
    
    const { count: remainingTitles } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .or('title.like.%&rsquo;%,title.like.%&lsquo;%,title.like.%&amp;%,title.like.%&quot;%,title.like.%&#8217;%,title.like.%&ndash;%');

    const { count: remainingContent } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .or('content.like.%&rsquo;%,content.like.%&lsquo;%,content.like.%&amp;%,content.like.%&quot;%,content.like.%&#8217;%,content.like.%&ndash;%');

    // Update sync metadata
    await supabase.from('sync_metadata').upsert({
      key: 'html_entity_migration_completed',
      value: JSON.stringify({
        completed_at: new Date().toISOString(),
        total_processed: stats.processedArticles,
        titles_updated: stats.updatedTitles,
        content_updated: stats.updatedContent,
        remaining_titles: remainingTitles || 0,
        remaining_content: remainingContent || 0
      })
    }, { onConflict: 'key' });

    // Final report
    const duration = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 MIGRATION COMPLETE');
    console.log('='.repeat(50));
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📄 Articles processed: ${stats.processedArticles}`);
    console.log(`✏️  Titles updated: ${stats.updatedTitles}`);
    console.log(`📝 Content updated: ${stats.updatedContent}`);
    console.log(`⚠️  Errors: ${stats.errors}`);
    console.log(`🔍 Remaining entities: ${(remainingTitles || 0) + (remainingContent || 0)}`);
    console.log('='.repeat(50));

    if ((remainingTitles || 0) + (remainingContent || 0) === 0) {
      console.log('\n✅ All HTML entities successfully decoded!');
    } else {
      console.log(`\n⚠️  Some entities remain (${remainingTitles} titles, ${remainingContent} content)`);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  runMigration().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runMigration };