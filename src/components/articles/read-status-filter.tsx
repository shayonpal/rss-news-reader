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

export function ReadStatusFilter() {
  const { readStatusFilter, setReadStatusFilter } = useArticleStore();

  // Determine current value across three options
  const value: "all" | "unread" | "read" =
    readStatusFilter === "unread"
      ? "unread"
      : readStatusFilter === "read"
      ? "read"
      : "all";

  return (
    <div
      className="glass-segment glass-segment-sm glass-segment-3"
      data-value={value}
      role="tablist"
      aria-label="Read status"
    >
      <div className="glass-segment-indicator" aria-hidden="true" />

      <button
        role="tab"
        aria-pressed={value === "all"}
        className="glass-segment-btn"
        onClick={() => setReadStatusFilter("all")}
        title="All articles"
      >
        <List className="h-4 w-4" />
        <span className="ml-2 hidden md:inline">All</span>
      </button>

      <button
        role="tab"
        aria-pressed={value === "unread"}
        className="glass-segment-btn"
        onClick={() => setReadStatusFilter("unread")}
        title="Unread only"
      >
        <MailOpen className="h-4 w-4" />
        <span className="ml-2 hidden md:inline">Unread</span>
      </button>

      <button
        role="tab"
        aria-pressed={value === "read"}
        className="glass-segment-btn"
        onClick={() => setReadStatusFilter("read")}
        title="Read only"
      >
        <CheckCheck className="h-4 w-4" />
        <span className="ml-2 hidden md:inline">Read</span>
      </button>
    </div>
  );
}
