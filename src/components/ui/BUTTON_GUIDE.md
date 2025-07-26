# Button Component Quick Reference

⚠️ **IMPORTANT**: Always use our established button architecture. Do NOT create custom button implementations.

## Button Hierarchy

```
IOSButton (Base)
  └── ArticleActionButton (Styling)
        ├── StarButton (Specialized)
        ├── SummaryButton (Specialized)
        └── [Your New Button] (Specialized)
```

## Quick Start - Creating a New Action Button

### Option 1: Direct Usage (Simple Actions)
```tsx
import { Download } from 'lucide-react';
import { ArticleActionButton } from '@/components/ui/article-action-button';

<ArticleActionButton
  icon={Download}
  onPress={handleDownload}
  size="sm"  // sm for list, md for detail
  label="Download article"
/>
```

### Option 2: Specialized Component (Complex Actions)
```tsx
// Create: src/components/articles/download-button.tsx
import { Download } from 'lucide-react';
import { ArticleActionButton } from '@/components/ui/article-action-button';

export function DownloadButton({ articleId, size = 'sm' }) {
  const handleDownload = async () => {
    // Complex logic here
  };

  return (
    <ArticleActionButton
      icon={Download}
      onPress={handleDownload}
      size={size}
      label="Download article"
    />
  );
}
```

## Size Guidelines
- `sm` (16x16): Article list cards
- `md` (20x20): Article detail header
- `lg` (24x24): Reserved for future use

## Complete Documentation
See: `docs/tech/button-architecture.md`