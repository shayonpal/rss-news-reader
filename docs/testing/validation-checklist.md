# RR-193 Validation Checklist: Mutex Accordion & Scrollbar Elimination

## 🎯 Testing Strategy Overview

**Mode:** Advisory (Manual Testing Strategy + Browser Validation)
**Issue:** RR-193 - Eliminate nested scrollbars with mutex accordion
**Status:** In Review - Ready for comprehensive validation
**Test Results:** Unit tests PASSED (7/7), need manual validation for visual/UX aspects

---

## ✅ Pre-Testing Health Checks

### 1. Environment Validation

```bash
# Check app is running
curl -s http://100.96.166.53:3000/reader/api/health/app | jq '.status'
# Expected: "healthy" or "degraded" (but running)

# Check PM2 services
pm2 status | grep -E "rss-reader|sync"
# Expected: All services "online"

# Check TypeScript compilation
npm run type-check
# Expected: Clean exit (0)
```

### 2. Build Fresh Version

```bash
# Clean build for testing
npm run build
npm run dev
# Open browser to: http://100.96.166.53:3000/reader
```

---

## 📋 Manual Testing Checklist

### A. Scrollbar Elimination Testing

#### Desktop Browser Validation (Chrome/Safari/Firefox)

1. **Open DevTools** → Elements tab
2. **Navigate to sidebar container**
   - Inspect: `<aside>` element with class containing "sidebar"
   - Check computed styles: Should have `overflow-y: auto` on main container ONLY

3. **Verify NO nested scrollbars:**

   ```css
   /* These should NOT exist in child elements: */
   .max-h-[30vh] {
     /* Should be removed */
   }
   .max-h-[60vh] {
     /* Should be removed */
   }
   .overflow-y-auto {
     /* Only on main container */
   }
   ```

4. **Visual Inspection:**
   - [ ] Only ONE scrollbar visible (right edge of sidebar)
   - [ ] Scrollbar appears ONLY when content overflows
   - [ ] Smooth scrolling throughout entire sidebar height
   - [ ] No "double scrollbar" appearance

#### CSS Grid Layout Verification

1. **Inspect sidebar structure:**

   ```css
   /* Expected structure: */
   .sidebar-container {
     display: grid;
     grid-template-rows: auto 1fr; /* Or similar */
     overflow-y: auto; /* Only here */
   }
   ```

2. **Check section heights:**
   - [ ] Feeds section: No fixed height constraint
   - [ ] Topics section: No fixed height constraint
   - [ ] Both sections expand based on content

---

### B. Mutex Accordion Behavior Testing

#### Initial State Validation

1. **Fresh Page Load** (Clear cache: Cmd+Shift+R)
   - [ ] Topics section: OPEN by default
   - [ ] Feeds section: CLOSED by default
   - [ ] Section order: Feeds ABOVE Topics

2. **No State Persistence Check:**
   - Open Feeds, close Topics
   - Refresh page
   - [ ] Should reset to: Topics open, Feeds closed

#### Mutex Toggle Testing

**Test Sequence 1: Topics → Feeds**

1. Start: Topics open, Feeds closed
2. Click Feeds header to expand
3. **Expected:**
   - [ ] Feeds opens with smooth animation
   - [ ] Topics automatically closes
   - [ ] Only ONE section open

**Test Sequence 2: Feeds → Topics**

1. Start: Feeds open, Topics closed
2. Click Topics header to expand
3. **Expected:**
   - [ ] Topics opens with smooth animation
   - [ ] Feeds automatically closes
   - [ ] Only ONE section open

**Test Sequence 3: Rapid Toggling**

1. Click Topics, then immediately Feeds, then Topics again
2. **Expected:**
   - [ ] No visual glitches
   - [ ] Smooth transitions
   - [ ] Final state matches last click

#### Console Validation

```javascript
// Run in browser console to verify state:
const uiStore = window.__UI_STORE__ || {}; // If exposed
console.log({
  feedsCollapsed: uiStore.feedsSectionCollapsed,
  tagsCollapsed: uiStore.tagsSectionCollapsed,
  mutexSection: uiStore.mutexSection,
});
// Expected: Only one false, mutex matches open section
```

---

### C. Mobile Responsiveness Testing

#### Chrome DevTools Mobile Emulation

1. **iPhone 12 Pro (390x844)**
   - [ ] Sidebar: Full width overlay
   - [ ] Backdrop visible behind sidebar
   - [ ] Article list completely hidden when sidebar open
   - [ ] Smooth slide-in animation

2. **iPad (768x1024)**
   - [ ] Sidebar: Fixed width (~280px)
   - [ ] No backdrop needed
   - [ ] Article list visible alongside

3. **Galaxy S20 (360x800)**
   - [ ] Same as iPhone behavior
   - [ ] Touch targets minimum 44x44px

#### Real Device Testing (if available)

