/**
 * Read Status Filter Component
 * Based on PRD Section: Read Status Filtering
 *
 * Provides dropdown with three filter options:
 * - "Unread only" (default) - Focus on new content
 * - "Read only" - Review previously read articles
 * - "All articles" - Complete view of all content
 *
 * Filter preference persists in localStorage across sessions.
 */

"use client";

import { ChevronDown } from "lucide-react";
import { useArticleStore } from "@/lib/stores/article-store";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export function ReadStatusFilter() {
  const { readStatusFilter, setReadStatusFilter } = useArticleStore();

  // Filter options as specified in PRD
  const filterOptions = [
    {
      value: "unread",
      label: "Unread only",
      description: "Focus on new content",
    },
    {
      value: "read",
      label: "Read only",
      description: "Review previously read articles",
    },
    {
      value: "all",
      label: "All articles",
      description: "Complete view of all content",
    },
  ] as const;

  const currentOption = filterOptions.find(
    (opt) => opt.value === readStatusFilter
  );

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
          aria-label={`Current filter: ${currentOption?.label}. Click to change filter`}
        >
          <span>{currentOption?.label}</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[200px] rounded-md border bg-background p-1 shadow-md"
          align="end"
          sideOffset={5}
        >
          {filterOptions.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              className={`flex cursor-pointer flex-col items-start rounded px-3 py-2 text-sm ${
                readStatusFilter === option.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              } `}
              onSelect={() => setReadStatusFilter(option.value)}
            >
              <span className="font-medium">{option.label}</span>
              <span
                className={`text-xs ${
                  readStatusFilter === option.value
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground"
                }`}
              >
                {option.description}
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
