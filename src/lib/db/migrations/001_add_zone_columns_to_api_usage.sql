-- Migration: Add zone columns to api_usage table for RR-5
-- This migration adds zone1 and zone2 usage and limit columns to track Inoreader API rate limits

-- Add zone1_usage column
ALTER TABLE api_usage 
ADD COLUMN IF NOT EXISTS zone1_usage INTEGER DEFAULT 0;

-- Add zone1_limit column
ALTER TABLE api_usage 
ADD COLUMN IF NOT EXISTS zone1_limit INTEGER DEFAULT 5000;

-- Add zone2_usage column
ALTER TABLE api_usage 
ADD COLUMN IF NOT EXISTS zone2_usage INTEGER DEFAULT 0;

-- Add zone2_limit column
ALTER TABLE api_usage 
ADD COLUMN IF NOT EXISTS zone2_limit INTEGER DEFAULT 100;

-- Add reset_after column to track when limits reset
ALTER TABLE api_usage 
ADD COLUMN IF NOT EXISTS reset_after INTEGER DEFAULT 0;

-- Add updated_at column for tracking last update
ALTER TABLE api_usage 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Create index for faster queries on service and date
CREATE INDEX IF NOT EXISTS idx_api_usage_service_date 
ON api_usage(service, date);

-- Update RLS policy to ensure user can read/write their own API usage
-- (Assuming existing RLS policies are in place)

COMMENT ON COLUMN api_usage.zone1_usage IS 'Current usage count for Zone 1 (read operations)';
COMMENT ON COLUMN api_usage.zone1_limit IS 'Maximum allowed calls for Zone 1';
COMMENT ON COLUMN api_usage.zone2_usage IS 'Current usage count for Zone 2 (write operations)';
COMMENT ON COLUMN api_usage.zone2_limit IS 'Maximum allowed calls for Zone 2';
COMMENT ON COLUMN api_usage.reset_after IS 'Seconds until rate limit resets';
COMMENT ON COLUMN api_usage.updated_at IS 'Last time the usage was updated';