1. **Touch Interactions:**
   - [ ] Tap to toggle sections works
   - [ ] No accidental triggers
   - [ ] Smooth animations (60fps)

2. **Orientation Changes:**
   - Portrait → Landscape → Portrait
   - [ ] Layout adapts correctly
   - [ ] No broken states

---

### D. Edge Cases & Content Testing

#### Empty States

1. **No Feeds Available:**
   - Clear all feeds from database
   - [ ] Shows "No feeds available" message
   - [ ] Section still toggleable

2. **No Topics Available:**
   - Clear all topics
   - [ ] Shows "No topics available" message
   - [ ] Section still toggleable

#### Long Content

1. **Feed with 50+ character name:**

   ```
   Test Feed: This is an extremely long feed name that should be truncated properly
   ```

   - [ ] Truncates to 2 lines max
   - [ ] Shows ellipsis (...)
   - [ ] CSS line-clamp working

2. **100+ Feeds/Topics:**
   - [ ] Smooth scrolling performance
   - [ ] No lag when toggling sections
   - [ ] Memory usage stable

---

## 🔍 Browser-Specific Validation

### Chrome/Edge (Chromium)

```javascript
// Performance check in Console
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 16.67) {
      // More than 1 frame at 60fps
      console.warn("Slow animation:", entry.name, entry.duration);
    }
  }
});
observer.observe({ entryTypes: ["measure"] });
```

### Safari

- Check for `-webkit-` prefixes in animations
- Verify smooth elastic scrolling
- Test with Safari Technology Preview

### Firefox

- Open Performance profiler during toggles
- Check for layout thrashing
- Verify CSS Grid rendering

---

## 🚀 Performance Validation

### Without Playwright (Manual)

1. **Chrome DevTools Performance:**
   - Record while toggling sections 10 times
   - Check FPS meter (should stay near 60)
   - Look for:
     - [ ] No red bars (jank)
     - [ ] Consistent frame timing
     - [ ] Paint/Layout under 10ms

2. **Memory Profiling:**
   - Take heap snapshot before testing
   - Toggle sections 50 times
   - Take snapshot after
   - [ ] Memory increase < 5MB

3. **Network Tab:**
   - [ ] No unnecessary API calls during toggles
   - [ ] No resource loading on accordion actions

---

## 📊 Regression Testing

### Features That Must Still Work

1. **Article List:**
   - [ ] Loads correctly with sidebar changes
   - [ ] Infinite scroll still works
   - [ ] Click to read articles

2. **Filtering:**
   - [ ] Feed selection filters articles
   - [ ] Topic selection filters articles
   - [ ] "All Articles" clears filters

3. **Sync Operations:**
   - [ ] Manual sync button works
   - [ ] No interference from sidebar changes

4. **Settings Panel:**
   - [ ] Opens/closes independently
   - [ ] Not affected by sidebar state

---

## 🐛 Bug Report Template

If issues found, document as:

```markdown
### Issue: [Brief Description]

**Severity:** Critical/High/Medium/Low
**Browser:** Chrome 120/Safari 17/Firefox 121
**Device:** Desktop/Mobile (specify)
**Viewport:** 1920x1080 / 390x844 / etc.

**Steps to Reproduce:**

1. [Exact step]
2. [Next step]
3. [Observable issue]

**Expected:** [What should happen]
**Actual:** [What actually happens]

**Screenshot/Recording:** [Attach if possible]
```

---

## ✅ Sign-off Criteria

All items must be checked for RR-193 completion:

- [ ] **Scrollbar:** Only one scrollbar, on main container
- [ ] **Mutex:** Only Topics OR Feeds open at once
- [ ] **Default:** Topics open, Feeds closed on load
- [ ] **Order:** Feeds section above Topics
- [ ] **Mobile:** Full-width overlay working
- [ ] **Empty States:** Handled gracefully
- [ ] **Truncation:** Long names clamped to 2 lines
- [ ] **Performance:** 60fps animations, no jank
- [ ] **Cross-browser:** Works in Chrome, Safari, Firefox
- [ ] **No Regressions:** All existing features still work

---

## 📝 Testing Notes

**Last Updated:** 2025-08-18
**Tester:** **\*\*\*\***\_**\*\*\*\***
**Browser Tested:** **\*\*\*\***\_**\*\*\*\***
**Issues Found:** **\*\*\*\***\_**\*\*\*\***
**Status:** ⬜ Pass / ⬜ Pass with warnings / ⬜ Fail

## Commands for Quick Testing

```bash
# Quick health check
curl -s http://100.96.166.53:3000/reader/api/health | jq '.status'

# Check if mutex logic is in place
grep -n "mutexSection" src/lib/stores/ui-store.ts

# Verify CSS Grid in sidebar
grep -n "grid" src/components/feeds/simple-feed-sidebar.tsx

# Run unit tests only
npx vitest run --no-coverage src/__tests__/unit/rr-193-mutex-accordion.test.tsx
```

---

**End of Validation Checklist**
