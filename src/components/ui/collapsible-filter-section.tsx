'use client';

import * as React from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown, ChevronRight, FoldVertical, UnfoldVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleFilterSectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onToggle?: (isOpen: boolean) => void;
  className?: string;
  testId?: string;
}

export function CollapsibleFilterSection({
  title,
  count = 0,
  defaultOpen = true,
  icon,
  children,
  onToggle,
  className,
  testId = 'collapsible-filter-section'
}: CollapsibleFilterSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onToggle?.(open);
  };

  const displayCount = count > 999 ? '999+' : count.toString();
  const shouldShowCount = count > 0;

  const toggleIcon = isOpen ? (
    <FoldVertical className="h-4 w-4 transition-transform duration-200" />
  ) : (
    <UnfoldVertical className="h-4 w-4 transition-transform duration-200" />
  );

  return (
    <Collapsible.Root
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={cn('w-full', className)}
      data-testid={testId}
    >
      <Collapsible.Trigger
        className={cn(
          'flex w-full items-center justify-between px-3 py-2.5',
          'min-h-[44px] text-left hover:bg-muted/30',
          'transition-colors duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'cursor-pointer select-none',
          'text-sm font-semibold text-muted-foreground'
        )}
        data-testid={`${testId}-trigger`}
        aria-expanded={isOpen}
        aria-controls={`${testId}-content`}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="opacity-70">{icon}</span>}
          <span className="uppercase tracking-wider">{title}</span>
          {shouldShowCount && (
            <span 
              className="ml-1 font-normal"
              data-testid={`${testId}-count`}
            >
              ({displayCount})
            </span>
          )}
        </div>
        <div className="opacity-70">
          {toggleIcon}
        </div>
      </Collapsible.Trigger>

      <Collapsible.Content
        className={cn(
          'overflow-hidden transition-all duration-200',
          'data-[state=closed]:animate-collapsible-up',
          'data-[state=open]:animate-collapsible-down'
        )}
        id={`${testId}-content`}
        data-testid={`${testId}-content`}
      >
        <div className="pb-2">
          {children}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}