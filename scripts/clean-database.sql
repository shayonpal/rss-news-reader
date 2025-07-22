-- Clean Database Script for Fresh Production Start
-- This will remove all test data while keeping the schema intact

-- Disable triggers temporarily for faster deletion
SET session_replication_role = 'replica';

-- Delete in correct order to respect foreign key constraints
DELETE FROM articles;
DELETE FROM feeds;
DELETE FROM folders;
DELETE FROM sync_metadata;
DELETE FROM api_usage;

-- Clear the materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY feed_stats;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Verify cleanup
SELECT 
  'Articles: ' || COUNT(*) as count FROM articles
UNION ALL
SELECT 
  'Feeds: ' || COUNT(*) FROM feeds
UNION ALL
SELECT 
  'Folders: ' || COUNT(*) FROM folders
UNION ALL
SELECT 
  'Sync Metadata: ' || COUNT(*) FROM sync_metadata
UNION ALL
SELECT 
  'API Usage: ' || COUNT(*) FROM api_usage;