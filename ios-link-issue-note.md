## Problem Statement

We're experiencing a frustrating issue in our RSS News Reader PWA where users on iOS devices (iPhone/iPad) must tap links twice to open them. This happens both in Safari browser and when the app is installed as a PWA on the home screen.

### Current Behavior
- First tap: Link appears to register the tap (visual feedback varies) but doesn't open
- Second tap: Link opens in a new tab as expected
- Quick double-tap: Works immediately, suggesting iOS is waiting for something on the first tap

### Expected Behavior
- Single tap should open the link in a new tab immediately
- Similar to how links work on desktop browsers or other mobile browsers

## Technical Context

- **App Type**: Next.js PWA (Progressive Web App)
- **Content**: Article content with embedded links from RSS feeds
- **Link Behavior**: All links should open in new tabs to preserve reading position
- **Affected Devices**: iOS Safari (all versions tested), both browser and PWA mode
- **Not Affected**: Desktop browsers, Android devices

## What We've Tried

### 1. CSS Hover State Removal
**Theory**: iOS Safari treats first tap as hover activation, second tap as click
- Removed all `:hover` styles from links
- Used `@media (hover: hover)` to apply hover only on desktop
- Added iOS-specific class to completely disable hover states
- **Result**: No improvement - links still require double tap

### 2. Inline Styles Test
**Observation**: Link underline disappeared on first tap, suggesting style change
- Applied inline styles to prevent any visual changes on tap
- Forced underline to remain constant
- Prevented all style modifications via JavaScript
- **Result**: Underline stayed visible, but double-tap still required

### 3. Target Attribute Modification
**Theory**: `target="_blank"` might trigger iOS security/gesture requirements
- Removed `target="_blank"` attribute entirely
- Implemented JavaScript click handler with `window.open()`
- **Result**: No improvement - still requires double tap

### 4. Touch Event Handling
**Theory**: iOS might need touch events instead of click events
- Implemented custom touch event handlers similar to our working button components
- Used `touchend` events to trigger link opening
- **Result**: Overly complex and didn't solve the core issue

### 5. Various CSS Properties
- Set `-webkit-tap-highlight-color: transparent`
- Added `touch-action: manipulation`
- Adjusted `-webkit-touch-callout` settings
- Modified `user-select` properties
- **Result**: No significant improvement

## Interesting Observations

1. **Other PWAs Work Fine**: The Verge's PWA (theverge.com) doesn't have this issue - links open with single tap
2. **Quick Double-Tap Works**: Rapid double-tapping opens links immediately, suggesting iOS is intentionally waiting
3. **Not PWA-Specific**: Issue occurs in regular Safari browser too, not just PWA mode
4. **Button Components Work**: Our custom iOS button components work perfectly with single tap

## Current Implementation

- Links are processed after content is loaded
- Security attributes added: `rel="noopener noreferrer"`
- Content is sanitized with DOMPurify before rendering
- Using Tailwind CSS with prose classes for article styling

## Questions for UX Expert

1. Have you encountered this iOS double-tap issue before? What was the root cause?
2. Are there known iOS Safari behaviors or restrictions we're missing?
3. What approach do other content-heavy apps (news readers, blogs) use for external links?
4. Should we consider alternative UX patterns (long-press menus, explicit "open" buttons)?
5. Are there iOS-specific meta tags or PWA configurations that affect link behavior?

## Additional Context

- This is a single-user app accessed via private network (Tailscale)
- No complex authentication or security layers
- Content comes from RSS feeds and may contain various HTML structures
- User primarily accesses on iPad, but issue exists on iPhone too

We're looking for either a technical solution or alternative UX patterns that provide a smooth single-tap experience for opening external links on iOS devices.

Feel free to ask for any additional technical details, code samples, or testing scenarios that might help diagnose this issue.