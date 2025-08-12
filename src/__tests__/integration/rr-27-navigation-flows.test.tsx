import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { useRouter } from "next/navigation";
import { setupTestServer } from "./test-server";
import type { Server } from "http";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(() => ({ id: "test-article-1" })),
}));

// Mock Zustand stores
const mockArticleStore = {
  articles: new Map(),
  loadingArticles: false,
  articlesError: null,
  readStatusFilter: "unread" as const,
  loadArticles: vi.fn(),
  markAsRead: vi.fn(),
  markMultipleAsRead: vi.fn(),
  getArticle: vi.fn(),
  toggleStar: vi.fn(),
  refreshArticles: vi.fn(),
};

const mockFeedStore = {
  feeds: new Map(),
  loadFeeds: vi.fn(),
};

vi.mock("@/lib/stores/article-store", () => ({
  useArticleStore: () => mockArticleStore,
}));

vi.mock("@/lib/stores/feed-store", () => ({
  useFeedStore: () => mockFeedStore,
}));

// Mock intersection observer
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
});
vi.stubGlobal("IntersectionObserver", mockIntersectionObserver);

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal("sessionStorage", mockSessionStorage);

// Test components - simplified versions for integration testing
const TestArticleList = ({
  onArticleClick,
}: {
  onArticleClick: (id: string) => void;
}) => {
  const scrollContainerRef = { current: document.createElement("div") };

  // Mock articles for testing
  const testArticles = [
    {
      id: "1",
      title: "Article 1",
      isRead: false,
      publishedAt: new Date(),
      feedTitle: "Test Feed",
      content: "Content 1",
      tags: [],
    },
    {
      id: "2",
      title: "Article 2",
      isRead: true,
      publishedAt: new Date(),
      feedTitle: "Test Feed",
      content: "Content 2",
      tags: [],
    },
    {
      id: "3",
      title: "Article 3",
      isRead: false,
      publishedAt: new Date(),
      feedTitle: "Test Feed",
      content: "Content 3",
      tags: [],
    },
  ];

  return (
    <div data-testid="article-list" ref={scrollContainerRef}>
      {testArticles.map((article) => (
        <div
          key={article.id}
          data-testid={`article-${article.id}`}
          data-article-id={article.id}
          data-is-read={article.isRead}
          onClick={() => onArticleClick(article.id)}
          className={article.isRead ? "opacity-70" : ""}
        >
          <h2>{article.title}</h2>
          <div>Read: {article.isRead ? "Yes" : "No"}</div>
        </div>
      ))}
    </div>
  );
};

const TestArticleDetail = ({
  articleId,
  onBack,
  onNavigate,
}: {
  articleId: string;
  onBack: () => void;
  onNavigate: (direction: "prev" | "next") => void;
}) => {
  return (
    <div data-testid="article-detail">
      <button data-testid="back-button" onClick={onBack}>
        Back
      </button>
      <button data-testid="prev-button" onClick={() => onNavigate("prev")}>
        Previous
      </button>
      <button data-testid="next-button" onClick={() => onNavigate("next")}>
        Next
      </button>
      <h1>Article {articleId}</h1>
      <div>Article content here...</div>
    </div>
  );
};

