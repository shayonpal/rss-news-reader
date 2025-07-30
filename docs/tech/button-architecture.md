# Button Architecture Documentation

This document explains the button component hierarchy in the RSS News Reader application, providing guidance on when to use each component and how to create new action buttons.

## Overview

The button architecture follows a three-tier hierarchy designed to solve iOS Safari touch handling issues while maintaining consistent styling across the application.

```
IOSButton (Base Layer)
    ↓
ArticleActionButton (Styling Layer)
    ↓
Specialized Buttons (Feature Layer)
```

## Component Hierarchy

### 1. IOSButton (Base Layer)

**Location:** `src/components/ui/ios-button.tsx`

**Purpose:** Solves the iOS Safari double-tap issue by properly handling touch events.

**Key Features:**

- Extends the standard Button component with iOS-specific touch handling
- Prevents the need for double-tapping on iOS devices
- Manages touch state to avoid duplicate event firing
- Applies iOS-specific CSS properties for better mobile experience

**When to use:**

- As the foundation for ALL buttons in the application that need iOS compatibility
- Directly when you need a button that doesn't follow the article action pattern

**Example:**

```tsx
<IOSButton onPress={handleAction} variant="default" size="sm">
  Click Me
</IOSButton>
```

### 2. ArticleActionButton (Styling Layer)

**Location:** `src/components/ui/article-action-button.tsx`

**Purpose:** Provides consistent styling and behavior for article-related action buttons.

**Key Features:**

- Built on top of IOSButton
- Standardized icon-based button with consistent sizing
- Support for active states with customizable styling
- Loading state support with optional loading icon
- Three size variants: 'sm' (16x16), 'md' (20x20), 'lg' (24x24)

**Props:**

- `icon`: LucideIcon - The icon to display
- `onPress`: Function - Handler for button press
- `size`: 'sm' | 'md' | 'lg' - Icon size (default: 'sm')
- `active`: boolean - Whether the button is in active state
- `activeClassName`: string - Custom class for active state
- `label`: string - Accessibility label
- `title`: string - Tooltip text (optional)
- `disabled`: boolean - Disable the button
- `loading`: boolean - Show loading state
- `loadingIcon`: LucideIcon - Icon to show when loading
- `className`: string - Additional CSS classes

**When to use:**

- For any icon-based action button in article contexts
- When you need consistent styling across different article actions

**Example:**

```tsx
<ArticleActionButton
  icon={BookmarkIcon}
  onPress={handleBookmark}
  size="md"
  active={isBookmarked}
  activeClassName="text-blue-500 fill-blue-500"
  label="Bookmark article"
/>
```

### 3. Specialized Buttons (Feature Layer)

These are purpose-built components that use ArticleActionButton for specific features.

#### StarButton

**Location:** `src/components/articles/star-button.tsx`

**Purpose:** Handles article starring functionality with consistent styling.

**Features:**

- Uses yellow color for active (starred) state
- Simplified props focused on star functionality
- Consistent star/unstar labeling

**Example:**

```tsx
<StarButton
  onToggleStar={handleToggleStar}
  isStarred={article.starred}
  size="sm"
/>
```

#### SummaryButton

**Location:** `src/components/articles/summary-button.tsx`

**Purpose:** Handles AI summary generation with two display variants.

**Features:**

- Icon variant: Uses ArticleActionButton for compact display
- Full variant: Uses IOSButton directly for button with text
- Loading state with spinner animation
- Different icons for initial generation vs regeneration

**Example:**

```tsx
// Icon variant
<SummaryButton
  articleId={article.id}
  hasSummary={!!article.summary}
  variant="icon"
  size="md"
/>

// Full variant with text
<SummaryButton
  articleId={article.id}
  hasSummary={!!article.summary}
  variant="full"
  onSuccess={handleSummaryGenerated}
/>
```

## Creating New Action Buttons

Follow these steps to create a new specialized button:

### Step 1: Define the Component

Create a new file in `src/components/articles/` or appropriate directory:

```tsx
// src/components/articles/share-button.tsx
"use client";

import { Share2 } from "lucide-react";
import {
  ArticleActionButton,
  type ArticleActionButtonSize,
} from "@/components/ui/article-action-button";

interface ShareButtonProps {
  onShare: () => void;
  size?: ArticleActionButtonSize;
  disabled?: boolean;
}

export function ShareButton({
  onShare,
  size = "sm",
  disabled = false,
}: ShareButtonProps) {
  return (
    <ArticleActionButton
      icon={Share2}
      onPress={onShare}
      size={size}
      active={false}
      label="Share article"
      disabled={disabled}
    />
  );
}
```

