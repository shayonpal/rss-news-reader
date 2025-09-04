# Database Schema Documentation

## Overview

The RSS News Reader uses a PostgreSQL database hosted on Supabase with comprehensive Row Level Security (RLS) enabled on all tables. The schema supports bi-directional sync, content management, user preferences, and performance optimization through materialized views.

## Database Statistics

- **Total Tables**: 15
- **Materialized Views**: 2
- **Custom Functions**: 18
- **RLS Policies**: 37
- **Indexes**: 47+ on core tables

## Core Tables (15 total)

### Content Management

#### `users`
Store user accounts with preferences and settings.
- **Purpose**: User authentication and personalization
- **Key Fields**: `id`, `email`, `name`, `preferences` (JSONB)
- **RLS**: Restricted to authenticated user

#### `feeds`
RSS feed subscriptions with folder hierarchy support.
- **Purpose**: Manage RSS feed sources
- **Key Fields**: `id`, `user_id`, `folder_id`, `title`, `url`, `is_partial_content`
- **Enhancement**: Added `is_partial_content` column for auto-fetch detection
- **RLS**: User-specific access only

#### `articles`
Individual articles with full content extraction.
- **Purpose**: Store article content and metadata
- **Key Fields**: `id`, `feed_id`, `title`, `content`, `summary`, `is_read`, `is_starred`
- **Parse Tracking**: `parsed_at`, `parse_failed`, `parse_attempts`, `content_length`
- **RLS**: Access through user's feed subscriptions

#### `folders`
Feed organization hierarchy.
- **Purpose**: Hierarchical organization of feeds
- **Key Fields**: `id`, `user_id`, `parent_id`, `name`, `sort_order`
- **Features**: Self-referencing for nested folders
- **RLS**: User-specific folder access

### Tagging System

#### `tags`
User-defined and Inoreader tags for categorization.
- **Purpose**: Article categorization and filtering
- **Key Fields**: `id`, `user_id`, `name`, `color`, `description`, `unread_count`
- **Features**: Support for both user tags and system tags
- **RLS**: User-specific tags only

#### `article_tags`
Junction table for many-to-many article-tag relationships.
- **Purpose**: Link articles to multiple tags
- **Key Fields**: `article_id`, `tag_id`, `user_id`, `created_at`
- **RLS**: Access through user's articles and tags

### Sync Management

#### `sync_queue`
Track local changes for bi-directional synchronization.
- **Purpose**: Queue local changes for sync to Inoreader
- **Key Fields**: `id`, `user_id`, `action`, `resource_type`, `resource_id`, `retry_count`
- **Features**: Retry logic with exponential backoff
- **RLS**: User-specific queue access

#### `sync_metadata`
Track sync operation statistics and state.
- **Purpose**: Store sync continuation tokens and metadata
- **Key Fields**: `key`, `value`, `user_id`, `updated_at`
- **Usage**: Store 'last_sync', 'continuation' tokens
- **RLS**: User-specific metadata

#### `sync_status`
Progress tracking for sync operations.
- **Purpose**: Real-time sync progress monitoring
- **Key Fields**: `id`, `user_id`, `status`, `progress`, `total_items`, `metadata`
- **Features**: Progress percentage, error tracking, expiration
- **RLS**: User-specific status access

#### `deleted_articles`
Track locally deleted articles to prevent re-import.
- **Purpose**: Prevent re-syncing of deleted content
- **Key Fields**: `id`, `article_id`, `user_id`, `deleted_at`
- **Current Records**: 4889+ deleted articles tracked
- **RLS**: User-specific deletion tracking

### System Management

#### `api_usage`
Track API rate limits and usage statistics.
- **Purpose**: Monitor and enforce Inoreader API limits
- **Key Fields**: `user_id`, `zone1_usage`, `zone2_usage`, `zone1_limit`, `zone2_limit`, `reset_after`
- **Enhancement**: Zone-based rate limiting for Inoreader's dual-zone system
- **RLS**: User-specific usage data

#### `system_config`
Cache system configuration and settings.
- **Purpose**: Store application-wide configuration
- **Key Fields**: `key`, `value` (JSONB), `updated_at`
- **Usage**: Feature flags, system settings
- **RLS**: Read-only access for users

#### `fetch_logs`
Track full content extraction attempts and results.
- **Purpose**: Monitor content parsing success/failure
- **Key Fields**: `id`, `article_id`, `status`, `duration_ms`, `error_details`
- **Enhancement**: Performance metrics with `duration_ms`
- **RLS**: Access through user's articles

