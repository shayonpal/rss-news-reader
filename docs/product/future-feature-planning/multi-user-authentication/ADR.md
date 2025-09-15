# Architectural Decision Record: Multi-User Authentication & Architecture Conversion

## Decision Summary

**Status**: Approved
**Date**: 2025-09-15
**Decision Makers**: Product Owner
**Context**: Convert RSS News Reader from single-user to multi-user architecture supporting 5-10 invited users

## Architecture Decision: Enhanced Cron with Selective Isolation

### Context & Problem Statement

The RSS News Reader requires conversion from single-user to multi-user architecture to support trusted colleagues and friends accessing their personal RSS feeds. The solution must balance simplicity, reliability, and appropriate scaling for a small, invite-only user base accessed via Tailscale network.

### Key Architectural Decisions

#### 1. User Management Approach

**Decision**: Minimal user lifecycle management with Tailscale-based access control

**Rationale**:

- Reduces complexity by leveraging existing Tailscale infrastructure
- Eliminates need for formal invite tracking or user status management
- Focuses implementation effort on core multi-user functionality
- Tailscale access serves as natural invitation and access control mechanism

**Implementation**:

- No user profiles/status management in UI
- Admin handles issues via database queries and PM2 logs
- URL sharing with Tailscale users replaces formal invite system

#### 2. Data Ownership Model

**Decision**: Selective Isolation with Admin Visibility

**Rationale**:

- Balances user privacy with operational visibility needs
- Enables system monitoring and troubleshooting without compromising personal data
- Supports anonymized analytics for system optimization
- Provides clear data boundaries for deletion and compliance

**Implementation**:

- User-scoped RLS policies for personal data (feeds, articles, reading history)
- Admin access to anonymized aggregated data and system metrics
- Complete cross-user data isolation for content
- Hashed/anonymized error logs and performance data

#### 3. Session Management Strategy

**Decision**: Multi-Device Sessions with Auto Refresh

**Rationale**:

- Meets modern user expectations for multi-device access
- Leverages Supabase Auth capabilities for robust session management
- Supports independent device sessions without complex state synchronization
- Provides seamless user experience across devices

**Implementation**:

- Independent sessions per device/browser using Supabase Auth defaults
- Auto-refresh enabled for transparent token renewal
- Device-specific logout preserving other active sessions
- No server-side session storage required

#### 4. Data Deletion & Privacy Rights

**Decision**: User-controlled complete data deletion with anonymized metrics preservation

**Rationale**:

- Respects user autonomy and privacy expectations
- Enables fresh start capability for users who want clean slate
- Preserves valuable system insights through anonymized data retention
- Supports potential future compliance requirements

**Implementation**:

- "Delete All My Data" button with confirmation in settings
- Complete removal of user-scoped data with preserved anonymized metrics
- Support for same-user re-registration after deletion

#### 5. User Acquisition Model

**Decision**: Admin-controlled invite-only system via Tailscale

**Rationale**:

- Maintains control over user base quality and system load
- Leverages existing Tailscale infrastructure for security
- Reduces abuse risk and support overhead
- Aligns with small, trusted user base goal

**Implementation**:

- Manual Tailscale access granting for user management
- URL sharing replaces formal database-driven invite system
- No self-registration or public access

#### 6. User Tier Strategy

**Decision**: Single tier with personal customization

**Rationale**:

- Simplifies architecture by eliminating role/permission complexity
- Promotes equality among invited trusted users
- Leverages existing settings page for personalization
- Reduces implementation and maintenance overhead

**Implementation**:

- All users access identical feature set
- Personal preferences managed via existing `/reader/settings` page
- No role-based access control or premium features

#### 7. Data Migration Approach

**Decision**: Fresh start for all users including existing users

**Rationale**:

- Ensures clean multi-user architecture without legacy data complications
- Eliminates complex migration logic and potential data corruption
- Provides consistent experience for all users
- Simplifies testing and validation of multi-user isolation

**Implementation**:

- All users sync from scratch including current 'shayon' user
- No data migration from existing single-user system
- Fresh account creation for all users via OAuth

#### 8. Sync Priority Model

**Decision**: Democratic round-robin scheduling with enhanced cron

**Rationale**:

- Promotes fair resource allocation without user hierarchy
- Avoids complexity of priority queue systems for small user base
- Maintains predictable sync behavior for all users
- Leverages existing reliable cron infrastructure

