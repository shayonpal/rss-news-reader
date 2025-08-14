-- Migration: Add chunk size configuration for article deletion
-- Issue: RR-150 - Fix 414 Request-URI Too Large error

INSERT INTO system_config (key, value, description)
VALUES (
  'max_ids_per_delete_operation',
  '200',
  'Maximum number of IDs to include in a single DELETE operation to avoid URI length limits'
)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value,
    description = EXCLUDED.description;