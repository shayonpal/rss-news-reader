-- Migration: Fix orphaned table RLS issue
-- Issue: RR-147
-- Date: 2025-08-09
-- Description: Handle kv_store_95d5f803 table which has RLS enabled but no policies

-- Investigation showed this table:
-- - Has 0 rows (empty)
-- - Has RLS enabled but no policies (security issue)
-- - Has duplicate indexes
-- - Appears to be unused/test table
-- 
-- Decision: Drop the table entirely as it appears to be leftover from testing

-- First, check if the table exists and has any data (safety check)
DO $$
BEGIN
    -- Check if table exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'kv_store_95d5f803'
    ) THEN
        -- Check if table has any rows
        IF EXISTS (SELECT 1 FROM public.kv_store_95d5f803 LIMIT 1) THEN
            -- If table has data, just disable RLS instead of dropping
            -- This is a safety measure in case the table is actually used
            ALTER TABLE public.kv_store_95d5f803 DISABLE ROW LEVEL SECURITY;
            RAISE NOTICE 'Table kv_store_95d5f803 has data. RLS disabled instead of dropping table.';
        ELSE
            -- Table is empty, safe to drop
            DROP TABLE IF EXISTS public.kv_store_95d5f803 CASCADE;
            RAISE NOTICE 'Dropped empty table kv_store_95d5f803';
        END IF;
    ELSE
        RAISE NOTICE 'Table kv_store_95d5f803 does not exist';
    END IF;
END $$;

-- Note: If the table is dropped, the duplicate indexes will be automatically removed
-- If the table still exists (has data), the duplicate indexes will be handled in the next migration