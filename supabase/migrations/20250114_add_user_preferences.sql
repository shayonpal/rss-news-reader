-- RR-175: Add preferences JSONB column to users table for timezone storage
-- This supports application-level caching of timezone queries

-- Add preferences column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Create index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_users_preferences_timezone 
ON users ((preferences->>'timezone'));

-- Set default timezone for existing users
UPDATE users 
SET preferences = jsonb_set(
  COALESCE(preferences, '{}'),
  '{timezone}',
  '"America/Toronto"'
)
WHERE preferences IS NULL 
   OR preferences->>'timezone' IS NULL;