# Floating Read Status Filter Pill

## Overview
A glass-morphic floating filter pill that appears when scrolling the article list, providing quick access to read status filtering (All/Unread/Read) without cluttering the header.

## Design Inspiration
Based on iOS 26 Photos app's floating selection bar - appears on scroll, heavily blurred glass effect, auto-hides when scrolling up.

## Component Structure

### Filter Pill Component
```tsx
interface FloatingFilterPillProps {
  currentFilter: 'all' | 'unread' | 'read';
  onFilterChange: (filter: 'all' | 'unread' | 'read') => void;
  isVisible: boolean;
}

export function FloatingFilterPill({ 
  currentFilter, 
  onFilterChange,
  isVisible 
}: FloatingFilterPillProps) {
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'read', label: 'Read' }
  ];

  return (
    <div className={cn(
      "fixed top-20 left-1/2 -translate-x-1/2 z-40",
      "transition-all duration-300 ease-out",
      isVisible 
        ? "translate-y-0 opacity-100 scale-100" 
        : "-translate-y-full opacity-0 scale-95"
    )}>
      {/* Glass pill container */}
      <div className="glass-filter-pill">
        <div className="flex items-center p-1 gap-1">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => onFilterChange(filter.id as FilterType)}
              className={cn(
                "filter-option",
                currentFilter === filter.id && "filter-option-active"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        
        {/* Active indicator */}
        <div 
          className="filter-indicator"
          style={{
            transform: `translateX(${filters.findIndex(f => f.id === currentFilter) * 100}%)`
          }}
        />
      </div>
    </div>
  );
}
```

## CSS Implementation

### Glass Pill Styles
```css
/* Floating filter pill */
.glass-filter-pill {
  position: relative;
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
  background: rgba(255, 255, 255, 0.70);
  border: 1px solid rgba(255, 255, 255, 0.40);
  border-radius: 20px;
  padding: 3px;
  box-shadow: 
    0 20px 50px rgba(0, 0, 0, 0.15),
    0 2px 8px rgba(0, 0, 0, 0.05),
    inset 0 1px 1px rgba(255, 255, 255, 0.35);
  overflow: hidden;
}

.dark .glass-filter-pill {
  background: rgba(30, 30, 30, 0.70);
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 
    0 20px 50px rgba(0, 0, 0, 0.40),
    0 2px 8px rgba(0, 0, 0, 0.10),
    inset 0 1px 1px rgba(255, 255, 255, 0.10);
}

/* Filter options */
.filter-option {
  position: relative;
  z-index: 2;
  padding: 8px 20px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.60);
  transition: all 200ms ease-out;
  min-width: 80px;
}

.dark .filter-option {
  color: rgba(255, 255, 255, 0.60);
}

.filter-option:hover {
  color: rgba(0, 0, 0, 0.80);
}

.dark .filter-option:hover {
  color: rgba(255, 255, 255, 0.80);
}

/* Active option */
.filter-option-active {
  color: rgb(0, 122, 255);
  font-weight: 600;
}

.dark .filter-option-active {
  color: rgb(10, 132, 255);
}

/* Sliding indicator */
.filter-indicator {
  position: absolute;
  top: 3px;
  left: 3px;
  width: calc(33.33% - 2px);
  height: calc(100% - 6px);
  background: rgba(255, 255, 255, 0.90);
  border-radius: 16px;
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.08),
    inset 0 1px 1px rgba(255, 255, 255, 0.50);
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
}

.dark .filter-indicator {
  background: rgba(60, 60, 60, 0.90);
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.20),
    inset 0 1px 1px rgba(255, 255, 255, 0.05);
}
```

## Scroll Behavior Integration

### Visibility Logic
```typescript
export function useFloatingFilter() {
  const [isVisible, setIsVisible] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const scrollThreshold = 100; // Show after scrolling 100px
  
  useEffect(() => {
    let ticking = false;
    
    const updateVisibility = () => {
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY;
      const pastThreshold = currentScrollY > scrollThreshold;
      
      // Show when scrolling down past threshold
      // Hide when scrolling up or at top
      if (scrollingDown && pastThreshold && !isVisible) {
        setIsVisible(true);
      } else if ((!scrollingDown || currentScrollY < 50) && isVisible) {
        setIsVisible(false);
      }
      
      setLastScrollY(currentScrollY);
      ticking = false;
    };
    
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateVisibility);
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isVisible, lastScrollY]);
  
  return isVisible;
}
```

### Integration with Article List
```tsx
export function ArticleList({ currentFilter, onFilterChange }) {
  const isFilterVisible = useFloatingFilter();
  
  return (
    <>
      {/* Floating filter - renders at top level */}
      <FloatingFilterPill
        currentFilter={currentFilter.readStatus}
        onFilterChange={(status) => onFilterChange({ 
          ...currentFilter, 
          readStatus: status 
        })}
        isVisible={isFilterVisible}
      />
      
      {/* Article list content */}
      <div className="article-list">
        {/* ... */}
      </div>
    </>
  );
}
```

## Animation Details

### Entrance Animation
```css
/* Smooth slide and fade */
@keyframes filter-pill-enter {
  0% {
    transform: translateX(-50%) translateY(-20px) scale(0.95);
    opacity: 0;
  }
  100% {
    transform: translateX(-50%) translateY(0) scale(1);
    opacity: 1;
  }
}

.filter-pill-entering {
  animation: filter-pill-enter 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Interaction Feedback
```typescript
// Add haptic feedback on filter change
const handleFilterChange = (filter: FilterType) => {
  // Haptic feedback
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
  
  // Visual feedback - brief scale
  setPressing(true);
  setTimeout(() => setPressing(false), 100);
  
  onFilterChange(filter);
};
```

## Accessibility

```tsx
<div 
  role="radiogroup" 
  aria-label="Filter articles by read status"
  className="glass-filter-pill"
>
  {filters.map((filter) => (
    <button
      key={filter.id}
      role="radio"
      aria-checked={currentFilter === filter.id}
      aria-label={`Show ${filter.label.toLowerCase()} articles`}
      onClick={() => onFilterChange(filter.id)}
      className="filter-option"
    >
      {filter.label}
    </button>
  ))}
</div>
```

## Performance Considerations

1. **Debounced scroll handler** with RAF for 60fps
2. **GPU acceleration** via transform and will-change
3. **Conditional rendering** - component unmounts when hidden
4. **Lightweight animations** - only transform and opacity

## Usage Notes

1. **Positioning**: Fixed position, centered horizontally
2. **Z-index**: Below modals (z-50) but above content (z-40)
3. **Timing**: Appears after 100px scroll, hides on scroll up
4. **State**: Filter state managed by parent (ArticleList)
5. **Persistence**: Selected filter remains when pill hides/shows