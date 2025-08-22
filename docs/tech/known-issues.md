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

### Test Environment Browser API Compatibility

**Status:** 🟢 Resolved (August 11, 2025)  
**Severity:** High

#### Description

Node.js test environment lacks browser APIs like IndexedDB, causing failures in tests that depend on client-side storage functionality (Dexie database operations, offline queues).

#### Root Cause

- Node.js runtime doesn't provide IndexedDB API by default
- Test environment required polyfill for browser storage APIs
- Dexie library depends on IndexedDB for database operations

#### Solution (RR-186)

1. **IndexedDB Polyfill**: Added `fake-indexeddb` v6.1.0 dependency with automatic polyfill initialization
2. **Test Setup Enhancement**: Added `import 'fake-indexeddb/auto';` to `src/test-setup.ts`
3. **Environment Validation**: Created smoke test to verify polyfill availability
4. **Storage Mock Fix**: Properly configured localStorage/sessionStorage mocks with writable properties

#### Prevention

- **Smoke Test**: `src/__tests__/unit/test-setup.smoke.test.ts` validates test environment before execution
- **Mock Helpers**: Reusable mock system at `src/__tests__/helpers/supabase-mock.ts`
- **Documentation**: Comprehensive troubleshooting guide for common test environment issues

### sessionStorage Redefinition Error in jsdom Thread Pool

**Status:** 🟢 Resolved (August 19, 2025 via RR-222)  
**Severity:** Critical

#### Description

Test infrastructure completely failed with "Cannot redefine property: sessionStorage" error in jsdom environments with thread pool isolation, preventing all test discovery and execution.

#### Root Cause

- jsdom thread pool isolation creates non-configurable property descriptors for browser storage APIs
- Standard `Object.defineProperty` redefinition fails when `configurable: false`
- Test setup could not establish localStorage/sessionStorage mocks

#### Historical Impact

- **Test Discovery**: 0 files found (expected 1024+)
- **Test Contracts**: 0/21 passing (expected 21/21)
- **Development Workflow**: All testing disabled
- **CI/CD Pipeline**: Completely blocked

#### Solution (RR-222)

**Three-Tier Configurability Detection System** in `src/test-setup.ts:73-96`:

1. **Tier 1**: Standard `Object.defineProperty` for configurable properties
2. **Tier 2**: `Storage.prototype` fallback for non-configurable properties
3. **Tier 3**: Direct assignment with type casting as last resort

**Key Implementation:**

```typescript
const setupStorageMock = (storageName: "localStorage" | "sessionStorage") => {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(window, storageName);
    const isConfigurable = descriptor?.configurable !== false;

    if (!window[storageName] || isConfigurable) {
      // Tier 1: Clean defineProperty approach
      Object.defineProperty(window, storageName, {
        value: createStorage(),
        writable: true,
        configurable: true,
      });
    } else {
      // Tier 2: Prototype fallback for non-configurable properties
      console.warn(
        `[RR-222] ${storageName} not configurable, using prototype fallback`
      );
      const mockStorage = createStorage();
      Object.assign(Storage.prototype, mockStorage);
    }
  } catch (error) {
    // Tier 3: Direct assignment as last resort
    console.warn(
      `[RR-222] Failed to mock ${storageName}, using direct assignment:`,
      error
    );
    (window as any)[storageName] = createStorage();
  }
};
```

#### Results

- **Test Discovery**: Restored to 1024+ files ✅
- **Test Contracts**: 21/21 passing ✅
- **Error Rate**: 0% storage-related failures ✅
- **Cross-Environment**: Works in all jsdom configurations ✅

#### Reference Documentation

- **Implementation Guide**: [RR-222 Implementation](./rr-222-implementation.md)
- **Testing Strategy**: [Browser API Mock Infrastructure](./testing-strategy.md#browser-api-mock-infrastructure-rr-222)
- **Safe Test Practices**: [setupStorageMock Function Documentation](../testing/safe-test-practices.md#setupstoragemock-function-documentation-rr-222)

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

## Database Cleanup Issues (Resolved)

### URI Length Limits for Large Deletions (RR-150)

**Status:** 🟢 Resolved (August 6, 2025 at 10:53 PM)  
**Severity:** High

#### Description

When processing large numbers of articles for deletion (>1000 articles), Supabase PostgreSQL would return a "414 Request-URI Too Large" error due to URI length limitations when using the `.in()` filter with many IDs.

#### Root Cause

Single delete operations with large numbers of article IDs exceeded PostgreSQL's URI length limits:

- Single operation with 1000 IDs ≈ 20,000+ characters
- PostgreSQL/HTTP servers have URI length limits around 8,000-10,000 characters

#### Solution

Implemented chunked deletion architecture:

- Process articles in chunks of 200 articles maximum
- Configurable chunk size via `max_ids_per_delete_operation`
- Individual chunk failures don't stop entire process
- 100ms delay between chunks to prevent database overload

#### Results

- **URI Length Reduction**: ~80% reduction (from 20,000+ to ~4,000 characters per operation)
- **Success Rate**: 99.9% for large cleanup operations
- **Processing Time**: ~2-3 seconds for 1000 articles
- **Error Isolation**: Individual chunk failures don't cascade

## Future Considerations

### Incremental Sync Limitations

Currently, the app syncs the most recent 300 articles per sync operation. For users following many high-volume feeds, older articles might be missed if not synced frequently enough.

### No Multi-User Support

The application is designed for single-user deployment. Adding multi-user support would require significant architectural changes.
