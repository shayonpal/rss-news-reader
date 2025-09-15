# Archived Test Files

This directory contains test files that have been archived due to structural changes in the codebase.

## RR-269 → RR-272 Migration

**Archived Files:**

- `rr-269-preferences-api.test.ts` - Original preferences API tests
- `rr-269-preferences-api-clean.test.ts` - Clean version of preferences API tests

**Reason for Archival:**
These tests were written for RR-269 which used a different API structure:

- Flat preference structure vs nested (ai/sync objects)
- String-based summaryWordCount vs numeric summaryLengthMin/Max
- Different API route structure (`/users/preferences` vs `/users/[id]/preferences`)
- No encryption support

**Migration Date:** 2025-09-07

**Replacement:**
New test files created for RR-272 implementation with:

- Deterministic PBKDF2 encryption
- User ID-based routing
- Updated schema structure
- API key security features

These archived tests remain as historical reference for the API evolution.
