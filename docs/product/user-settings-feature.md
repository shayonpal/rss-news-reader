# User Settings Feature - Product Requirements Document

## Overview

A comprehensive settings management interface allowing users to configure application behavior without modifying .env files.

## Goal

Enable all users to customize their RSS reader experience through an intuitive settings interface, eliminating the need for server access or technical knowledge to modify configuration files.

## Problem Statement

**Primary Problem: Configuration Accessibility**

- Non-technical users cannot customize their RSS reader experience without server access
- Modifying .env files requires technical knowledge and SSH/file system access
- Risk of breaking the application with invalid configuration values
- No validation or guidance on acceptable values for settings

## Target Users

**Primary Segment: Mobile/Tablet Users**

- Accessing RSS reader via PWA on iOS/Android devices
- No filesystem access to modify .env files
- Need responsive, touch-optimized settings interface
- Require quick access to common preferences
- Often using the app in mobile contexts (commuting, couch browsing)

### User Characteristics

- Device constraints: Touch-only interaction, smaller screens
- Usage patterns: Frequent but shorter sessions
- Technical level: Varies, but interface must assume non-technical
- Primary need: Quick customization without leaving the app

## Core Requirements

## Settings Access & Navigation

### Entry Point

- **Replace "Fetch Stats" button in sidebar menu** (retiring non-functional feature)
- Location: `src/components/feeds/simple-feed-sidebar.tsx` line 230
- Current: Button with BarChart3 icon → navigates to `/fetch-stats`
- New: **Bolt icon** (lucide-react) → navigates to `/settings` (Next.js adds `/reader` prefix)
- Icon choice: Bolt represents power/configuration in modern UI
- Maintains familiar navigation pattern in header button group
- No additional UI clutter
- Consistent with existing app architecture

### URL Structure

- Route: `/settings` in code (becomes `/reader/settings` at runtime via basePath)
- Follows existing pattern (code uses `/articles`, `/archive` etc.)

### Settings Page Organization

- **Single Page with Collapsible Sections**
- All settings accessible on one scrollable page
- Jump links/quick navigation at top for section access
- Collapsible sections to reduce visual clutter
- Mobile-optimized: minimal navigation, thumb-friendly controls
- Smooth scroll animations between sections

### Settings Categories

#### Section 1: AI Summarization

- **API Configuration**
  - Anthropic API key (password field with show/hide toggle)
  - Test connection button
  - Usage indicator (if API key is valid)
- **Model Selection** (dropdown)
  - Models loaded dynamically from `ai_models` database table
  - Grouped by provider (Anthropic, OpenAI, Perplexity in future)
  - Default from env variable `CLAUDE_SUMMARIZATION_MODEL`
  - Shows cost estimate per 100 summaries
- **Summary Preferences**
  - Length: Slider (50-500 words) or token count
  - Style: Dropdown (Brief, Detailed, Bullet Points)
  - Focus: Dropdown (Technical, Business, General)

#### Section 2: Sync Configuration

- **Sync Limits**
  - Max articles per sync: Number input (10-5000, default: 500 from env)
  - Article retention count: Number input (100-5000 articles, default: 1000)
  - Note: Starred articles always retained regardless of limit

#### Section 3: System

- **Reset Options**
  - Reset to defaults button (with inline confirmation pattern)
  - Resets to environment variable defaults
  - Clears user-configured API keys

### Technical Considerations

#### Data Storage Strategy

- **Location**: Existing `users.preferences` JSONB column in Supabase
- **User**: Hardcoded to existing user (id: `7ecd1c0b-7a04-487d-9d3c-7575f34ae27f`)
- **Access Pattern**: Single user via `inoreader_id = 'shayon'`
- **No Authentication Required**: App is single-user, protected by Tailscale VPN

#### API Key Encryption

- **Method**: Node.js crypto module with AES-256-GCM encryption
- **Crypto Version**: v24.7.0
- **Key Storage**: Server-side environment variable `USER_PREFS_ENCRYPTION_KEY` (32-byte key)
- **Implementation**:
  - Random 12-byte nonce per encryption
  - Store encrypted data with IV and auth tag in JSONB
  - Decrypt only in server-side API routes
  - Never expose to client
  - Add to `.env`: `USER_PREFS_ENCRYPTION_KEY=<generate-32-byte-base64-string>`