**Implementation**:

- Equal priority processing for all users during sync windows
- Sequential user processing with advisory lock collision prevention
- No premium queue tiers or user prioritization

#### 9. Sync Architecture: Enhanced Cron vs Queue Systems

**Decision**: Enhanced cron with Postgres advisory locks (rejecting Redis + BullMQ)

**Rationale**:

- **Scale Appropriateness**: 5-10 users don't require queue infrastructure designed for 100+ users
- **Infrastructure Simplicity**: Avoids Redis deployment and maintenance overhead
- **Reliability**: Builds on existing, proven PM2 cron system
- **Cost Efficiency**: No additional infrastructure hosting costs
- **Operational Complexity**: Reduces monitoring and troubleshooting surface area
- **Future Migration**: Can migrate to pg-boss or BullMQ when scale actually demands it

**Implementation**:

- Postgres advisory locks for collision prevention (global + per-user)
- Enhanced cron with database-stored retry logic and state tracking
- Sequential user processing during existing 6x daily sync windows
- Simple error handling with exponential backoff

#### 10. Provider Support Strategy

**Decision**: Inoreader-only MVP with multi-provider architecture foundation

**Rationale**:

- Focused MVP scope reduces implementation complexity and time
- Establishes architectural patterns for future provider expansion
- Validates multi-user architecture before adding provider complexity
- Serves immediate user needs while preserving expansion options

**Implementation**:

- Single provider integration with extensible provider interface design
- Database schema designed for future multi-provider support
- Settings page foundation for future provider management

### Technology Stack Decisions

#### Authentication Infrastructure

**Choice**: Supabase Auth with Inoreader OAuth

**Rationale**:

- Leverages existing Supabase infrastructure
- Provides robust multi-device session support
- Handles OAuth complexity with battle-tested implementation
- Supports auto-refresh and secure token management
- Eliminates need for custom authentication infrastructure

#### Access Control Infrastructure

**Choice**: Tailscale Network Security

**Rationale**:

- Existing infrastructure already deployed and managed
- Provides network-level security without application-level complexity
- Trusted network environment simplifies security model
- Eliminates need for public internet access controls

#### Database Schema Approach

**Choice**: Row-Level Security (RLS) with user-scoped isolation

**Rationale**:

- Leverages Supabase/PostgreSQL built-in security features
- Provides automatic data isolation at database level
- Reduces application-level security complexity
- Supports fine-grained access control policies

### Implementation Architecture

#### Database Schema Design

```sql
-- Enhanced user table for multi-user support
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inoreader_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,

  -- Enhanced cron sync state tracking
  last_sync_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ DEFAULT NOW(),
  sync_failure_count INTEGER DEFAULT 0
);

-- User-scoped data with RLS
ALTER TABLE feeds ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE articles ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE tags ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE folders ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE article_tags ADD COLUMN user_id UUID REFERENCES users(id);

-- Admin-visible anonymized metrics
CREATE TABLE admin_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_hash TEXT NOT NULL,  -- Hashed user ID for privacy
  metric_type TEXT NOT NULL,
  metric_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync operation logging
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  sync_type TEXT NOT NULL, -- 'scheduled', 'manual', 'bidirectional'
  status TEXT NOT NULL, -- 'success', 'failure', 'partial'
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### RLS Policy Implementation

```sql
-- User-scoped data policies
CREATE POLICY "users_own_data" ON feeds
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "users_own_articles" ON articles
  FOR ALL USING (user_id = auth.uid());

-- Service role access for admin operations
CREATE POLICY "service_role_access" ON admin_metrics
  FOR ALL TO service_role USING (true);
