-- Migration 011: Remove content cleanup function and configuration
-- RR-168: Remove auto-cleanup of fetched full content
-- Created: 2025-08-10 20:43:00

-- Drop the cleanup function that was added in migration 010
DROP FUNCTION IF EXISTS cleanup_old_parsed_content();

-- Remove content retention configuration from system_config
-- This is optional as the value being present but unused is harmless
DELETE FROM system_config WHERE key = 'content_retention_days';

-- Add comment documenting the removal
COMMENT ON TABLE articles IS 'Articles table - full_content is now preserved indefinitely. Cleanup handled only by RR-129 article retention (1000-article limit)';