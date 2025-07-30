"use client";

import * as React from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { cn } from "@/lib/utils";
import { ChevronRight, Folder, FolderOpen, Rss, Inbox } from "lucide-react";

interface FeedTreeItemProps {
  type: "folder" | "feed" | "all";
  id: string;
  title: string;
  unreadCount: number;
  depth: number;
  isExpanded?: boolean;
  isSelected?: boolean;
  onToggle?: () => void;
  onSelect?: () => void;
  children?: React.ReactNode;
}

export function FeedTreeItem({
  type,
  id,
  title,
  unreadCount,
  depth,
  isExpanded = false,
  isSelected = false,
  onToggle,
  onSelect,
  children,
}: FeedTreeItemProps) {
  const paddingLeft = 12 + depth * 16;

  const getIcon = () => {
    if (type === "all") return <Inbox className="h-4 w-4" />;
    if (type === "folder") {
      return isExpanded ? (
        <FolderOpen className="h-4 w-4" />
      ) : (
        <Folder className="h-4 w-4" />
      );
    }
    return <Rss className="h-4 w-4" />;
  };

  const hasUnread = unreadCount > 0;

  const content = (
    <div
      className={cn(
        "group flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-all",
        "hover:bg-muted/50",
        isSelected && "bg-muted font-medium",
        type === "feed" && "pl-8",
        !hasUnread &&
          !isSelected &&
          type !== "all" &&
          "opacity-35 hover:opacity-100"
      )}
      style={{ paddingLeft: `${paddingLeft}px` }}
      onClick={() => {
        if (type === "folder" && onToggle) {
          onToggle();
        } else if (onSelect) {
          onSelect();
        }
      }}
    >
      {/* Expand/Collapse Chevron for Folders */}
      {type === "folder" && (
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200",
            isExpanded && "rotate-90"
          )}
        />
      )}

      {/* Icon */}
      <div className={cn("shrink-0", type !== "folder" && "ml-3")}>
        {getIcon()}
      </div>

      {/* Title */}
      <span className={cn("flex-1 truncate", unreadCount > 0 && "font-medium")}>
        {title}
      </span>

      {/* Unread Count */}
      {unreadCount > 0 && (
        <span
          className={cn(
            "ml-2 inline-flex shrink-0 items-center justify-center px-2 py-0.5",
            "rounded-full text-xs font-medium",
            "bg-primary/10 text-primary",
            isSelected && "bg-primary text-primary-foreground"
          )}
        >
          {unreadCount > 999 ? "999+" : unreadCount}
        </span>
      )}
    </div>
  );

  if (type === "folder" && children) {
    return (
      <Collapsible.Root open={isExpanded}>
        <Collapsible.Trigger asChild>{content}</Collapsible.Trigger>
        <Collapsible.Content>{children}</Collapsible.Content>
      </Collapsible.Root>
    );
  }

  return content;
}