```

#### Enhanced Cron Sync Implementation

```sql
-- Advisory lock functions for collision prevention
CREATE OR REPLACE FUNCTION acquire_global_sync_lock()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN pg_try_advisory_lock(1001);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION acquire_user_sync_lock(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN pg_try_advisory_lock(hashtext(target_user_id::text));
END;
$$ LANGUAGE plpgsql;

-- User data deletion procedure
CREATE OR REPLACE FUNCTION delete_user_data(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Delete user-scoped data
  DELETE FROM article_tags WHERE user_id = target_user_id;
  DELETE FROM articles WHERE user_id = target_user_id;
  DELETE FROM tags WHERE user_id = target_user_id;
  DELETE FROM folders WHERE user_id = target_user_id;
  DELETE FROM feeds WHERE user_id = target_user_id;

  -- Soft delete user record (preserve for audit)
  UPDATE users SET deleted_at = NOW() WHERE id = target_user_id;

  -- Convert to anonymized metrics
  INSERT INTO admin_metrics (user_hash, metric_type, metric_value)
  SELECT
    md5(target_user_id::text) as user_hash,
    'user_deletion',
    jsonb_build_object('deleted_at', NOW())
  WHERE NOT EXISTS (
    SELECT 1 FROM admin_metrics
    WHERE user_hash = md5(target_user_id::text)
    AND metric_type = 'user_deletion'
  );
END;
$$ LANGUAGE plpgsql;
```

### Implementation Phases

#### Phase 1: Core Authentication & Session Management (2 weeks)

- Supabase Auth integration with Inoreader OAuth flow
- Multi-device session support with auto-refresh capability
- Auto-user creation on first successful OAuth completion
- Independent device session management and device-specific logout

#### Phase 2: Selective Data Isolation (2 weeks)

- User-scoped RLS policy implementation across all tables
- Admin metrics collection system with anonymization
- Data deletion functionality with "Delete All My Data" UI
- Complete user-scoped data removal with metric preservation

#### Phase 3: Enhanced Cron Sync System (2 weeks)

- Postgres advisory lock implementation for collision prevention
- Sequential user processing during existing sync windows
- Database-based retry logic with exponential backoff
- User sync state tracking and error logging

#### Phase 4: Testing & Documentation (1 week)

- Multi-user testing with real Tailscale network access
- Multi-device session testing across browsers
- Data deletion and re-registration testing
- Performance validation under concurrent user load
- Security audit for cross-user isolation verification

### Administrative Operations

#### User Access Control

- User access managed via existing Tailscale network permissions
- App URL sharing (http://100.96.166.53:3000/reader) with Tailscale users
- No formal invite system - Tailscale access serves as invitation

#### User Onboarding Process

1. Grant user access to Tailscale network (existing process)
2. Share app URL with user
3. User visits URL → auto-redirected to Inoreader OAuth
4. User completes OAuth → account auto-created in database
5. User immediately accesses personal feeds from Inoreader

#### Operational Monitoring

```sql
-- View current active users
SELECT email, created_at, last_sync_at
FROM users
WHERE deleted_at IS NULL
ORDER BY last_sync_at DESC;

-- Check system sync health
SELECT
  COUNT(*) as total_users,
  COUNT(CASE WHEN last_sync_at > NOW() - INTERVAL '1 hour' THEN 1 END) as recently_synced,
  AVG(sync_failure_count) as avg_failure_count
FROM users
WHERE deleted_at IS NULL;

-- Monitor sync performance
SELECT
  sync_type,
  status,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration
FROM sync_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY sync_type, status;
```

#### User Removal Options

- **Option 1**: Remove user from Tailscale network (loses access to app)
- **Option 2**: User self-deletes via "Delete All My Data" button (removes data, keeps Tailscale access)

### Success Criteria

#### Technical MVP Goals

- 5-10 successful Tailscale network users with complete data isolation
- Zero cross-user data access incidents
- Equal sync performance across all users (democratic processing)
- <2s API response time with concurrent users during sync windows
- Successful multi-device session management with 99% auto-refresh success rate
- Complete fresh start experience for all users including existing user
- Functional data deletion with proper anonymized metrics preservation

#### Post-MVP Expansion Readiness

- Multi-provider architecture foundation established
- Provider switching capability designed and ready for implementation
- Enhanced settings page architecture prepared for provider management
- Anonymized analytics infrastructure ready for advanced reporting

### Risks & Mitigations

#### Technical Risks

- **Advisory Lock Contention**: Mitigated by per-user locks and timeout handling
- **Sync Window Duration**: Mitigated by sequential processing with reasonable timeouts
- **Cross-User Data Leakage**: Mitigated by comprehensive RLS policies and testing

#### Operational Risks

- **Tailscale Dependency**: Accepted risk given existing infrastructure dependency
- **Manual User Management**: Mitigated by simple database queries and existing tools
- **No Admin UI**: Accepted trade-off for simplified MVP scope

This architecture provides a focused, reliable foundation for multi-user support that avoids over-engineering while establishing patterns for future expansion and maintaining the simplicity that makes the RSS News Reader effective.
