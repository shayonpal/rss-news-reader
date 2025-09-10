# Sync Failure - Encryption Key Format Mismatch Bug

**Date**: 2025-09-09  
**Severity**: Critical  
**Status**: Open  
**Affected Versions**: After RR-271/272/273 implementation  

## Bug Summary

The sync functionality is completely broken due to an encryption key format mismatch between the original TokenManager and the new encryption utilities introduced in RR-271/272.

## Root Cause Analysis

### Format Inconsistency

1. **TokenManager** (`server/lib/token-manager.js`, lines 12-14):
   ```javascript
   this.encryptionKey = Buffer.from(
     process.env.TOKEN_ENCRYPTION_KEY,
     "base64"  // <-- Expects base64 encoding
   );
   ```

2. **New Encryption Utils** (`src/lib/utils/encryption.ts`):
   ```javascript
   return Buffer.from(keyHex, "hex");  // <-- Expects hex encoding
   ```

3. **Environment Configuration** (`.env`):
   - Contains a 64-character string (confirmed via `wc -c`)
   - This confirms it's stored as hex format (256 bits = 64 hex characters)

### Why It Fails

When `TokenManager` attempts to decode the hex string as base64, it produces an invalid key length for AES-256-GCM encryption, causing immediate failure when trying to decrypt OAuth tokens from `~/.rss-reader/tokens.json`.

## Impact

- **Complete sync failure** - No articles can be synced from Inoreader
- **API endpoint failures**:
  - `/api/sync` returns "invalid key length" error
  - `/api/health/cron` shows degraded status
- **User experience**: App cannot fetch new articles or update existing ones

## Error Details

- **Example Sync ID**: `a05cba1f-2cb0-491d-a7b3-2ba9b026c64d`
- **Error Message**: "invalid key length"
- **Failure Point**: Token decryption in `TokenManager.loadTokens()`

## Reproduction Steps

1. Trigger a sync via `/api/sync`
2. Observe the returned sync ID
3. Check status via `/api/sync/status/{syncId}`
4. Status shows "failed" with "invalid key length" error

## Fix Required

### Immediate Fix

Update `server/lib/token-manager.js` line 12-14:

```javascript
// Change from:
this.encryptionKey = Buffer.from(
  process.env.TOKEN_ENCRYPTION_KEY,
  "base64"
);

// To:
this.encryptionKey = Buffer.from(
  process.env.TOKEN_ENCRYPTION_KEY,
  "hex"
);
```

### Additional Considerations

1. **RR-274 Issue**: The uncommitted changes add `getUserPreferences()` call in sync route which uses `supabase.auth.getUser()`. This may cause additional issues in server-side context where no authenticated session exists.

2. **Migration Path**: After fixing, may need to:
   - Re-encrypt existing OAuth tokens if they were encrypted with the wrong key format
   - Or re-run OAuth setup to get fresh tokens

## Timeline

- **RR-271**: Introduced hex-based encryption for API keys
- **RR-272**: Expanded encryption utilities, reinforced hex format
- **RR-273**: AI settings implementation (no direct impact)
- **RR-274**: Added preferences integration (uncommitted, revealed the issue)

## Lessons Learned

1. **Inconsistent Standards**: Different parts of the codebase used different encoding formats for the same environment variable
2. **Testing Gap**: Integration tests didn't catch the sync failure after encryption changes
3. **Documentation**: Need clearer documentation about encryption key format requirements

## Recommendations

1. **Immediate**: Apply the fix to `TokenManager` to use hex encoding
2. **Short-term**: Add integration tests for sync functionality
3. **Long-term**: Standardize encryption approach across entire codebase
4. **Documentation**: Document the encryption key format in `.env.example` and setup docs

## Related Issues

- RR-271: Implement Anthropic API key encryption
- RR-272: Complete user preferences API with encryption
- RR-273: AI settings backend connectivity
- RR-274: User preferences integration (in progress)

## Resolution

_To be updated once fixed_

---

**Discovered by**: Investigation on 2025-09-09  
**Documented by**: System audit  
**Commit with bug**: `a64d64f` (WIP backup)