#### Preferences Structure (JSONB)

```json
{
  "ai_summarization": {
    "anthropic_api_key": {
      "encrypted": true,
      "algorithm": "aes-256-gcm",
      "ciphertext": "base64_encrypted_data",
      "iv": "base64_initialization_vector",
      "authTag": "base64_auth_tag"
    },
    "model": "claude-sonnet-4-20250514", // From CLAUDE_SUMMARIZATION_MODEL env
    "summary_length": 200,
    "summary_style": "brief",
    "summary_focus": "general"
  },
  "sync_configuration": {
    "max_articles_per_sync": 50,
    "article_retention_count": 1000
  }
}
```

#### API Endpoints

- `GET /api/users/[id]/preferences` - Fetch current settings (secrets masked)
- `PUT /api/users/[id]/preferences` - Update settings (partial merge)
- `POST /api/users/[id]/preferences/test-anthropic` - Validate API key
- `DELETE /api/users/[id]/preferences` - Reset to defaults

**OpenAPI Documentation Requirements:**

- All endpoints MUST be documented with Zod schemas in `src/lib/openapi/registry.ts`
- Include request/response schemas with full type definitions
- Add interactive "Try it out" functionality in Swagger UI
- Follow existing pattern from health endpoints

### UI/UX Design

#### Settings Form Structure

##### Section 1: AI Summarization (Collapsible, Expanded by Default)

**1.1 API Configuration**

- **Field**: Anthropic API Key
- **Component**: Password input with show/hide toggle
- **Validation**: Required, min 40 chars
- **Helper Text**: "Your API key is encrypted and never exposed"
- **Action Button**: "Test Connection" (inline, shows success/error state)
- **Test Process**: Makes actual API call to verify key validity
- **Success State**: "Connection successful" with green checkmark
- **Error State**: Toast notification with specific error message

**1.2 Model Selection**

- **Field**: Summarization Model
- **Component**: Select dropdown with provider grouping
- **Options**: Loaded from `ai_models` database table
  - Only shows active models (`is_active = true`)
  - Default from `CLAUDE_SUMMARIZATION_MODEL` env variable
  - Groups by provider (Anthropic now, OpenAI/Perplexity future)
- **Helper Text**: Shows cost estimate based on `input_cost_per_1k` and `output_cost_per_1k`

**1.3 Summary Style**

- **Field**: Summary Length
- **Component**: Slider with value display
- **Range**: 50-500 words (increments of 50)
- **Preset marks**: 50, 100, 150, 200, 300, 400, 500
- **Default**: 200 words
- **Display**: Shows word count above slider thumb

**1.4 Summary Format**

- **Field**: Output Format
- **Component**: Radio group
- **Options**:
  - Paragraph (flowing text)
  - Bullet Points (key takeaways)
  - Structured (sections with headers)
- **Default**: Paragraph

**1.5 Summary Focus**

- **Field**: Content Focus
- **Component**: Select dropdown
- **Options**:
  - General (balanced overview)
  - Technical (code, implementation details)
  - Business (market impact, strategy)
  - Academic (research, citations)
  - News (key facts, timeline)
  - Personal (actionable insights)
- **Default**: General
- **Helper Text**: "Adjusts the summary perspective and terminology"

##### Section 2: Sync Configuration (Collapsible, Collapsed by Default)

**2.1 Sync Limits**

- **Field**: Max Articles Per Sync
- **Component**: Number input with stepper
- **Range**: 10-5000
- **Default**: From `MAX_ARTICLES_PER_SYNC` env variable (currently 500)
- **Helper Text**: "Higher values use more API calls but sync faster"

**2.2 Article Retention**

- **Field**: Maximum Articles to Keep
- **Component**: Number input with stepper
- **Range**: 100-5000 articles
- **Default**: 1000 (current hardcoded limit)
- **Helper Text**: "Starred articles are always retained regardless of this limit"
- **Note**: Currently using article count, not days (keeps most recent N articles)

**2.3 Article Statistics** (Read-only info)

- **Component**: Info box showing current state
- **Shows**:
  - Current article count
  - Starred articles count (always retained)
