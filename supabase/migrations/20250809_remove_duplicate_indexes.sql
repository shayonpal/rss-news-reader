-- Migration: Remove duplicate indexes
-- Issue: RR-147
-- Date: 2025-08-09
-- Description: Drop duplicate indexes that are redundant with PRIMARY KEY constraints

-- These duplicate indexes on kv_store_95d5f803 are redundant because:
-- 1. The column 'key' is already a PRIMARY KEY (which creates its own index)
-- 2. These additional indexes provide no benefit but consume storage and slow writes

-- Only drop these indexes if the table still exists
-- (The previous migration may have dropped the table entirely if it was empty)

DO $$
BEGIN
    -- Check if the table exists before trying to drop indexes
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'kv_store_95d5f803'
    ) THEN
        -- Drop the duplicate indexes
        DROP INDEX IF EXISTS public.kv_store_95d5f803_key_idx;
        DROP INDEX IF EXISTS public.kv_store_95d5f803_key_idx1;
        RAISE NOTICE 'Dropped duplicate indexes on kv_store_95d5f803';
    ELSE
        RAISE NOTICE 'Table kv_store_95d5f803 does not exist, skipping index drops';
    END IF;
END $$;

-- IMPORTANT: Do NOT drop these indexes as they support UNIQUE constraints:
-- - idx_feeds_inoreader_id (supports feeds.inoreader_id UNIQUE constraint)
-- - idx_articles_inoreader_id (supports articles.inoreader_id UNIQUE constraint)
-- - idx_folders_inoreader_id (supports folders.inoreader_id UNIQUE constraint)
-- 
-- The Supabase advisor incorrectly flagged these as unused, but they are essential
-- for maintaining data integrity and preventing duplicate Inoreader IDs.

-- Optional: Add comment to remaining indexes explaining why they shouldn't be dropped
COMMENT ON INDEX IF EXISTS public.idx_feeds_inoreader_id IS 
    'Supports UNIQUE constraint on feeds.inoreader_id - DO NOT DROP';
COMMENT ON INDEX IF EXISTS public.idx_articles_inoreader_id IS 
    'Supports UNIQUE constraint on articles.inoreader_id - DO NOT DROP';
COMMENT ON INDEX IF EXISTS public.idx_folders_inoreader_id IS 
    'Supports UNIQUE constraint on folders.inoreader_id - DO NOT DROP';