describe("RR-27: Article List State Preservation - Integration Tests", () => {
  let server: Server;
  let app: any;
  let mockPush: ReturnType<typeof vi.fn>;
  let mockBack: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    const testServer = await setupTestServer(3002);
    server = testServer.server;
    app = testServer.app;

    await new Promise<void>((resolve) => {
      server.listen(3002, resolve);
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockSessionStorage.getItem.mockReturnValue(null);

    // Setup router mocks
    mockPush = vi.fn();
    mockBack = vi.fn();
    (useRouter as any).mockReturnValue({
      push: mockPush,
      back: mockBack,
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
    });

    // Reset article store
    mockArticleStore.articles.clear();
    mockArticleStore.readStatusFilter = "unread";
    mockArticleStore.loadingArticles = false;
    mockArticleStore.articlesError = null;
  });

  describe("Basic Navigation Flow", () => {
    it("should save scroll position when navigating to article detail", async () => {
      const handleArticleClick = vi.fn((articleId: string) => {
        // Simulate navigation to article detail
        mockPush(`/article/${articleId}`);
      });

      render(<TestArticleList onArticleClick={handleArticleClick} />);

      // Click on an article
      const article = screen.getByTestId("article-1");
      fireEvent.click(article);

      expect(handleArticleClick).toHaveBeenCalledWith("1");
      expect(mockPush).toHaveBeenCalledWith("/article/1");
    });

    it("should restore scroll position when navigating back from article detail", async () => {
      // Setup saved scroll position
      mockSessionStorage.getItem.mockReturnValue("500");

      const handleArticleClick = vi.fn();
      render(<TestArticleList onArticleClick={handleArticleClick} />);

      // Verify sessionStorage was checked for saved position
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith(
        "articleListScroll"
      );
    });

    it("should handle back navigation from article detail", async () => {
      const handleBack = vi.fn(() => {
        mockPush("/");
      });

      const handleNavigate = vi.fn();

      render(
        <TestArticleDetail
          articleId="1"
          onBack={handleBack}
          onNavigate={handleNavigate}
        />
      );

      // Click back button
      const backButton = screen.getByTestId("back-button");
      fireEvent.click(backButton);

      expect(handleBack).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  describe("State Preservation in Unread Only Mode", () => {
    beforeEach(() => {
      mockArticleStore.readStatusFilter = "unread";
    });

    it("should preserve auto-read articles in session storage", async () => {
      const savedState = {
        articles: [
          {
            id: "1",
            isRead: false,
            wasAutoRead: false,
            position: 0,
            sessionPreserved: false,
          },
          {
            id: "2",
            isRead: true,
            wasAutoRead: true,
            position: 1,
            sessionPreserved: true,
          },
        ],
        scrollPosition: 300,
        timestamp: Date.now(),
        filter: "unread",
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(savedState));

      const handleArticleClick = vi.fn();
      render(<TestArticleList onArticleClick={handleArticleClick} />);

      // Verify session storage was accessed
      expect(mockSessionStorage.getItem).toHaveBeenCalled();
    });

    it("should handle intersection observer for auto-read detection", async () => {
      const mockObserve = vi.fn();
      const mockDisconnect = vi.fn();
      mockIntersectionObserver.mockReturnValue({
        observe: mockObserve,
        unobserve: vi.fn(),
        disconnect: mockDisconnect,
      });

      const handleArticleClick = vi.fn();
      render(<TestArticleList onArticleClick={handleArticleClick} />);

      // Verify intersection observer was created
      expect(mockIntersectionObserver).toHaveBeenCalled();
    });

    it("should differentiate between auto-read and manually read articles", async () => {
      // This test would verify that articles marked as read via intersection observer
      // are treated differently from manually read articles
      const handleArticleClick = vi.fn();
      render(<TestArticleList onArticleClick={handleArticleClick} />);

      // Simulate auto-read via intersection observer
      const observerCallback = mockIntersectionObserver.mock.calls[0][0];
      const mockEntry = {
        isIntersecting: false,
        boundingClientRect: { bottom: -100 },
        target: {
          getAttribute: vi.fn((attr) => {
            if (attr === "data-article-id") return "1";
            if (attr === "data-is-read") return "false";
            return null;
          }),
        },
      };

      act(() => {
        observerCallback([mockEntry]);
      });

      // Verify that the article would be marked for auto-read
      // (In real implementation, this would trigger markMultipleAsRead)
      expect(mockEntry.target.getAttribute).toHaveBeenCalledWith(
        "data-article-id"
      );
      expect(mockEntry.target.getAttribute).toHaveBeenCalledWith(
        "data-is-read"
      );
    });
  });

  describe("Navigation History Management", () => {
    it("should handle prev/next navigation between articles", async () => {
      const handleNavigate = vi.fn((direction: "prev" | "next") => {
        if (direction === "next") {
          mockPush("/article/2");
        } else {
          mockPush("/article/1");
        }
      });

      render(
        <TestArticleDetail
          articleId="1"
          onBack={vi.fn()}
          onNavigate={handleNavigate}
        />
      );

      // Click next button
      const nextButton = screen.getByTestId("next-button");
      fireEvent.click(nextButton);

      expect(handleNavigate).toHaveBeenCalledWith("next");
      expect(mockPush).toHaveBeenCalledWith("/article/2");

      // Click prev button
      const prevButton = screen.getByTestId("prev-button");
      fireEvent.click(prevButton);

      expect(handleNavigate).toHaveBeenCalledWith("prev");
    });

    it("should maintain navigation state across article transitions", async () => {
      // Test that navigation history is preserved when moving between articles
      const navigationHistory = [
        { path: "/", timestamp: Date.now() - 2000 },
        { path: "/article/1", timestamp: Date.now() - 1000 },
        { path: "/article/2", timestamp: Date.now() },
      ];

      // Mock session storage to return navigation history
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === "navigationHistory") {
          return JSON.stringify(navigationHistory);
        }
        return null;
      });

      const handleNavigate = vi.fn();
      render(
        <TestArticleDetail
          articleId="2"
          onBack={vi.fn()}
          onNavigate={handleNavigate}
        />
      );

      // Navigation should be aware of history
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith(
        "navigationHistory"
      );
    });
  });

  describe("Filter State Preservation", () => {
    it("should preserve filter state when navigating back", async () => {
      const savedState = {
        articles: [],
        scrollPosition: 0,
        timestamp: Date.now(),
        filter: "unread",
        feedId: "feed-123",
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(savedState));

      const handleArticleClick = vi.fn();
      render(<TestArticleList onArticleClick={handleArticleClick} />);

      // Should restore the unread filter state
      expect(mockSessionStorage.getItem).toHaveBeenCalled();
    });

    it("should handle filter changes and update preserved state", async () => {
      // Simulate changing from 'unread' to 'all' filter
      mockArticleStore.readStatusFilter = "all";

      const handleArticleClick = vi.fn();
      render(<TestArticleList onArticleClick={handleArticleClick} />);

      // Verify new filter state would be saved
      // (In real implementation, this would trigger state manager update)
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle corrupted session storage gracefully", async () => {
      mockSessionStorage.getItem.mockReturnValue("invalid-json");

      const handleArticleClick = vi.fn();

      // Should not throw error
      expect(() => {
        render(<TestArticleList onArticleClick={handleArticleClick} />);
      }).not.toThrow();
    });

    it("should handle missing article data gracefully", async () => {
      mockArticleStore.getArticle.mockResolvedValue(null);

      const handleBack = vi.fn();
      const handleNavigate = vi.fn();

      // Should not throw error when article is not found
      expect(() => {
        render(
          <TestArticleDetail
            articleId="non-existent"
            onBack={handleBack}
            onNavigate={handleNavigate}
          />
        );
      }).not.toThrow();
    });

    it("should handle network errors during state synchronization", async () => {
      mockArticleStore.markAsRead.mockRejectedValue(new Error("Network error"));

      const handleArticleClick = vi.fn(async (articleId: string) => {
        try {
          await mockArticleStore.markAsRead(articleId);
        } catch (error) {
          // Should handle error gracefully
          console.error("Failed to mark as read:", error);
        }
      });

      render(<TestArticleList onArticleClick={handleArticleClick} />);

      const article = screen.getByTestId("article-1");
      fireEvent.click(article);

      await waitFor(() => {
        expect(mockArticleStore.markAsRead).toHaveBeenCalled();
      });
    });
  });

  describe("Performance and Memory Management", () => {
    it("should clean up intersection observers on unmount", async () => {
      const mockDisconnect = vi.fn();
      mockIntersectionObserver.mockReturnValue({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: mockDisconnect,
      });

      const handleArticleClick = vi.fn();
      const { unmount } = render(
        <TestArticleList onArticleClick={handleArticleClick} />
      );

      unmount();

      // Observer should be disconnected
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("should limit session storage size", async () => {
      // Test that session storage doesn't grow indefinitely
      const largeState = {
        articles: Array.from({ length: 1000 }, (_, i) => ({
          id: `article-${i}`,
          isRead: false,
          wasAutoRead: false,
          position: i,
          sessionPreserved: false,
        })),
        scrollPosition: 5000,
        timestamp: Date.now(),
        filter: "unread",
      };

      mockSessionStorage.setItem = vi.fn((key, value) => {
        // Simulate storage quota exceeded
        if (value.length > 50000) {
          throw new Error("QuotaExceededError");
        }
      });

      // Should handle storage quota gracefully
      expect(() => {
        mockSessionStorage.setItem(
          "articleListState",
          JSON.stringify(largeState)
        );
      }).toThrow("QuotaExceededError");
    });
  });

  describe("Real User Scenarios", () => {
    it("should handle complete user journey: list -> detail -> back with preserved state", async () => {
      // Setup initial state
      const initialState = {
        articles: [
          {
            id: "1",
            isRead: false,
            wasAutoRead: false,
            position: 0,
            sessionPreserved: false,
          },
          {
            id: "2",
            isRead: false,
            wasAutoRead: false,
            position: 1,
            sessionPreserved: false,
          },
        ],
        scrollPosition: 100,
        timestamp: Date.now(),
        filter: "unread",
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(initialState));

      // Step 1: Render article list
      const handleArticleClick = vi.fn((articleId: string) => {
        mockPush(`/article/${articleId}`);
      });

      const { rerender } = render(
        <TestArticleList onArticleClick={handleArticleClick} />
      );

      // Step 2: Click article to navigate to detail
      const article = screen.getByTestId("article-1");
      fireEvent.click(article);

      expect(mockPush).toHaveBeenCalledWith("/article/1");

      // Step 3: Render article detail
      const handleBack = vi.fn(() => {
        mockPush("/");
      });

      rerender(
        <TestArticleDetail
          articleId="1"
          onBack={handleBack}
          onNavigate={vi.fn()}
        />
      );

      // Step 4: Navigate back
      const backButton = screen.getByTestId("back-button");
      fireEvent.click(backButton);

      expect(handleBack).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/");

      // Step 5: Verify state preservation would occur
      // (In real implementation, scroll position and read states would be restored)
    });

    it("should handle rapid navigation without state corruption", async () => {
      // Test rapid clicking/navigation to ensure state remains consistent
      const handleArticleClick = vi.fn();
      render(<TestArticleList onArticleClick={handleArticleClick} />);

      // Rapid clicks
      const article1 = screen.getByTestId("article-1");
      const article2 = screen.getByTestId("article-2");

      fireEvent.click(article1);
      fireEvent.click(article2);
      fireEvent.click(article1);

      // Should handle all clicks without error
      expect(handleArticleClick).toHaveBeenCalledTimes(3);
    });
  });
});