- **Note**: Storage size estimation removed from scope

##### Section 3: Advanced (Collapsible, Collapsed by Default)

**3.1 Data Management**

- **Reset to Defaults**: Button with inline confirmation (like Mark All Read pattern)
  - Initial state: "Reset to Defaults" button
  - Confirmation state: Button changes to "Confirm Reset?" (destructive color)
  - Auto-cancels after 3 seconds if not confirmed
  - Uses existing `waitingConfirmation` pattern from article-header.tsx

#### Form Behavior

**Save Mechanism**:

- Manual save with "Save Changes" button
- Button states:
  - Disabled: No changes to save (gray)
  - Enabled: Changes detected (primary color)
  - Loading: Saving in progress (spinner)
  - Success: Show success toast, keep button disabled until next change
- Error state: Toast notification with error message (via Sonner)

**Validation**:

- Server-side only: Single source of truth for validation
- API key validation: Only on "Test Connection" click (actual API call to verify)
- **Default values**: Use env variables as defaults when user preferences not set
  - Model: `CLAUDE_SUMMARIZATION_MODEL`
  - Max sync: `MAX_ARTICLES_PER_SYNC`
  - API key: Falls back to `ANTHROPIC_API_KEY` if user key not configured
- Settings changes: Apply to new operations only (current operations continue with old settings)

**Loading States**:

- Initial load: Skeleton UI matching form structure (show while fetching preferences)
- Save in progress: Subtle spinner next to "Saved" indicator
- Test connection: Button transforms to loading state
- Fields populate with saved values or defaults after skeleton

**Responsive Design**:

- **Mobile (default)**: Full-width layout, stacked fields
- **sm (640px+)**: Same as mobile with slightly more padding
- **md (768px+)**: Two-column grid for some fields
- **lg (1024px+)**: Max-width container (1024px), centered
- **xl (1280px+)**: Same as lg with more breathing room
- **Key breakpoints used in codebase**: sm, md, lg (rarely xl)
- Touch-friendly controls (min 44px tap targets on all sizes)
- Collapsible sections to reduce scroll on all viewports

#### Visual Design (Following Existing Liquid Glass System)

**Use Existing Components & Classes**:

- **Container**: `glass-card` for form sections
- **Inputs**: `glass-input` for all form fields (already has proper styling)
- **Buttons**: `glass-button` for Save, `liquid-glass-mark-all-read` pattern for Test Connection
- **Sections**: `CollapsibleFilterSection` component from sidebar
- **Select/Dropdowns**: `glass-segmented-control` or existing select patterns
- **Colors**: Maintain violet scheme (`--primary: 263 70% 50%`)
- **CSS Variables**: Use existing `--glass-surface`, `--glass-border-style`, `--glass-blur-effect`
- **No new CSS**: All glass effects already implemented in `/src/styles/liquid-glass-button.css` and `globals.css`

**Apple HIG Compliance**:

- 44pt minimum touch targets
- SF Symbols via Lucide React icons
- System colors via CSS variables
- 150-200ms micro-interactions
- 250-350ms state changes

**Form Components**:

- **Input fields**: Glass background with `backdrop-blur-sm border border-border`
- **Sliders**: Use existing ProgressBar component patterns
- **Select dropdowns**: Native selects with glass styling
- **Radio groups**: List with checkmarks (iOS pattern)
- **Number steppers**: Plus/minus buttons with 44pt tap areas
- **Save button**: Primary button with loading states from existing patterns

**Responsive Layout**:

- Mobile-first with existing breakpoints (sm:640px, md:768px, lg:1024px)
- Container max-width on lg: `max-w-4xl mx-auto`
- Section padding: `p-4 md:p-6`
- Form grid: `grid grid-cols-1 md:grid-cols-2 gap-4`

## Technical Architecture

### Current Storage Implementation

- **IndexedDB (Dexie.js)**: Used for client-side article storage
  - Database: "ShayonNewsDB"
  - Tables: articles, feeds, folders, summaries, apiUsage, userPreferences
  - Storage API not directly available for size calculation
- **Supabase**: Server-side preferences in `users.preferences` JSONB column
- **Hybrid approach**: IndexedDB for quick access, Supabase for persistence

### Data Flow

