import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/sync/route";
import { getAdminClient } from "@/lib/db/supabase-admin";

describe("RR-154: Sync Pipeline HTML Entity Decoding Integration", () => {
  let mockSupabase: any;
  let capturedUpsertData: any[] = [];
  let mockTokenManager: any;

  beforeEach(() => {
    // Clear captured data
    capturedUpsertData = [];

    // Mock the token manager with articles containing HTML entities
    mockTokenManager = vi.fn().mockImplementation(() => ({
      getAccessToken: vi.fn().mockResolvedValue("mock-token"),
      makeAuthenticatedRequest: vi.fn().mockImplementation((url) => {
        if (url.includes("subscription/list")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                subscriptions: [
                  {
                    id: "feed/http://example.com/feed",
                    title: "Tech &amp; Innovation Feed",
                    url: "http://example.com/feed",
                    categories: [],
                  },
                ],
              }),
          });
        }
        if (url.includes("unread-count")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                unreadcounts: [],
              }),
          });
        }
        if (url.includes("stream/contents")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                items: [
                  {
                    id: "tag:google.com,2005:reader/item/encoded-title",
                    title:
                      "Johnson &amp; Johnson&rsquo;s Q3 Results &ndash; &quot;Record Breaking&quot;",
                    author: "Financial Reporter",
                    content: {
                      content:
                        '&lt;p&gt;Johnson &amp; Johnson announced today that it&rsquo;s launching a &quot;breakthrough&quot; treatment. The company&rsquo;s CEO said, &quot;This represents a new era &ndash; one of innovation &amp; progress.&quot;&lt;/p&gt;&lt;p&gt;Visit &lt;a href="https://jnj.com?source=press&amp;utm_medium=email"&gt;their website&lt;/a&gt; for more details.&lt;/p&gt;',
                    },
                    canonical: [{ href: "http://example.com/jnj-results" }],
                    published: Math.floor(Date.now() / 1000),
                    categories: [],
                    origin: { streamId: "feed/http://example.com/feed" },
                  },
                  {
                    id: "tag:google.com,2005:reader/item/mixed-entities",
                    title:
                      "&lsquo;AI Revolution&rsquo; &amp; Tech Giants&rsquo; Response",
                    author: "Tech Analyst",
                    content: {
                      content:
                        "&lt;div class=&quot;article-body&quot;&gt;&lt;h2&gt;Breaking News&lt;/h2&gt;&lt;p&gt;The AI revolution is here &ndash; and tech companies can&rsquo;t ignore it. Apple, Google &amp; Microsoft are racing to integrate AI into their platforms.&lt;/p&gt;&lt;p&gt;As one expert noted: &quot;We&rsquo;re at an inflection point.&quot;&lt;/p&gt;&lt;/div&gt;",
                    },
                    canonical: [{ href: "http://example.com/ai-revolution" }],
                    published: Math.floor(Date.now() / 1000),
                    categories: ["user/-/state/com.google/read"],
                    origin: { streamId: "feed/http://example.com/feed" },
                  },
                  {
                    id: "tag:google.com,2005:reader/item/no-entities",
                    title: "Plain Title Without Entities",
                    author: "Regular Author",
                    content: {
                      content:
                        "<p>This content has no HTML entities to decode.</p><p>Just regular text with normal punctuation.</p>",
                    },
                    canonical: [{ href: "http://example.com/plain-article" }],
                    published: Math.floor(Date.now() / 1000),
                    categories: ["user/-/state/com.google/starred"],
                    origin: { streamId: "feed/http://example.com/feed" },
                  },
                  {
                    id: "tag:google.com,2005:reader/item/null-content",
                    title: "Article &amp; Missing Content",
                    author: null,
                    content: null, // Null content to test graceful handling
                    canonical: [{ href: "http://example.com/null-content" }],
                    published: Math.floor(Date.now() / 1000),
                    categories: [],
                    origin: { streamId: "feed/http://example.com/feed" },
                  },
                ],
              }),
          });
        }
        return Promise.resolve({
          ok: false,
          statusText: "Not Found",
        });
      }),
    }));

    // Mock the token manager import
    vi.mock("../../../../server/lib/token-manager.js", () => ({
      default: mockTokenManager,
    }));

    // Mock Supabase to capture what gets upserted
    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "articles") {
          return {
            upsert: vi.fn((data: any) => {
              // Capture the data that would be upserted
              capturedUpsertData.push(...(Array.isArray(data) ? data : [data]));
              return Promise.resolve({ data: null, error: null });
            }),
            select: vi.fn(() => ({
              in: vi.fn(() => Promise.resolve({ data: [] })), // No existing articles
            })),
          };
        }
        if (table === "sync_queue") {
          return {
            delete: vi.fn(() => ({
              in: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: table === "users" ? { id: "user-123" } : null,
              }),
            })),
          })),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          delete: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    // Mock the getAdminClient function
    vi.mock("@/lib/db/supabase-admin", () => ({
      getAdminClient: vi.fn(() => mockSupabase),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should decode HTML entities in article titles during sync", async () => {
    // Call the sync endpoint
    const response = await POST();
    const data = await response.json();

    // Verify the sync started successfully
    expect(data.success).toBe(true);
    expect(data.syncId).toBeDefined();

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check that articles were upserted with decoded titles
    const articlesUpserted = capturedUpsertData.filter((item) =>
      item.hasOwnProperty("inoreader_id")
    );

    expect(articlesUpserted.length).toBeGreaterThan(0);

    // Find and verify the article with encoded title
    const articleWithEncodedTitle = articlesUpserted.find(
      (a) => a.inoreader_id === "tag:google.com,2005:reader/item/encoded-title"
    );

    expect(articleWithEncodedTitle).toBeDefined();
    expect(articleWithEncodedTitle.title).toBe(
      'Johnson & Johnson\u2019s Q3 Results – "Record Breaking"'
    );

    // Find and verify the article with mixed entities
    const articleWithMixedEntities = articlesUpserted.find(
      (a) => a.inoreader_id === "tag:google.com,2005:reader/item/mixed-entities"
    );

    expect(articleWithMixedEntities).toBeDefined();
    expect(articleWithMixedEntities.title).toBe(
      "\u2018AI Revolution\u2019 & Tech Giants\u2019 Response"
    );

    // Find and verify the article with no entities (should remain unchanged)
    const articleWithoutEntities = articlesUpserted.find(
      (a) => a.inoreader_id === "tag:google.com,2005:reader/item/no-entities"
    );

    expect(articleWithoutEntities).toBeDefined();
    expect(articleWithoutEntities.title).toBe("Plain Title Without Entities");

    // Find and verify the article with null content but encoded title
    const articleWithNullContent = articlesUpserted.find(
      (a) => a.inoreader_id === "tag:google.com,2005:reader/item/null-content"
    );

    expect(articleWithNullContent).toBeDefined();
    expect(articleWithNullContent.title).toBe("Article & Missing Content");
  });

  it("should decode HTML entities in article content during sync", async () => {
    // Call the sync endpoint
    const response = await POST();
    const data = await response.json();

    expect(data.success).toBe(true);

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    const articlesUpserted = capturedUpsertData.filter((item) =>
      item.hasOwnProperty("inoreader_id")
    );

    // Find and verify the article with encoded content
    const articleWithEncodedContent = articlesUpserted.find(
      (a) => a.inoreader_id === "tag:google.com,2005:reader/item/encoded-title"
    );

    expect(articleWithEncodedContent).toBeDefined();
    expect(articleWithEncodedContent.content).toBe(
      '<p>Johnson & Johnson announced today that it\u2019s launching a "breakthrough" treatment. The company\u2019s CEO said, "This represents a new era – one of innovation & progress."</p><p>Visit <a href="https://jnj.com?source=press&utm_medium=email">their website</a> for more details.</p>'
    );

    // Find and verify the article with mixed entities in content
    const articleWithMixedContent = articlesUpserted.find(
      (a) => a.inoreader_id === "tag:google.com,2005:reader/item/mixed-entities"
    );

    expect(articleWithMixedContent).toBeDefined();
    expect(articleWithMixedContent.content).toBe(
      '<div class="article-body"><h2>Breaking News</h2><p>The AI revolution is here – and tech companies can\u2019t ignore it. Apple, Google & Microsoft are racing to integrate AI into their platforms.</p><p>As one expert noted: "We\u2019re at an inflection point."</p></div>'
    );

    // Verify plain content remains unchanged
    const articleWithPlainContent = articlesUpserted.find(
      (a) => a.inoreader_id === "tag:google.com,2005:reader/item/no-entities"
    );

    expect(articleWithPlainContent).toBeDefined();
    expect(articleWithPlainContent.content).toBe(
      "<p>This content has no HTML entities to decode.</p><p>Just regular text with normal punctuation.</p>"
    );

    // Verify null content is handled gracefully
    const articleWithNullContent = articlesUpserted.find(
      (a) => a.inoreader_id === "tag:google.com,2005:reader/item/null-content"
    );

    expect(articleWithNullContent).toBeDefined();
    expect(articleWithNullContent.content).toBe(""); // Should be empty string, not null
  });

  it("should preserve URLs and query parameters in content", async () => {
    const response = await POST();
    expect(response.ok).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const articlesUpserted = capturedUpsertData.filter((item) =>
      item.hasOwnProperty("inoreader_id")
    );

    const articleWithUrl = articlesUpserted.find(
      (a) => a.inoreader_id === "tag:google.com,2005:reader/item/encoded-title"
    );

    expect(articleWithUrl).toBeDefined();
    expect(articleWithUrl.content).toContain(
      "https://jnj.com?source=press&utm_medium=email"
    );
    expect(articleWithUrl.content).toContain(
      '<a href="https://jnj.com?source=press&utm_medium=email">'
    );
  });

  it("should maintain article metadata during HTML entity decoding", async () => {
    const response = await POST();
    expect(response.ok).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const articlesUpserted = capturedUpsertData.filter((item) =>
      item.hasOwnProperty("inoreader_id")
    );

    articlesUpserted.forEach((article) => {
      // Verify all required fields are present
      expect(article).toHaveProperty("feed_id");
      expect(article).toHaveProperty("inoreader_id");
      expect(article).toHaveProperty("title");
      expect(article).toHaveProperty("content");
      expect(article).toHaveProperty("url");
      expect(article).toHaveProperty("published_at");
      expect(article).toHaveProperty("is_read");
      expect(article).toHaveProperty("is_starred");
      expect(article).toHaveProperty("last_sync_update");

      // Verify title and content are strings (not null)
      expect(typeof article.title).toBe("string");
      expect(typeof article.content).toBe("string");

      // Verify URLs are preserved
      expect(article.url).toMatch(/^https?:\/\//);
    });

    // Verify read/starred status is preserved during decoding
    const readArticle = articlesUpserted.find(
      (a) => a.inoreader_id === "tag:google.com,2005:reader/item/mixed-entities"
    );
    expect(readArticle?.is_read).toBe(true);

    const starredArticle = articlesUpserted.find(
      (a) => a.inoreader_id === "tag:google.com,2005:reader/item/no-entities"
    );
    expect(starredArticle?.is_starred).toBe(true);
  });

  it("should handle sync performance requirements with HTML decoding", async () => {
    // Override the mock to return many articles with HTML entities
    const manyArticles = Array.from({ length: 200 }, (_, i) => ({
      id: `tag:google.com,2005:reader/item/perf-test-${i}`,
      title: `Performance Test ${i} &amp; Company&rsquo;s Results &ndash; &quot;Breaking&quot;`,
      author: `Author ${i}`,
      content: {
        content: `&lt;p&gt;Performance test content ${i} with &quot;quotes&quot; and &amp; symbols. The company&rsquo;s CEO announced &ndash; &quot;This is revolutionary.&quot;&lt;/p&gt;`,
      },
      canonical: [{ href: `http://example.com/perf-${i}` }],
      published: Math.floor(Date.now() / 1000),
      categories: [],
      origin: { streamId: "feed/http://example.com/feed" },
    }));

    mockTokenManager.mockImplementation(() => ({
      getAccessToken: vi.fn().mockResolvedValue("mock-token"),
      makeAuthenticatedRequest: vi.fn().mockImplementation((url) => {
        if (url.includes("subscription/list")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                subscriptions: [
                  {
                    id: "feed/http://example.com/feed",
                    title: "Performance Test Feed",
                    url: "http://example.com/feed",
                    categories: [],
                  },
                ],
              }),
          });
        }
        if (url.includes("stream/contents")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: manyArticles }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }),
    }));

    const start = performance.now();
    const response = await POST();
    const duration = performance.now() - start;

    expect(response.ok).toBe(true);

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 500));

    const articlesUpserted = capturedUpsertData.filter((item) =>
      item.hasOwnProperty("inoreader_id")
    );

    expect(articlesUpserted.length).toBe(200);

    // Verify all articles have decoded entities
    articlesUpserted.forEach((article, i) => {
      expect(article.title).toBe(
        `Performance Test ${i} & Company\u2019s Results – "Breaking"`
      );
      expect(article.content).toContain("<p>");
      expect(article.content).toContain('"quotes"');
      expect(article.content).toContain("& symbols");
      expect(article.content).toContain(
        'CEO announced – "This is revolutionary."'
      );
    });

    // Performance should be reasonable even with HTML decoding
    // This is more lenient since we're adding HTML decoding overhead
    expect(duration).toBeLessThan(5000); // 5 seconds for 200 articles with HTML decoding
  });

  it("should handle malformed HTML entities gracefully during sync", async () => {
    // Override mock with malformed entities
    mockTokenManager.mockImplementation(() => ({
      getAccessToken: vi.fn().mockResolvedValue("mock-token"),
      makeAuthenticatedRequest: vi.fn().mockImplementation((url) => {
        if (url.includes("stream/contents")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                items: [
                  {
                    id: "tag:google.com,2005:reader/item/malformed",
                    title:
                      "Malformed &amp;&rsquo;&quot; &incomplete; &invalid entities",
                    content: {
                      content:
                        "&lt;p&gt;Content with &malformed; and &amp incomplete entities&lt;/p&gt;",
                    },
                    canonical: [{ href: "http://example.com/malformed" }],
                    published: Math.floor(Date.now() / 1000),
                    categories: [],
                    origin: { streamId: "feed/http://example.com/feed" },
                  },
                ],
              }),
          });
        }
        if (url.includes("subscription/list")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                subscriptions: [
                  {
                    id: "feed/http://example.com/feed",
                    title: "Test Feed",
                    url: "http://example.com/feed",
                    categories: [],
                  },
                ],
              }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }),
    }));

    const response = await POST();
    expect(response.ok).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const articlesUpserted = capturedUpsertData.filter((item) =>
      item.hasOwnProperty("inoreader_id")
    );

    expect(articlesUpserted.length).toBe(1);

    const article = articlesUpserted[0];

    // Should decode valid entities and leave malformed ones as-is
    expect(article.title).toContain("&'\" "); // Valid entities decoded
    expect(article.title).toContain("&incomplete;"); // Invalid entities left as-is
    expect(article.title).toContain("&invalid"); // Invalid entities left as-is

    expect(article.content).toContain("<p>Content with");
    expect(article.content).toContain("&malformed;"); // Invalid entity left as-is
    expect(article.content).toContain("& incomplete"); // Valid & decoded
  });
});
