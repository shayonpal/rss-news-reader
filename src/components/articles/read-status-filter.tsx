'use client';

import { ChevronDown } from 'lucide-react';
import { useArticleStore } from '@/lib/stores/article-store';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export function ReadStatusFilter() {
  const { readStatusFilter, setReadStatusFilter } = useArticleStore();

  const filterOptions = [
    { value: 'unread', label: 'Unread only' },
    { value: 'read', label: 'Read only' },
    { value: 'all', label: 'All articles' },
  ] as const;

  const currentOption = filterOptions.find(opt => opt.value === readStatusFilter);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-muted">
          <span>{currentOption?.label}</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content 
          className="min-w-[160px] bg-background rounded-md shadow-md border p-1"
          align="end"
          sideOffset={5}
        >
          {filterOptions.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              className={`
                flex items-center px-3 py-2 text-sm rounded cursor-pointer
                ${readStatusFilter === option.value 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-muted'
                }
              `}
              onSelect={() => setReadStatusFilter(option.value)}
            >
              {option.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}