1. Load preferences from Supabase on app start
2. Cache in memory (Zustand store)
3. Update both Supabase and local state on save
4. No localStorage usage (using IndexedDB instead)

## Implementation Plan (Vertical Slices)

### Phase 1: Foundation

- Create `/settings` route and page structure
- Set up API endpoints with OpenAPI documentation
- Create preferences Zustand store
- Replace "Fetch Stats" button with Settings (Bolt icon)
- Create `ai_models` database migration and seed data

### Phase 2: AI Summarization Section

- API key input with encryption
- Model selection dropdown (from ai_models table)
- Summary preferences (length, format, focus)
- Test connection functionality
- Manual save with change detection

### Phase 3: Sync Configuration Section

- Max articles per sync input (10-5000)
- Article retention count input (100-5000)
- Article statistics display (current count, starred count)
- Integration with existing sync logic

### Phase 4: Advanced & Polish

- Reset to defaults with confirmation
- Form validation and error states
- Loading states and transitions
- Responsive design testing

### Phase 5: Integration & Testing

- Connect settings to existing summarization flow
- Update sync service to use new limits
- End-to-end testing on mobile/tablet
- Performance optimization

## Success Metrics

- Settings load in < 500ms
- Save operation completes in < 1s
- All inputs meet 44pt touch target minimum
- Zero inline styles (100% token usage)
- Works on all viewport sizes (320px - 2560px)

## Key Implementation Notes

1. **Reuse Existing Components**:
   - CollapsibleFilterSection for sections
   - Glass morphism classes from articles
   - Confirmation pattern from Mark All Read
   - Toast notifications via Sonner

2. **Follow Existing Patterns**:
   - API routes in `/api/users/[id]/preferences`
   - OpenAPI schemas in registry.ts
   - Zustand store for state management
   - CSS tokens for all styling

3. **Testing Requirements**:
   - Unit tests for API endpoints
   - Component tests for form validation
   - E2E tests for complete user flow
   - Accessibility testing with VoiceOver

## Final Decisions Summary

### Architecture Decisions

- **Storage**: Supabase `users.preferences` JSONB column (no auth needed, single user)
- **State Management**: Zustand store with Supabase persistence
- **UI Framework**: Existing liquid glass design system with Apple HIG compliance
- **Save Pattern**: Manual save with change detection
- **Confirmation Pattern**: Inline confirmation like Mark All Read (not modal)

### Technical Constraints

- **IndexedDB**: Currently used for article storage (Dexie.js)
- **Article Retention**: By count (100-5000), not days
- **Starred Articles**: Always retained regardless of limits
- **Responsive Design**: Mobile-first with sm, md, lg breakpoints
- **Component Reuse**: Maximum reuse of existing components and patterns

### Implementation Timeline

- **Single Linear Cycle**: Complete MVP implementation
- **Vertical Slicing**: Complete sections end-to-end
- **No Export/Import**: Not supported
- **All Features at Once**: This spec is the complete MVP

---

## Implementation Architecture

### Routing & Navigation

- **Route**: `src/app/settings/page.tsx` - navigate with `router.push('/settings')` (Next.js basePath auto-adds `/reader`)
- **Entry Point**: Replace sidebar "Fetch Stats" button with Bolt icon that routes to `/settings`
- **Pattern**: Follow existing route structure, no hardcoded `/reader` prefix in code

### Data Storage Architecture

- **Canonical Store**: Supabase `users.preferences` JSONB column
- **Cache Layer**: Dexie.js (IndexedDB) for fast UI rendering
- **Data Flow**: Supabase → Zustand store → Dexie cache
- **Save Pattern**: Write to Supabase first, then update local state
- **Masked Secrets**: GET returns `{ encrypted: true, has_key: boolean }` for API keys

### Encryption Strategy

- **Reuse Existing**: Extract AES-256-GCM from `server/lib/token-manager.js`
- **New Key**: Add `USER_PREFS_ENCRYPTION_KEY` (base64, 32 bytes) to `.env`
- **Storage Format**: `{ algorithm, ciphertext, iv, authTag, createdAt }`
- **Security**: Server-only encrypt/decrypt, never expose keys to client

### API Implementation

