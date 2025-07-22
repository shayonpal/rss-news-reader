-- Migration: Add bi-directional sync support
-- Purpose: Enable two-way synchronization of read/unread and starred status with Inoreader

-- Create sync queue table to track pending changes
CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  inoreader_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('read', 'unread', 'star', 'unstar')),
  action_timestamp TIMESTAMPTZ NOT NULL,
  sync_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX idx_sync_queue_created ON sync_queue(created_at);
CREATE INDEX idx_sync_queue_attempts ON sync_queue(sync_attempts);
CREATE INDEX idx_sync_queue_inoreader_id ON sync_queue(inoreader_id);

-- Add tracking columns to articles table
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS last_local_update TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_sync_update TIMESTAMPTZ;

-- Add RLS policies for sync_queue
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (in our case, the anon key)
CREATE POLICY "Enable all operations for anon users" ON sync_queue
  FOR ALL USING (true) WITH CHECK (true);

-- Add trigger to automatically clean old sync queue entries
CREATE OR REPLACE FUNCTION clean_old_sync_queue_entries()
RETURNS void AS $$
BEGIN
  DELETE FROM sync_queue
  WHERE sync_attempts >= 3 
    AND last_attempt_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Function to add entry to sync queue
CREATE OR REPLACE FUNCTION add_to_sync_queue(
  p_article_id UUID,
  p_inoreader_id TEXT,
  p_action_type TEXT
)
RETURNS UUID AS $$
DECLARE
  v_queue_id UUID;
BEGIN
  -- Check if there's already a pending action for this article
  DELETE FROM sync_queue 
  WHERE article_id = p_article_id 
    AND action_type IN (
      CASE 
        WHEN p_action_type IN ('read', 'unread') THEN ARRAY['read', 'unread']
        WHEN p_action_type IN ('star', 'unstar') THEN ARRAY['star', 'unstar']
      END
    );
  
  -- Insert new queue entry
  INSERT INTO sync_queue (article_id, inoreader_id, action_type, action_timestamp)
  VALUES (p_article_id, p_inoreader_id, p_action_type, NOW())
  RETURNING id INTO v_queue_id;
  
  RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;

-- Create view for sync queue statistics
CREATE OR REPLACE VIEW sync_queue_stats AS
SELECT 
  COUNT(*) as total_pending,
  COUNT(*) FILTER (WHERE sync_attempts = 0) as never_attempted,
  COUNT(*) FILTER (WHERE sync_attempts > 0 AND sync_attempts < 3) as retry_pending,
  COUNT(*) FILTER (WHERE sync_attempts >= 3) as failed,
  COUNT(DISTINCT action_type) as action_types
FROM sync_queue;