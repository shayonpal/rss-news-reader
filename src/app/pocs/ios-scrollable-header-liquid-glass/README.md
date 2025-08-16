# iOS Scrollable Header Liquid Glass POC

**Status:** In Progress  
**Linear Issue:** [RR-215](https://linear.app/agilecode-studio/issue/RR-215/poc-ios-26-liquid-glass-scrollable-header-for-article-listing)  
**Date:** January 16, 2025

## Purpose

Transform the RSS Reader's article listing page to implement iOS 26 Liquid Glass design with a native iOS-style scrollable header, similar to Apple News and Mail apps. This POC explores advanced scroll-based animations and glass morphism effects for a more native mobile experience.

## Key Decisions Made

### Scroll Behavior

- **Three-state system**: expanded (0-44px), transitioning (44-150px), collapsed (>150px)
- **RequestAnimationFrame**: Used for smooth 60fps scroll tracking without jank
- **Spring physics**: 0.35s cubic-bezier(0.32, 0.72, 0, 1) for iOS-native feel

### Visual Design

- **Dynamic title scaling**: 34px → 17px with transform-based animation
- **Glass effects**: Backdrop-filter with dynamic blur intensity (8-16px)
- **Morphing navigation**: Hamburger icon transforms to back button on scroll

### Performance Optimizations

- **CSS transforms**: Used instead of top/height for GPU acceleration
- **Will-change hints**: Applied to frequently animated properties
- **Passive listeners**: Scroll events marked as passive for better performance
- **Debounced updates**: RAF-based throttling to prevent excessive renders

## Technical Approach

- **Framework**: Next.js 14 App Router with client-side components
- **TypeScript**: Strict typing with proper interfaces and types
- **Styling**: Tailwind CSS with inline styles for dynamic values
- **State Management**: Local React state with custom hooks
- **Animation**: CSS transitions with spring-based timing functions
- **Responsiveness**: Mobile-first design with dark mode support

## Implementation Details

### Custom Hook: useIOSHeaderScroll

```typescript
const useIOSHeaderScroll = () => {
  // Tracks scroll position and direction
  // Returns: { scrollState, scrollY, isScrollingUp }
  // Uses RAF for performance optimization
};
```

### Scroll State Management

```typescript
type ScrollState = "expanded" | "transitioning" | "collapsed";
```

- **Expanded**: Large title visible, full header height
- **Transitioning**: Title scaling in progress, header shrinking
- **Collapsed**: Compact navigation bar, minimal height

### Glass Effect Implementation

```css
backdrop-filter: blur(16px) saturate(180%);
background: rgba(255, 255, 255, 0.8);
```

- Dynamic blur intensity based on scroll position
- Fallback for devices without backdrop-filter support
- Maintains readability over content

### Navigation Button Morphing

- Smooth rotation animation between hamburger and back icons
- Maintains 44px touch target throughout transition
- Glass background with 12% white overlay

## Key Features Implemented

### 1. Large Title Behavior

- ✅ Scales from 34px to 17px based on scroll
- ✅ Origin-left transform for iOS-like animation
- ✅ Opacity fade during transition
- ✅ Spring-based timing function

### 2. Header Compression

- ✅ Height reduces from 120px to 54px
- ✅ Smooth transition with spring physics
- ✅ Maintains safe area insets
- ✅ Sticky positioning with proper z-index

### 3. Glass Morphism

- ✅ Dynamic backdrop blur (8-16px)
- ✅ Saturation boost for vibrancy
- ✅ Semi-transparent backgrounds
- ✅ Progressive enhancement fallback

### 4. Interactive Elements

- ✅ Pull-to-refresh simulation
- ✅ Filter pills in sticky sub-header
- ✅ Sidebar toggle with overlay
- ✅ Active states with scale transforms

## Testing Checklist

### Visual Testing

- [ ] Large title scales smoothly without jumps
- [ ] Navigation icon morphs correctly
- [ ] Glass effects maintain contrast
- [ ] Dark mode appearance is consistent

### Interaction Testing

- [ ] Scroll triggers at correct thresholds
- [ ] Touch targets remain accessible (44px)
- [ ] Sidebar toggle works in all states
- [ ] Pull-to-refresh gesture feels natural

### Performance Testing

- [ ] Maintains 60fps during scroll
- [ ] No layout thrashing or repaints
- [ ] Memory usage stays reasonable
- [ ] Works on older iOS devices (iPhone 12+)

### Device Testing

- [ ] iPhone 15/16 models
- [ ] iPad Pro and iPad Mini
- [ ] PWA standalone mode
- [ ] Dynamic Type settings

## Browser Compatibility

### Fully Supported

- Safari 15+ (iOS/macOS)
- Chrome 90+ (with backdrop-filter)
- Edge 90+

### Partial Support

- Firefox (no backdrop-filter, uses fallback)
- Safari 14 (reduced blur effects)

### Known Issues

- Older Android devices may have performance issues with backdrop-filter
- Firefox requires fallback styling for glass effects

## Integration Points

### With Existing Components

- **SimpleFeedSidebar**: Coordinate hamburger state with sidebar visibility
- **ArticleHeader**: Replace fixed header with scrollable variant
- **FilterControls**: Move into collapsible header or sticky sub-header
- **ArticleList**: Adjust padding for new header behavior

### State Management

- Header state should be isolated to prevent unnecessary re-renders
- Consider using Context API if multiple components need scroll state
- Maintain filter state separately from scroll behavior

## Next Steps

### For Production Implementation

1. **Component Extraction**
   - Extract `IOSScrollableHeader` as reusable component
   - Create `useIOSHeaderScroll` hook in shared hooks directory
   - Define shared animation constants

2. **Performance Optimization**
   - Implement Intersection Observer for large lists
   - Add virtualization for article rendering
   - Optimize backdrop-filter for older devices

3. **Accessibility Enhancements**
   - Add ARIA labels for state changes
   - Implement keyboard navigation support
   - Ensure Dynamic Type compatibility

4. **Feature Completion**
   - Real pull-to-refresh implementation
   - Persist scroll position on navigation
   - Add haptic feedback on iOS devices

5. **Testing**
   - Unit tests for scroll hook
   - E2E tests for header behavior
   - Visual regression tests
   - Performance benchmarks

## Related Documentation

- [Liquid Glass Design Guidelines](/docs/ui-ux/liquid-glass-design-guidelines.md)
- [iOS Components Documentation](/docs/ui-ux/ios-liquid-glass-components.md)
- [Implementation Guide](/docs/ui-ux/liquid-glass-implementation-guide.md)

## Resources

- [Apple Human Interface Guidelines - Navigation Bars](https://developer.apple.com/design/human-interface-guidelines/navigation-bars)
- [WWDC 2025: Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/)
- [Web Performance: Optimizing Backdrop Filters](https://web.dev/backdrop-filter-performance/)
- [Building iOS-like Interfaces with CSS](https://css-tricks.com/ios-like-interfaces/)

## Code References

### Main Implementation

- `/src/app/pocs/ios-scrollable-header-liquid-glass/page.tsx` - Complete POC implementation

### To Be Created

- `/src/hooks/use-ios-scroll.ts` - Extracted scroll management hook
- `/src/components/layout/ios-header.tsx` - Production component
- `/src/lib/constants/animations.ts` - Shared animation values

## Notes

- This POC prioritizes native feel over exact visual parity due to PWA limitations
- Performance on older devices may require reducing blur effects
- Consider implementing reduced motion preferences for accessibility
- The morphing navigation pattern can extend to other UI elements
- Pull-to-refresh should integrate with actual data fetching in production
