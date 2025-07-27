# Known Issues - RSS News Reader

**Last Updated:** Saturday, July 26, 2025 at 1:36 AM

This document tracks known issues and limitations in the RSS News Reader application that require further investigation or may not have straightforward solutions.

## iOS Safari / PWA Issues

### Double-Tap Required for Links (TODO-050a)

**Status:** 🔴 Unresolved  
**Severity:** Medium  
**Affected Versions:** All versions on iOS Safari and PWA  
**First Reported:** July 25, 2025

#### Description
Users on iOS Safari (including PWA mode) must tap links twice before they open in new tabs. The first tap appears to "focus" the link, and only the second tap actually opens it. This issue does not occur on desktop browsers or Android devices.

#### Technical Details
- Links are properly configured with `target="_blank"` and `rel="noopener noreferrer"`
- The link-processor utility correctly adds these attributes to all external links
- Issue persists across RSS content, full fetched content, and AI summaries
- Problem appears to be specific to iOS touch event handling

#### Attempted Solutions (Failed)
1. **CSS Hover State Removal**: Removed all `:hover` pseudo-classes for touch devices
2. **Inline Styles**: Added inline styles to override any hover behavior
3. **Touch-Action Manipulation**: Tried various `touch-action` CSS values
4. **JavaScript Event Handlers**: Added custom touch event handlers
5. **iOS Button Component**: Created iOS-specific button component (worked for buttons but not links in content)

#### Potential Root Causes
- iOS tap delay for detecting double-tap-to-zoom gestures
- Conflict between React's synthetic events and iOS Safari's native behavior
- Parent container event handling interfering with link taps
- iOS-specific focus management requirements

#### Workaround
Currently, iOS users must tap links twice. The first tap focuses the link, the second tap opens it in a new tab.

#### Next Steps
- Research iOS-specific link handling patterns in other React PWAs
- Consider implementing custom onClick handlers for all links
- Investigate if FastClick or similar libraries could help
- Test with different React event handling approaches

## Performance Issues

### Article List Render Performance on Large Feeds
**Status:** 🟡 Mitigated  
**Severity:** Low  

When viewing feeds with 500+ unread articles, initial render can take 1-2 seconds. Virtual scrolling was considered but not implemented due to complexity with variable height article previews.

## Sync Issues

### Rate Limit Constraints
**Status:** 🟢 Managed  
**Severity:** Low  

The Inoreader API limit of 100 calls per day constrains how often users can manually sync. Automatic syncs are limited to twice daily (2 AM and 2 PM) to preserve API quota.

## Browser Compatibility

### PWA Installation Over HTTP
**Status:** 🟡 Works with Limitations  
**Severity:** Low  

The PWA can be installed over HTTP (required for Tailscale network) but some features like push notifications are unavailable without HTTPS.

## Production Deployment Issues (Resolved)

### Manual Sync Failure - Missing Build Manifests
**Status:** 🟢 Resolved (July 26, 2025 at 10:56 PM)  
**Severity:** Critical  

#### Description
Manual sync button returned 500 Internal Server Error with "Cannot find module '.next/prerender-manifest.json'" error. Server logs showed missing manifest files and corrupted vendor chunks.

#### Root Cause
- Production build was corrupted/incomplete
- Critical manifest files (prerender-manifest.json, react-loadable-manifest.json) were missing
- Vendor chunks containing Supabase dependencies were missing or corrupted
- Build process completed without errors but produced invalid output

#### Solution
1. Stop PM2 services
2. Clean build directory: `rm -rf .next`
3. Rebuild application: `npm run build`
4. Verify manifests exist in `.next/` directory
5. Restart PM2 services

#### Prevention
Enhanced build validation system now checks for:
- Presence of critical manifest files
- Integrity of vendor chunks
- Supabase dependency availability
- Validation runs as PM2 pre-start hook to prevent corrupted builds from starting

## Production Deployment Issues (Resolved)

### Next.js App Router vs Pages Router Confusion
**Status:** 🟢 Resolved (July 26, 2025)  
**Severity:** High  

#### Description
Production server returned 500 Internal Server Error on all routes when an empty `src/pages/` directory existed. This confused Next.js about whether to use App Router or Pages Router.

#### Root Cause
- Project uses App Router (routes in `src/app/`)
- Empty `src/pages/` directory made Next.js uncertain about routing mode
- Production builds failed to resolve routes correctly

#### Solution
1. Remove empty `src/pages/` directory
2. Clear `.next` cache
3. Rebuild and restart production

### PM2 Cluster Mode Incompatibility
**Status:** 🟢 Resolved (July 26, 2025)  
**Severity:** High  

#### Description
PM2 service was restarting continuously (105+ times) when configured in cluster mode with Next.js production build.

#### Root Cause
- Next.js production builds are incompatible with PM2 cluster mode
- Cluster mode attempts to fork multiple processes but Next.js expects single process
- Results in immediate crashes and restart loops

#### Solution
Changed `ecosystem.config.js` from `exec_mode: 'cluster'` to `exec_mode: 'fork'`

## Future Considerations

### Incremental Sync Limitations
Currently, the app syncs the most recent 300 articles per sync operation. For users following many high-volume feeds, older articles might be missed if not synced frequently enough.

### No Multi-User Support
The application is designed for single-user deployment. Adding multi-user support would require significant architectural changes.