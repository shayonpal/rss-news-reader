-- RR-266: Create ai_models table for storing AI model metadata
-- This migration creates a table to track available AI models with their metadata

-- Create the ai_models table
CREATE TABLE IF NOT EXISTS ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Note: UNIQUE constraint on model_id automatically creates an index for fast lookups
-- No additional index needed

-- Enable Row Level Security
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for public read access
CREATE POLICY "Allow public read access to ai_models"
  ON ai_models
  FOR SELECT
  USING (true);

-- Insert seed data for Claude models
INSERT INTO ai_models (model_id, name, description) VALUES
  ('claude-opus-4-1', 'Claude Opus 4.1', 'Most capable model for complex tasks'),
  ('claude-opus-4-0', 'Claude Opus 4.0', 'Previous Opus version'),
  ('claude-sonnet-4-0', 'Claude Sonnet 4.0', 'Balanced performance and speed'),
  ('claude-3-7-sonnet-latest', 'Claude 3.7 Sonnet', 'Latest Sonnet 3.7 model'),
  ('claude-3-5-haiku-latest', 'Claude 3.5 Haiku', 'Fast and efficient')
ON CONFLICT (model_id) DO NOTHING;

-- Add comment to table for documentation
COMMENT ON TABLE ai_models IS 'Stores metadata for available AI models used in article summarization';
COMMENT ON COLUMN ai_models.model_id IS 'Unique identifier for the model (e.g., claude-opus-4-1)';
COMMENT ON COLUMN ai_models.name IS 'Display name for the model';
COMMENT ON COLUMN ai_models.description IS 'Optional description of model capabilities';
COMMENT ON COLUMN ai_models.created_at IS 'Timestamp when the model was added to the database';