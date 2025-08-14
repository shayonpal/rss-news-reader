-- Migration: Create tags and article_tags tables for RR-128
-- Description: Add proper tags table architecture with junction table for many-to-many relationships

-- Create tags table following existing patterns
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  color TEXT,
  description TEXT,
  article_count INTEGER DEFAULT 0,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, slug)
);

-- Create article_tags junction table
CREATE TABLE IF NOT EXISTS article_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(article_id, tag_id)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_article_tags_article_id ON article_tags(article_id);
CREATE INDEX IF NOT EXISTS idx_article_tags_tag_id ON article_tags(tag_id);

-- Create updated_at trigger for tags table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies following existing pattern
-- Tags policies
CREATE POLICY "Single user read tags" ON tags
    FOR SELECT
    USING (user_id IN (SELECT id FROM users WHERE inoreader_id = 'shayon'));

CREATE POLICY "Single user insert tags" ON tags
    FOR INSERT
    WITH CHECK (user_id IN (SELECT id FROM users WHERE inoreader_id = 'shayon'));

CREATE POLICY "Single user update tags" ON tags
    FOR UPDATE
    USING (user_id IN (SELECT id FROM users WHERE inoreader_id = 'shayon'))
    WITH CHECK (user_id IN (SELECT id FROM users WHERE inoreader_id = 'shayon'));

CREATE POLICY "Single user delete tags" ON tags
    FOR DELETE
    USING (user_id IN (SELECT id FROM users WHERE inoreader_id = 'shayon'));

-- Article_tags policies
CREATE POLICY "Single user read article_tags" ON article_tags
    FOR SELECT
    USING (
        article_id IN (
            SELECT a.id FROM articles a
            JOIN feeds f ON a.feed_id = f.id
            JOIN users u ON f.user_id = u.id
            WHERE u.inoreader_id = 'shayon'
        )
    );

CREATE POLICY "Single user insert article_tags" ON article_tags
    FOR INSERT
    WITH CHECK (
        article_id IN (
            SELECT a.id FROM articles a
            JOIN feeds f ON a.feed_id = f.id
            JOIN users u ON f.user_id = u.id
            WHERE u.inoreader_id = 'shayon'
        )
    );

CREATE POLICY "Single user update article_tags" ON article_tags
    FOR UPDATE
    USING (
        article_id IN (
            SELECT a.id FROM articles a
            JOIN feeds f ON a.feed_id = f.id
            JOIN users u ON f.user_id = u.id
            WHERE u.inoreader_id = 'shayon'
        )
    )
    WITH CHECK (
        article_id IN (
            SELECT a.id FROM articles a
            JOIN feeds f ON a.feed_id = f.id
            JOIN users u ON f.user_id = u.id
            WHERE u.inoreader_id = 'shayon'
        )
    );

CREATE POLICY "Single user delete article_tags" ON article_tags
    FOR DELETE
    USING (
        article_id IN (
            SELECT a.id FROM articles a
            JOIN feeds f ON a.feed_id = f.id
            JOIN users u ON f.user_id = u.id
            WHERE u.inoreader_id = 'shayon'
        )
    );

-- Service role policies for sync operations
CREATE POLICY "Service role full access tags" ON tags
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access article_tags" ON article_tags
    USING (auth.jwt()->>'role' = 'service_role');

-- Add comment to document the purpose
COMMENT ON TABLE tags IS 'Stores user-defined and Inoreader tags for article categorization';
COMMENT ON TABLE article_tags IS 'Junction table for many-to-many relationship between articles and tags';