# Multi-User Authentication & Architecture Conversion - PRD

## Product Overview

Transform the RSS News Reader from a single-user application into a scalable multi-user platform that enables multiple users to authenticate with their Inoreader accounts, manage their personal RSS feeds, and sync data independently while maintaining the current user experience quality.

## Product Discovery Decisions

Based on detailed product discovery Q&A sessions, the following specific decisions guide the implementation:

### User Access & Management

- **User Acquisition**: Admin-controlled invite-only system (only you send invites)
- **Access Control**: URL-based access via Tailscale network (network access IS the invitation)
- **User Lifecycle**: Minimal - Tailscale → URL → OAuth → auto-created account → app usage
- **User Tiers**: Single tier with user-customizable settings from existing `/reader/settings` page
- **Admin Controls**: No admin UI for MVP - use PM2 logs + database queries for user management

### Data Privacy & Isolation

- **Privacy Model**: Complete isolation - users see only their own feeds, articles, reading history
- **Data Ownership**: Selective isolation with admin visibility
  - **User-scoped**: feeds, articles, tags, folders, article_tags, user preferences, reading history, user-specific sync metadata
  - **Admin-visible**: Anonymized aggregated metrics, error logs (user IDs removed/hashed), system performance data, OAuth audit trail
  - **Global**: system_config, ai_models, application-level settings
- **Data Deletion Rights**: Users get "Delete All My Data" button in settings with confirmation (no export option for MVP)
- **Re-registration**: Same user can re-register after deletion (fresh start)

### Authentication & Sessions

- **Authentication Flow**: Auto-create app users on first Inoreader OAuth completion
- **Session Management**: Multi-device sessions with auto-refresh (Supabase Auth default: 1-hour access tokens, 7-day refresh tokens)
- **Multi-device Support**: Users stay logged in across multiple devices simultaneously
- **Logout Behavior**: Affects only current device, other sessions remain active
- **Data Migration**: Fresh start for all users including existing 'shayon' user

### Multi-Provider Strategy (Future)

- **MVP Scope**: Inoreader-only, but designed for future multi-provider support
- **Future Architecture**: One active provider per user + provider switching UI
- **Provider Management**: Background sync all connected providers + active provider display (future feature)
- **Provider UI**: Will be managed via settings page (future feature)

### Sync Strategy

- **Approach**: Enhanced cron with Postgres advisory locks (avoiding Redis/BullMQ over-engineering)
- **Scheduling**: Equal round-robin sync for all users (democratic approach)
- **Processing**: Sequential user processing during existing 6x daily sync windows
- **Error Handling**: Minimal - trust the enhanced cron system with basic retry logic

## Target Users & Use Cases

### Primary Users

- Individual RSS enthusiasts within your Tailscale network
- Trusted colleagues and friends with invite access
- Content creators managing personal RSS sources
- Knowledge workers tracking industry feeds

### Core Use Cases

1. **Invite-Only Access**: Users access via shared Tailscale URL with seamless registration
2. **Personal Feed Management**: Users authenticate with their Inoreader accounts to access personal subscriptions
3. **Independent Sync**: Each user's data syncs independently with equal priority
4. **Secure Isolation**: Users can only access their own feeds, articles, and reading history
5. **Settings Customization**: Personal preferences managed via existing `/reader/settings` page
6. **Multi-Device Usage**: Users stay logged in across multiple devices/browsers simultaneously
7. **Data Control**: Users can delete all their data and re-register for fresh start

## Success Metrics

### User Adoption

- **Target**: 5-10 trusted users within first month (invite-only scope)
- **Onboarding**: 100% successful OAuth completion rate
- **Retention**: Users actively sync within 7 days of registration

### Technical Performance

- **Sync Reliability**: 99.5% successful sync operations per user
- **Response Time**: <2s for feed loads under multi-user load
- **Session Management**: 99% successful auto-refresh operations
- **Equal Access**: Balanced sync times across all users (democratic approach)

### Security & Privacy

- **Data Isolation**: Zero cross-user data leakage incidents
- **Admin Metrics**: Properly anonymized, no user identification possible
- **Data Control**: Successful data deletion with metric preservation

## User Experience Goals

### Seamless Onboarding

- One-click Inoreader OAuth authentication after receiving Tailscale access
- Auto-account creation with no manual setup required
- Immediate access to personal RSS feeds from Inoreader

### Familiar Interface

- Maintain current UI/UX while adding user context
- Preserve all existing features and settings capabilities
- No learning curve for existing functionality

### Personal Control

- Full access to existing settings page for customization
- Clear "Delete All My Data" option with immediate effect
- Multi-device freedom without session interference

### Fair Resource Sharing

- Equal sync priority for all users (no premium tiers)
- Democratic resource allocation during sync windows
- Transparent background sync operations

### Clean Slate Experience

- Fresh start for all users including existing users
- No legacy data migration complexity
- Consistent multi-user experience from day one