- **Base Pattern**: Copy `/api/users/[id]/timezone` endpoint structure
- **Endpoints**:
  - `GET /api/users/[id]/preferences` - Returns preferences with masked secrets
  - `PUT /api/users/[id]/preferences` - Partial updates with merge strategy
  - `POST /api/users/[id]/preferences/test-anthropic` - Validate API key
- **OpenAPI**: Document under "Users" tag with full Zod schemas

### AI Model Management

- **Model Database**: `ai_models` table stores all allowed models
  - Supports multiple providers (Anthropic, OpenAI, Perplexity)
  - Tracks costs, capabilities, and deprecation dates
  - One default model per provider
- **Per-Request Client**: Create new AI client for each request using decrypted user key
- **Fallback**: Use server environment key if user key not configured
- **Model Validation**: Only models with `is_active = true` allowed
- **Preferences**: Read from `users.preferences`, fallback to env defaults

### Database Schema: ai_models Table

```sql
CREATE TABLE ai_models (
  id TEXT PRIMARY KEY,  -- e.g., 'claude-3-7-sonnet-latest'
  provider TEXT NOT NULL,  -- 'anthropic', 'openai', 'perplexity'
  display_name TEXT NOT NULL,  -- 'Claude 3.7 Sonnet'
  display_category TEXT,  -- 'Balanced', 'Fast & Cheap', 'Most Capable'
  model_family TEXT,  -- 'claude', 'gpt', 'sonar'
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,  -- Only one per provider

  -- Cost tracking
  input_cost_per_1k DECIMAL(10,6),  -- $0.003 per 1K tokens
  output_cost_per_1k DECIMAL(10,6),  -- $0.015 per 1K tokens

  -- Capabilities
  max_input_tokens INTEGER,  -- 200000 for Claude
  max_output_tokens INTEGER,  -- 4096 typical
  supports_vision BOOLEAN DEFAULT false,
  supports_functions BOOLEAN DEFAULT false,

  -- Provider-specific config
  provider_config JSONB,  -- Store provider-specific settings

  -- Metadata
  release_date DATE,
  deprecation_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  UNIQUE(provider, is_default) WHERE is_default = true
);

CREATE INDEX idx_ai_models_provider_active ON ai_models(provider, is_active);
CREATE INDEX idx_ai_models_default ON ai_models(is_default) WHERE is_default = true;
```

### Configuration Management

- **User Preferences**: Personal settings in `users.preferences` (AI model, summary style)
- **System Config**: Global settings in `system_config` table (batch sizes, cleanup intervals)
- **Article Retention**: Count-based (100-5000 articles), stored in user preferences

### UI Components

- **Sections**: Reuse `CollapsibleFilterSection` component
- **Inputs**: Use existing `glass-input` classes
- **Buttons**: Use existing `glass-button` patterns
- **Confirmation**: Follow inline pattern from Mark All Read
- **Save Mechanism**: Manual save with change detection

### Implementation Phases

#### Phase 1: Foundation

- Create `/settings` route and basic page structure
- Copy timezone endpoint pattern for preferences API
- Set up Zustand store for preferences state
- Replace "Fetch Stats" button with Settings (Bolt icon)
- Add OpenAPI documentation schemas
- Create and seed `ai_models` database table

#### Phase 2: Core Preferences

- Extract encryption utilities from TokenManager
- Implement preferences GET/PUT endpoints with encryption
- Build AI summarization settings UI
- Add sync configuration controls
- Wire up save/load functionality

#### Phase 3: Integration

- Update summarization route to use user preferences
- Connect sync service to user-defined limits
- Add API key validation endpoint
- Implement test connection functionality

#### Phase 4: Polish

- Add loading states and skeletons
- Implement reset to defaults
- Add success/error toast notifications
- Mobile responsiveness testing

### Testing Strategy

- **Unit Tests**: Encryption utilities, preference validators, API handlers
- **Integration Tests**: Verify summarization uses user preferences
- **E2E Tests**: Complete user flow on mobile viewports
- **Validation**: Test with actual Anthropic API calls

### Performance Targets

- Settings load: < 500ms
- Save operation: < 1s
- API key validation: < 2s
- Touch targets: 44pt minimum
- Viewport support: 320px - 2560px