#### `ai_models`
Metadata for available AI summarization models.
- **Purpose**: Manage multiple AI model configurations
- **Key Fields**: `id`, `name`, `provider`, `model_id`, `is_active`
- **Current Models**: 5 configured models
- **RLS**: Public read access for model selection

## Materialized Views

### `feed_stats`
Pre-calculate unread counts for performance.
- **Purpose**: Optimize feed list rendering
- **Refresh**: Via `refresh_feed_stats()` function
- **Columns**: `feed_id`, `unread_count`, `total_count`, `last_updated`

### `feed_author_stats`
Author coverage analytics per feed.
- **Purpose**: Analyze author distribution in feeds
- **Columns**: `feed_id`, `author`, `article_count`, `percentage`
- **Usage**: Content quality metrics

## Key Database Functions

### Query Functions
- `get_unread_counts_by_feed(p_user_id uuid)` - Returns unread counts per feed
- `refresh_feed_stats()` - Refreshes materialized view
- `get_user_preferences(p_user_id uuid)` - Retrieve user settings
- `update_sync_progress(p_user_id uuid, p_progress integer, p_total integer)` - Update sync status

### Maintenance Functions
- `cleanup_old_articles(p_user_id uuid, p_limit integer)` - Remove old read articles
- `vacuum_deleted_articles()` - Clean up deleted article references
- `reset_parse_failures()` - Reset failed parsing attempts for retry

## Indexing Strategy

### Primary Indexes
- All primary keys have clustered indexes
- Foreign keys indexed for join performance
- Composite indexes on frequently queried column combinations

### Performance Indexes on `articles`
1. `idx_articles_feed_created` - (feed_id, created_at DESC)
2. `idx_articles_user_unread` - (user_id, is_read) WHERE is_read = false
3. `idx_articles_starred` - (user_id, is_starred) WHERE is_starred = true
4. `idx_articles_parse_status` - (parse_failed, parse_attempts)
5. `idx_articles_content_length` - (content_length) WHERE content_length IS NOT NULL

### Query Optimization Indexes
- `idx_feeds_user_folder` - (user_id, folder_id)
- `idx_sync_queue_pending` - (user_id, status) WHERE status = 'pending'
- `idx_deleted_articles_lookup` - (article_id, user_id)

## Row Level Security (RLS)

All tables have RLS enabled with the following pattern:

### User Isolation
```sql
-- Example policy for user-owned data
CREATE POLICY "Users can only see their own data"
ON table_name
FOR ALL
TO authenticated
USING (user_id = auth.uid());
```

### Service Role Access
```sql
-- Service role bypass for background operations
CREATE POLICY "Service role has full access"
ON table_name
FOR ALL
TO service_role
USING (true);
```

### Public Read Access (select tables)
```sql
-- Public configuration access
CREATE POLICY "Public read access to config"
ON system_config
FOR SELECT
TO authenticated
USING (true);
```

## Performance Optimizations

### Materialized Views
- `feed_stats` - Pre-calculated counters updated every sync
- `feed_author_stats` - Author analytics refreshed daily

### Batch Operations
- Bulk inserts for article sync (500+ articles per batch)
- Batch marking read/unread operations
- Queue-based sync with configurable batch sizes

### Connection Pooling
- Supabase automatic connection pooling
- Prepared statements for repeated queries
- Connection reuse in sync operations

## Migration History

### Recent Schema Evolution
- Added `is_partial_content` to feeds for auto-fetch detection
- Enhanced `api_usage` with zone-based rate limiting
- Added parse tracking columns to articles
- Created `deleted_articles` table for sync integrity
- Implemented `sync_status` for progress tracking
- Added `ai_models` table for multi-model support

## Backup and Recovery

### Automated Backups
- Supabase Point-in-Time Recovery (7 days)
- Daily automated backups
- Transaction logs for recovery

### Data Integrity
- Foreign key constraints on all relationships
- Check constraints for data validation
- Unique constraints on critical fields
- NOT NULL constraints where appropriate

## Future Considerations

### Planned Enhancements
- Partitioning for articles table (by date)
- Additional materialized views for analytics
- Full-text search indexes
- Archive table for old articles
- User activity tracking table

### Scaling Preparations
- Table partitioning strategy defined
- Index optimization for larger datasets
- Query performance monitoring in place
- Connection pool sizing configured

## Related Documentation

- [Bi-directional Sync Architecture](./bidirectional-sync.md)
- [Cleanup Architecture](./cleanup-architecture.md)
- [API Integrations](./api-integrations.md)
- [Performance Optimization Guide](../monitoring/health-monitoring-overview.md)