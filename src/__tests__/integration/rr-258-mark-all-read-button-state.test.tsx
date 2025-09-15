/**
 * RR-258: Mark All Read Button State Integration Tests
 * Tests complete flow: button click → store operation → cache invalidation → button disable
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { ArticleCountManager } from "@/lib/article-count-manager";
import { articleCacheService } from "@/lib/services/article-cache-service";

// Mock external dependencies
vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("@/lib/stores/article-store", () => ({
  useArticleStore: () => ({
    markAllAsRead: vi.fn().mockResolvedValue(undefined),
    markAllAsReadForTag: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/lib/stores/feed-store", () => ({
  useFeedStore: () => ({
    getFeed: vi.fn().mockReturnValue({
      id: "f489af08-3416-4763-8589-aaab3910d1f4",
      title: "Top Movies",
      unreadCount: 5,
    }),
  }),
}));

vi.mock("@/lib/stores/tag-store", () => ({
  useTagStore: () => ({
    tags: new Map(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Test component simulating page.tsx mark-all-read functionality
function TestMarkAllReadButton({
  selectedFeedId,
  selectedTagId,
  initialCounts = { total: 10, unread: 5, read: 5 },
}: {
  selectedFeedId?: string;
  selectedTagId?: string;
  initialCounts?: { total: number; unread: number; read: number };
}) {
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [waitingConfirmation, setWaitingConfirmation] = useState(false);
  const [counts, setCounts] = useState(initialCounts);
  const countManager = new ArticleCountManager();

  // Register with service (simulating page.tsx useEffect)
  React.useEffect(() => {
    articleCacheService.register(countManager);
    return () => {
      articleCacheService.unregister(countManager);
    };
  }, []);

  const getButtonState = () => {
    if (isMarkingAllRead) return "loading";
    if (waitingConfirmation) return "confirming";
    if (counts.unread === 0) return "disabled";
    return "normal";
  };

  const handleMarkAllClick = async () => {
    if ((!selectedFeedId && !selectedTagId) || isMarkingAllRead) return;

    if (!waitingConfirmation) {
      setWaitingConfirmation(true);
      return;
    }

    setWaitingConfirmation(false);
    setIsMarkingAllRead(true);

    try {
      // Simulate store operation (this would call markAllAsRead/markAllAsReadForTag)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate cache invalidation and count refresh (RR-258 fix)
      if (selectedFeedId) {
        countManager.invalidateCache(selectedFeedId);
      }

      // Simulate fresh count fetch showing 0 unread articles
      const newCounts = { total: counts.total, unread: 0, read: counts.total };
      setCounts(newCounts);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  return (
    <button
      data-testid="mark-all-read"
      data-state={getButtonState()}
      disabled={getButtonState() === "disabled"}
      onClick={handleMarkAllClick}
    >
      {getButtonState() === "loading" && "Marking..."}
      {getButtonState() === "confirming" && "Click again to confirm"}
      {getButtonState() === "disabled" && "All read"}
      {getButtonState() === "normal" && "Mark All Read"}
    </button>
  );
}

describe("RR-258: Mark All Read Button State Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    articleCacheService.reset();
    cleanup();
  });

  describe("AC1: Button State Transitions", () => {
    it("should transition from normal → confirming → loading → disabled", async () => {
      const user = userEvent.setup();

      render(
        <TestMarkAllReadButton
          selectedFeedId="f489af08-3416-4763-8589-aaab3910d1f4"
          initialCounts={{ total: 10, unread: 5, read: 5 }}
        />
      );

      const button = screen.getByTestId("mark-all-read");

      // Initial state: normal
      expect(button).toHaveAttribute("data-state", "normal");
      expect(button).toHaveTextContent("Mark All Read");
      expect(button).not.toBeDisabled();

      // First click: confirming
      await user.click(button);
      await waitFor(() => {
        expect(button).toHaveAttribute("data-state", "confirming");
        expect(button).toHaveTextContent("Click again to confirm");
      });

      // Second click: loading → disabled
      await user.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute("data-state", "loading");
      });

      await waitFor(
        () => {
          expect(button).toHaveAttribute("data-state", "disabled");
          expect(button).toHaveTextContent("All read");
          expect(button).toBeDisabled();
        },
        { timeout: 1000 }
      );
    });

    it("should start disabled when no unread articles", async () => {
      render(
        <TestMarkAllReadButton
          selectedFeedId="f489af08-3416-4763-8589-aaab3910d1f4"
          initialCounts={{ total: 10, unread: 0, read: 10 }}
        />
      );

      const button = screen.getByTestId("mark-all-read");

      expect(button).toHaveAttribute("data-state", "disabled");
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent("All read");
    });
  });

  describe("AC2 & AC3: Cache Invalidation and Count Refresh", () => {
    it("should invalidate cache and refresh counts after mark-all-read", async () => {
      const mockCountManager = {
        invalidateCache: vi.fn(),
        getArticleCounts: vi
          .fn()
          .mockResolvedValue({ total: 5, unread: 0, read: 5 }),
      };

      // Mock ArticleCountManager constructor to return our mock
      vi.spyOn(
        ArticleCountManager.prototype,
        "invalidateCache"
      ).mockImplementation(mockCountManager.invalidateCache);
      vi.spyOn(
        ArticleCountManager.prototype,
        "getArticleCounts"
      ).mockImplementation(mockCountManager.getArticleCounts);

      const user = userEvent.setup();

      render(
        <TestMarkAllReadButton
          selectedFeedId="f489af08-3416-4763-8589-aaab3910d1f4"
          initialCounts={{ total: 5, unread: 3, read: 2 }}
        />
      );

      const button = screen.getByTestId("mark-all-read");

      // Perform mark-all-read operation
      await user.click(button); // First click: confirming
      await user.click(button); // Second click: execute

      // Verify cache invalidation was called
      await waitFor(() => {
        expect(mockCountManager.invalidateCache).toHaveBeenCalledWith(
          "f489af08-3416-4763-8589-aaab3910d1f4"
        );
      });

      // Verify button ends up disabled after count refresh
      await waitFor(
        () => {
          expect(button).toHaveAttribute("data-state", "disabled");
        },
        { timeout: 1000 }
      );
    });
  });

  describe("Service Integration Scenarios", () => {
    it("should work with multiple registered managers (page.tsx + article-header.tsx)", async () => {
      const pageManager = { invalidateCache: vi.fn() };
      const headerManager = { invalidateCache: vi.fn() };

      articleCacheService.register(pageManager);
      articleCacheService.register(headerManager);

      const user = userEvent.setup();

      render(
        <TestMarkAllReadButton
          selectedFeedId="test-feed-id"
          initialCounts={{ total: 8, unread: 4, read: 4 }}
        />
      );

      const button = screen.getByTestId("mark-all-read");

      await user.click(button); // confirming
      await user.click(button); // execute

      await waitFor(() => {
        expect(pageManager.invalidateCache).toHaveBeenCalledWith(
          "test-feed-id"
        );
        expect(headerManager.invalidateCache).toHaveBeenCalledWith(
          "test-feed-id"
        );
      });
    });

    it("should handle component unmounting without errors", () => {
      const manager = { invalidateCache: vi.fn() };

      articleCacheService.register(manager);

      // Simulate component unmount
      articleCacheService.unregister(manager);

      // Should not call invalidation on unregistered manager
      articleCacheService.invalidateCache("unmount-test");
      expect(manager.invalidateCache).not.toHaveBeenCalled();
    });
  });
});