### Step 2: Add State Management (if needed)

For buttons with active states or complex interactions:

```tsx
// Example with active state tracking
interface BookmarkButtonProps {
  articleId: string;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  size?: ArticleActionButtonSize;
}

export function BookmarkButton({
  articleId,
  isBookmarked,
  onToggleBookmark,
  size = "sm",
}: BookmarkButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      await onToggleBookmark();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ArticleActionButton
      icon={Bookmark}
      onPress={handleToggle}
      size={size}
      active={isBookmarked}
      activeClassName="fill-current"
      label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
      disabled={isLoading}
      loading={isLoading}
      loadingIcon={Loader2}
    />
  );
}
```

### Step 3: Use in Parent Components

```tsx
// In article list or detail component
<div className="flex items-center gap-1">
  <StarButton
    onToggleStar={() => handleToggleStar(article.id)}
    isStarred={article.starred}
    size="sm"
  />
  <ShareButton onShare={() => handleShare(article)} size="sm" />
  <SummaryButton
    articleId={article.id}
    hasSummary={!!article.summary}
    variant="icon"
    size="sm"
  />
</div>
```

## Best Practices

### 1. Always Use the Architecture

❌ **Don't** create custom button implementations:

```tsx
// Bad - Creates iOS touch issues
<button onClick={handleStar}>
  <Star className="h-4 w-4" />
</button>
```

✅ **Do** use the established components:

```tsx
// Good - Handles iOS properly
<StarButton onToggleStar={handleStar} isStarred={isStarred} />
```

### 2. Consistent Sizing

Use the predefined size variants to maintain visual consistency:

- `sm` (16x16) - Default for article lists
- `md` (20x20) - For article detail headers
- `lg` (24x24) - For emphasis or larger touch targets

### 3. Accessibility

Always provide meaningful labels:

```tsx
<ArticleActionButton
  icon={Download}
  onPress={handleDownload}
  label="Download article for offline reading" // Descriptive label
  title="Download" // Short tooltip
/>
```

### 4. Active State Styling

Use `activeClassName` for custom active state colors:

```tsx
// Star button with yellow active state
activeClassName = "fill-yellow-500 text-yellow-500";

// Bookmark with blue active state
activeClassName = "fill-blue-500 text-blue-500";
```

### 5. Loading States

Always handle loading states for async operations:

```tsx
<ArticleActionButton
  icon={Save}
  onPress={handleSave}
  disabled={isLoading}
  loading={isLoading}
  loadingIcon={Loader2} // Shows spinning loader
  label="Save article"
/>
```

### 6. Variant Selection

For specialized buttons that need both icon and text variants:

- Create an icon variant using ArticleActionButton
- Create a full variant using IOSButton directly
- Use a `variant` prop to switch between them

## Common Patterns

### Action Button Group

```tsx
// Standard article action button group
<div className="flex items-center gap-1">
  <StarButton {...starProps} />
  <SummaryButton {...summaryProps} />
  <ShareButton {...shareProps} />
</div>
```

### Conditional Rendering

```tsx
// Show different buttons based on state
{
  article.canEdit ? (
    <EditButton onEdit={handleEdit} size="sm" />
  ) : (
    <ViewButton onView={handleView} size="sm" />
  );
}
```

### Custom Active Behavior

```tsx
// Toggle button with custom states
<ArticleActionButton
  icon={isExpanded ? ChevronUp : ChevronDown}
  onPress={toggleExpanded}
  active={isExpanded}
  label={isExpanded ? "Collapse" : "Expand"}
/>
```

## Testing Considerations

When testing button components:

1. **iOS Safari Testing**: Always test on actual iOS devices or BrowserStack
2. **Touch Events**: Verify single-tap functionality on mobile
3. **Accessibility**: Test with screen readers
4. **Loading States**: Ensure buttons are properly disabled during async operations
5. **Active States**: Verify visual feedback for active/inactive states

## Migration Guide

If you have existing custom button implementations:

1. Replace `<button>` with `<IOSButton>` for basic buttons
2. Convert icon buttons to use `<ArticleActionButton>`
3. Create specialized components for repeated patterns
4. Update event handlers from `onClick` to `onPress`
5. Add proper accessibility labels

## Summary

This button architecture ensures:

- ✅ Consistent iOS Safari touch handling
- ✅ Uniform styling across the application
- ✅ Reusable patterns for common actions
- ✅ Proper accessibility support
- ✅ Easy maintenance and extension

Always use this architecture instead of creating custom button implementations to maintain consistency and avoid iOS touch issues.
