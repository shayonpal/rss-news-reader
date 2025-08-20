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

import { List, MailOpen, CheckCheck } from "lucide-react";
import { useArticleStore } from "@/lib/stores/article-store";
import { GlassSegmentedControl } from "@/components/ui/glass-segmented-control";

export function ReadStatusFilter() {
  const { readStatusFilter, setReadStatusFilter } = useArticleStore();

  // Transform store data to component options format
  const options = [
    { value: "all", label: "All", icon: <List className="h-4 w-4" /> },
    {
      value: "unread",
      label: "Unread",
      icon: <MailOpen className="h-4 w-4" />,
    },
    { value: "read", label: "Read", icon: <CheckCheck className="h-4 w-4" /> },
  ];

  // Determine current value across three options
  const value: "all" | "unread" | "read" =
    readStatusFilter === "unread"
      ? "unread"
      : readStatusFilter === "read"
        ? "read"
        : "all";

  return (
    <GlassSegmentedControl
      options={options}
      value={value}
      onValueChange={(newValue: string) => {
        setReadStatusFilter(newValue as typeof readStatusFilter);
      }}
      size="sm"
      segments={3}
      ariaLabel="Read status"
    />
  );
}
