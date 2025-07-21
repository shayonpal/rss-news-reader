-- Create api_usage table for tracking API rate limits
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(service, date)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_api_usage_service_date ON api_usage(service, date);

-- Create sync_metadata table for storing sync-related data
CREATE TABLE IF NOT EXISTS sync_metadata (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Add full_content and ai_summary columns to articles table if they don't exist
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS full_content TEXT,
ADD COLUMN IF NOT EXISTS has_full_content BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS author VARCHAR(255);

-- Grant permissions
GRANT ALL ON api_usage TO authenticated;
GRANT ALL ON sync_metadata TO authenticated;