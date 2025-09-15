# Multi-User Authentication & Architecture Conversion - FRD

## Functional Requirements

### MVP Scope: Inoreader-Only Authentication

#### Core Authentication Flow

- **OAuth Integration**: Implement Inoreader OAuth 2.0 flow with PKCE for secure authentication
- **Auto-User Creation**: Automatically create app users on first successful OAuth completion
- **Multi-Device Sessions**: Support independent sessions per device/browser using Supabase Auth
- **Token Management**: Store encrypted tokens per user with secure key management
- **Session Persistence**: 1-hour access tokens, 7-day refresh tokens with auto-refresh enabled
- **Device-Specific Logout**: Logout removes auth token and redirects to login on current device only

#### Minimal User Management

- **Access Control**: Manual invite system via Tailscale network access (no formal invite tracking)
- **No Admin UI**: Use direct database access and PM2 logs for user management in MVP
- **Simple Lifecycle**: URL access → OAuth → auto-account → app usage (no user profiles or status management)
- **Browser/Device Access**: Fresh OAuth required for new browser/device access

#### Single Tier System

- **Equal Access**: All users have identical access and features
- **Personal Customization**: Individual preferences via existing `/reader/settings` page
- **No Role Restrictions**: No role-based feature restrictions or premium tiers
- **Democratic Resources**: Equal resource allocation for all users during sync operations

### Data Isolation & Admin Visibility Requirements

#### Selective Isolation Architecture

- **User-Scoped Data**: Complete isolation for feeds, articles, tags, folders, article_tags, user preferences, reading history, sync metadata
- **Row-Level Security**: Implement RLS policies in Supabase for all user-scoped tables
- **Admin-Visible Data**: Access to anonymized aggregated metrics, hashed/removed user IDs in error logs, system performance data, OAuth audit trail
- **Global Shared Data**: system_config, ai_models, application-level settings shared across users
- **Zero Cross-User Visibility**: Complete data isolation for user-scoped content

#### Data Deletion Rights

- **Self-Service Deletion**: "Delete All My Data" button prominently placed in settings page
- **Confirmation Process**: Deletion confirmation dialog with explicit consent (no export option for MVP)
- **Complete Removal**: Remove all user-scoped data including feeds, articles, tags, folders, preferences, reading history
- **Preserve Analytics**: Maintain anonymized metrics and audit trail with user IDs removed/hashed
- **Re-registration Support**: Allow same user to re-register after deletion for complete fresh start
- **Admin Data Retention**: Retain system performance and error pattern data in anonymized form

#### Fresh Start Migration

- **Clean Slate Approach**: All users start with empty state including existing 'shayon' user
- **No Legacy Migration**: No data migration from current single-user system
- **Sync from Source**: All users sync fresh data from their individual Inoreader accounts
- **Consistent Experience**: Ensure identical onboarding experience for all users

### Session & Authentication Management

#### Multi-Device Authentication Architecture

- **Supabase Auth Integration**: Use default settings with auto-refresh enabled across all client instances
- **Independent Sessions**: Each device/browser maintains separate session state with no interference
- **Logout Scope**: Device-specific logout that preserves other active sessions
- **No Server-Side Storage**: Stateless authentication with no server-side session management required
- **Fresh OAuth Flow**: Require complete OAuth flow for new browser/device access

#### Token & State Management

- **Automatic Refresh**: Transparent token refresh before expiration across all devices
- **Session Duration**: 7-day maximum session length before requiring re-authentication
- **Cross-Device Independence**: Login/logout actions isolated to current device only
- **State Persistence**: Maintain user session state in browser localStorage/sessionStorage

### Sync System Requirements

#### Enhanced Cron Architecture

- **Advisory Lock System**: Implement Postgres advisory locks for collision prevention
  - Global lock (key: 1001) prevents concurrent cron window execution
  - Per-user locks (key: user.id) prevent manual/scheduled sync collisions
- **Sequential Processing**: Process users one-by-one during existing 6x daily sync windows
- **Democratic Scheduling**: Equal priority sync scheduling with fair resource allocation
- **Existing Schedule**: Maintain current 6x daily sync windows (2,6,10,14,18,22 UTC)

#### Sync State Management

- **Database Tracking**: Store sync state in user table columns:
  - `last_sync_at`: Timestamp of last successful sync
  - `next_run_at`: Scheduled time for next sync attempt
  - `sync_failure_count`: Counter for consecutive failures
- **Retry Logic**: Exponential backoff with jitter for failed syncs, capped at reasonable maximum
- **Error Handling**: Simple database-based error tracking with minimal user notification

#### Current Sync Types Support

- **Automated Sync**: Maintain existing 6x daily scheduled sync for all users
- **Manual Sync**: Preserve user-triggered "sync now" capability with per-user locking
- **Bi-directional Sync**: Continue supporting read/unread and starred state synchronization

### MVP Provider Support

- **Inoreader-Only**: Exclusive focus on Inoreader integration for initial release
- **Extensible Architecture**: Design database schema and auth flow to support future providers
- **Provider Foundation**: Establish patterns for future multi-provider implementation
- **Settings Integration**: Prepare existing settings page for future provider management

### Administrative Operations (Simplified)

#### User Access Control

- **Tailscale Integration**: Leverage existing Tailscale network permissions for access control
- **URL Sharing**: Simple app URL sharing (http://100.96.166.53:3000/reader) with Tailscale users
- **No Formal Invites**: Tailscale access serves as invitation system (no database tracking needed)

#### User Onboarding Process

1. Grant user access to Tailscale network (existing administrative process)
2. Share app URL with user via existing communication channels
3. User visits URL → automatic redirect to Inoreader OAuth flow
4. User completes OAuth → account auto-created in database
5. User immediately starts using app with their personal feed data

#### Troubleshooting Operations

- **User Status Queries**: Simple database queries to check user existence and sync status
- **System Health Monitoring**: Basic SQL queries for overall system health and user activity
- **PM2 Log Analysis**: Continue using existing PM2 log monitoring for application debugging

#### User Removal Options

- **Tailscale Removal**: Remove user from Tailscale network (loses app access entirely)
- **Self-Service Deletion**: User uses "Delete All My Data" button (removes data, keeps Tailscale access)
- **No Admin UI**: All user management via database queries and existing tools

### Future Architecture (Post-MVP)

#### Multi-Provider Support Foundation

- **Provider Abstraction**: Design sync interfaces to support multiple RSS services
- **User Provider Management**: Database schema for multiple provider connections per user
- **Provider Switching**: UI foundation for selecting active provider view
- **Background Sync**: Architecture for syncing multiple providers per user

#### Enhanced Settings Integration

- **Provider Management**: Settings page expansion for connecting/managing multiple providers
- **Provider-Specific Settings**: Support for service-specific configuration options
- **Connection Status**: Display sync status and health per connected provider
- **Provider Migration**: Support for switching primary providers or adding secondary services
