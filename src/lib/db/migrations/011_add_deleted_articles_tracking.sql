-- Migration: Add deleted_articles tracking table for RR-129
-- Implements article deletion tracking to prevent re-import of previously deleted read articles

-- Create deleted_articles tracking table
CREATE TABLE IF NOT EXISTS deleted_articles (
  inoreader_id TEXT PRIMARY KEY,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  was_read BOOLEAN DEFAULT true,
  feed_id TEXT
);

-- Create index for efficient cleanup operations (delete entries older than 90 days)
CREATE INDEX IF NOT EXISTS idx_deleted_articles_deleted_at ON deleted_articles(deleted_at);

-- Create index for efficient feed-based queries during cleanup
CREATE INDEX IF NOT EXISTS idx_deleted_articles_feed_id ON deleted_articles(feed_id);

-- Function to automatically cleanup old deleted article tracking entries
CREATE OR REPLACE FUNCTION cleanup_old_deleted_articles()
RETURNS void AS $$
BEGIN
  -- Delete tracking entries older than 90 days
  DELETE FROM deleted_articles 
  WHERE deleted_at < NOW() - INTERVAL '90 days';
  
  -- Log the cleanup operation
  RAISE NOTICE 'Cleaned up old deleted_articles entries older than 90 days';
END;
$$ LANGUAGE plpgsql;

-- Add system configuration for deletion tracking
INSERT INTO system_config (key, value, description, updated_at)
VALUES 
  ('deletion_tracking_enabled', 'true', 'Enable tracking of deleted articles to prevent re-import', NOW()),
  ('deletion_tracking_retention_days', '90', 'Number of days to retain deletion tracking history', NOW()),
  ('cleanup_read_articles_enabled', 'true', 'Enable automatic cleanup of read unstarred articles', NOW()),
  ('feed_deletion_safety_threshold', '0.5', 'Maximum percentage of feeds that can be deleted at once (0.5 = 50%)', NOW()),
  ('max_articles_per_cleanup_batch', '1000', 'Maximum number of articles to process in single cleanup batch', NOW())
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, 
    description = EXCLUDED.description,
    updated_at = NOW();

-- Add comments for documentation
COMMENT ON TABLE deleted_articles IS 'Tracks articles that have been deleted as read/unstarred to prevent re-import during sync';
COMMENT ON COLUMN deleted_articles.inoreader_id IS 'The Inoreader article ID that was deleted locally';
COMMENT ON COLUMN deleted_articles.deleted_at IS 'Timestamp when the article was deleted locally';
COMMENT ON COLUMN deleted_articles.was_read IS 'Whether the article was read when it was deleted (should be true for cleanup deletions)';
COMMENT ON COLUMN deleted_articles.feed_id IS 'The local feed ID the article belonged to (for reference, can be null if feed also deleted)';

-- Add RLS policies for the deleted_articles table
ALTER TABLE deleted_articles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own deleted article tracking
CREATE POLICY "Users can access their deleted articles tracking" ON deleted_articles
FOR ALL 
USING (
  feed_id IN (
    SELECT id FROM feeds WHERE user_id = auth.uid()::text
  )
  OR feed_id IS NULL -- Allow access to entries with null feed_id
);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON deleted_articles TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;