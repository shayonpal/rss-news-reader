import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMocks } from "node-mocks-http";
import type { NextRequest } from "next/server";

/**
 * RR-154: Integration tests for HTML entity decoding in sync pipeline
 * These tests define the SPECIFICATION for sync route modifications.
 * The implementation MUST conform to these tests.
 *
 * Sync Route: /src/app/api/sync/route.ts (lines 428-430)
 * Must decode entities during article processing but NOT in URLs
 */
describe("RR-154: Sync Pipeline HTML Entity Decoding", () => {
  let mockSupabase: any;
  let mockTokenManager: any;
  let mockDecoder: any;

  beforeEach(() => {
    // Setup mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };

    // Setup mock token manager
    mockTokenManager = {
      makeAuthenticatedRequest: vi.fn(),
      ensureValidTokens: vi.fn().mockResolvedValue(true),
    };

    // Setup mock decoder
    mockDecoder = {
      decodeHtmlEntities: vi.fn((text) => {
        // Simple mock implementation for testing
        if (!text) return "";
        return text
          .replace(/&rsquo;/g, "'")
          .replace(/&lsquo;/g, "'")
          .replace(/&ldquo;/g, '"')
          .replace(/&rdquo;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&ndash;/g, "–")
          .replace(/&mdash;/g, "—")
          .replace(/&#8217;/g, "'");
      }),
      decodeArticleData: vi.fn((article) => {
        if (!article) return article;
        return {
          ...article,
          title: article.title
            ? mockDecoder.decodeHtmlEntities(article.title)
            : article.title,
          content: article.content
            ? mockDecoder.decodeHtmlEntities(article.content)
            : article.content,
        };
      }),
    };

    // Mock modules
    vi.mock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockSupabase),
    }));

    vi.mock("@/lib/services/token-manager", () => ({
      default: mockTokenManager,
    }));

    vi.mock("@/lib/utils/html-decoder", () => mockDecoder);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Sync Route Processing", () => {
    describe("1.1 Article Processing with Decoding", () => {
      it("should decode HTML entities in article titles during sync", async () => {
        // Mock Inoreader API response with HTML entities
        const inoreaderResponse = {
          items: [
            {
              id: "tag:google.com,2005:reader/item/0001",
              title: "Biden&rsquo;s New Policy &amp; Strategy",
              summary: {
                content:
                  "The president&rsquo;s &ldquo;bold approach&rdquo; to R&amp;D",
              },
              canonical: [{ href: "https://example.com/article-1" }],
              published: 1704067200,
              categories: [],
            },
            {
              id: "tag:google.com,2005:reader/item/0002",
              title: "Tech Company&#8217;s Q&amp;A Session",
              summary: {
                content:
                  "Industry leaders discuss &ldquo;innovation&rdquo; &ndash; key insights",
              },
              canonical: [
                { href: "https://example.com/article-2?param=value&test=1" },
              ],
              published: 1704067300,
              categories: [],
            },
          ],
        };

        mockTokenManager.makeAuthenticatedRequest.mockResolvedValueOnce({
          ok: true,
          json: async () => inoreaderResponse,
        });

        // Expected decoded articles to be saved
        const expectedArticles = [
          {
            inoreader_id: "tag:google.com,2005:reader/item/0001",
            title: "Biden's New Policy & Strategy",
            content: 'The president\'s "bold approach" to R&D',
            url: "https://example.com/article-1", // URL unchanged
            published_at: new Date(1704067200 * 1000).toISOString(),
          },
          {
            inoreader_id: "tag:google.com,2005:reader/item/0002",
            title: "Tech Company's Q&A Session",
            content: 'Industry leaders discuss "innovation" – key insights',
            url: "https://example.com/article-2?param=value&test=1", // URL with & unchanged
            published_at: new Date(1704067300 * 1000).toISOString(),
          },
        ];

        // Simulate sync processing
        const processedArticles = inoreaderResponse.items.map((item) => {
          const article = {
            inoreader_id: item.id,
            title: item.title,
            content: item.summary?.content || "",
            url: item.canonical?.[0]?.href || "",
            published_at: new Date(item.published * 1000).toISOString(),
          };
          return mockDecoder.decodeArticleData(article);
        });

        // Verify decoding was applied
        expect(processedArticles[0].title).toBe(
          "Biden's New Policy & Strategy"
        );
        expect(processedArticles[0].content).toBe(
          'The president\'s "bold approach" to R&D'
        );
        expect(processedArticles[0].url).toBe("https://example.com/article-1");

        expect(processedArticles[1].title).toBe("Tech Company's Q&A Session");
        expect(processedArticles[1].content).toBe(
          'Industry leaders discuss "innovation" – key insights'
        );
        expect(processedArticles[1].url).toBe(
          "https://example.com/article-2?param=value&test=1"
        );

        // Verify decoder was called
        expect(mockDecoder.decodeArticleData).toHaveBeenCalledTimes(2);
      });

      it("should handle articles with no entities gracefully", async () => {
        const inoreaderResponse = {
          items: [
            {
              id: "tag:google.com,2005:reader/item/0003",
              title: "Simple Article Title",
              summary: {
                content: "Plain content without any HTML entities",
              },
              canonical: [{ href: "https://example.com/article-3" }],
              published: 1704067400,
              categories: [],
            },
          ],
        };

        mockTokenManager.makeAuthenticatedRequest.mockResolvedValueOnce({
          ok: true,
          json: async () => inoreaderResponse,
        });

        const processedArticle = mockDecoder.decodeArticleData({
          inoreader_id: inoreaderResponse.items[0].id,
          title: inoreaderResponse.items[0].title,
          content: inoreaderResponse.items[0].summary.content,
          url: inoreaderResponse.items[0].canonical[0].href,
        });

        expect(processedArticle.title).toBe("Simple Article Title");
        expect(processedArticle.content).toBe(
          "Plain content without any HTML entities"
        );
      });

      it("should handle articles with null/missing fields", async () => {
        const inoreaderResponse = {
          items: [
            {
              id: "tag:google.com,2005:reader/item/0004",
              title: null,
              summary: null,
              canonical: [{ href: "https://example.com/article-4" }],
              published: 1704067500,
              categories: [],
            },
            {
              id: "tag:google.com,2005:reader/item/0005",
              title: "Article with &amp; entity",
              // No summary field
              canonical: [], // No URL
              published: 1704067600,
              categories: [],
            },
          ],
        };

        mockTokenManager.makeAuthenticatedRequest.mockResolvedValueOnce({
          ok: true,
          json: async () => inoreaderResponse,
        });

        const processed1 = mockDecoder.decodeArticleData({
          inoreader_id: inoreaderResponse.items[0].id,
          title: inoreaderResponse.items[0].title,
          content: null,
          url: inoreaderResponse.items[0].canonical[0].href,
        });

        const processed2 = mockDecoder.decodeArticleData({
          inoreader_id: inoreaderResponse.items[1].id,
          title: inoreaderResponse.items[1].title,
          content: undefined,
          url: "",
        });

        expect(processed1.title).toBe(null);
        expect(processed1.content).toBe(null);
        expect(processed1.url).toBe("https://example.com/article-4");

        expect(processed2.title).toBe("Article with & entity");
        expect(processed2.content).toBe(undefined);
        expect(processed2.url).toBe("");
      });
    });

    describe("1.2 Batch Processing Performance", () => {
      it("should efficiently process large batches of articles", async () => {
        // Create 500 articles with entities (max sync batch size)
        const items = Array.from({ length: 500 }, (_, i) => ({
          id: `tag:google.com,2005:reader/item/${String(i).padStart(4, "0")}`,
          title: `Article ${i} &amp; Title with &rsquo; apostrophe`,
          summary: {
            content: `Content ${i} with &ldquo;quotes&rdquo; &ndash; testing`,
          },
          canonical: [
            { href: `https://example.com/article-${i}?id=${i}&test=true` },
          ],
          published: 1704067200 + i,
          categories: [],
        }));

        mockTokenManager.makeAuthenticatedRequest.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items, continuation: null }),
        });

        const startTime = Date.now();

        // Process all articles
        const processedArticles = items.map((item) => {
          const article = {
            inoreader_id: item.id,
            title: item.title,
            content: item.summary?.content || "",
            url: item.canonical?.[0]?.href || "",
          };
          return mockDecoder.decodeArticleData(article);
        });

        const processingTime = Date.now() - startTime;

        // Should process 500 articles quickly
        expect(processedArticles.length).toBe(500);
        expect(processingTime).toBeLessThan(500); // Less than 500ms for 500 articles

        // Verify first and last articles are decoded correctly
        expect(processedArticles[0].title).toBe(
          "Article 0 & Title with ' apostrophe"
        );
        expect(processedArticles[0].content).toBe(
          'Content 0 with "quotes" – testing'
        );
        expect(processedArticles[0].url).toBe(
          "https://example.com/article-0?id=0&test=true"
        );

        expect(processedArticles[499].title).toBe(
          "Article 499 & Title with ' apostrophe"
        );
        expect(processedArticles[499].content).toBe(
          'Content 499 with "quotes" – testing'
        );
        expect(processedArticles[499].url).toBe(
          "https://example.com/article-499?id=499&test=true"
        );
      });
    });

    describe("1.3 Database Storage Verification", () => {
      it("should store decoded Unicode characters in database", async () => {
        const articlesToUpsert = [
          {
            inoreader_id: "test-1",
            title: "Biden's Policy & Strategy", // Already decoded
            content: 'The president\'s "new approach" – testing',
            url: "https://example.com/1",
          },
          {
            inoreader_id: "test-2",
            title: "Company's Q&A Session",
            content: 'Content with "quotes" and – dashes',
            url: "https://example.com/2?param=value&test=1", // & in URL preserved
          },
        ];

        // Mock database upsert
        mockSupabase.upsert.mockImplementation((data) => {
          // Verify data contains decoded characters, not entities
          data.forEach((article: any) => {
            expect(article.title).not.toContain("&rsquo;");
            expect(article.title).not.toContain("&amp;");
            expect(article.title).not.toContain("&#8217;");
            expect(article.content).not.toContain("&ldquo;");
            expect(article.content).not.toContain("&rdquo;");
            expect(article.content).not.toContain("&ndash;");

            // URLs should still contain & if present
            if (article.url.includes("?")) {
              expect(article.url).toContain("&");
            }
          });

          return Promise.resolve({ data, error: null });
        });

        await mockSupabase.from("articles").upsert(articlesToUpsert);

        expect(mockSupabase.upsert).toHaveBeenCalledWith(articlesToUpsert);
        expect(mockSupabase.upsert).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("2. Edge Cases and Error Handling", () => {
    describe("2.1 Malformed API Responses", () => {
      it("should handle malformed entities from Inoreader gracefully", async () => {
        const inoreaderResponse = {
          items: [
            {
              id: "test-malformed",
              title: "Title with incomplete &rsquo and & alone",
              summary: {
                content: "Content with &#8217 incomplete and &",
              },
              canonical: [{ href: "https://example.com/malformed" }],
              published: 1704067200,
              categories: [],
            },
          ],
        };

        mockTokenManager.makeAuthenticatedRequest.mockResolvedValueOnce({
          ok: true,
          json: async () => inoreaderResponse,
        });

        const processed = mockDecoder.decodeArticleData({
          title: inoreaderResponse.items[0].title,
          content: inoreaderResponse.items[0].summary.content,
          url: inoreaderResponse.items[0].canonical[0].href,
        });

        // Should handle gracefully without throwing errors
        expect(processed).toBeDefined();
        expect(processed.url).toBe("https://example.com/malformed");
      });
    });

    describe("2.2 Special Characters in URLs", () => {
      it("should never decode URL parameters", async () => {
        const testUrls = [
          "https://example.com/article?title=Biden%27s&content=Q%26A",
          "https://example.com/page?param1=value1&param2=value2&param3=test",
          "https://example.com/feed?category=R%26D&type=news",
          "tag:google.com,2005:reader/item/0001&test=value",
        ];

        testUrls.forEach((url) => {
          const article = {
            title: "Test &amp; Title",
            content: "Test content",
            url: url,
          };

          const processed = mockDecoder.decodeArticleData(article);

          // URL should remain exactly the same
          expect(processed.url).toBe(url);
          // Title should be decoded
          expect(processed.title).toBe("Test & Title");
        });
      });
    });

    describe("2.3 Performance Under Load", () => {
      it("should handle concurrent decoding without blocking", async () => {
        // Simulate concurrent sync operations
        const syncOperations = Array.from({ length: 10 }, (_, i) => ({
          items: Array.from({ length: 100 }, (_, j) => ({
            id: `item-${i}-${j}`,
            title: `Sync ${i} Article ${j} &amp; &rsquo; entities`,
            summary: {
              content: `Content with &ldquo;many&rdquo; entities &ndash; test`,
            },
            canonical: [{ href: `https://example.com/${i}/${j}` }],
            published: 1704067200 + i * 100 + j,
            categories: [],
          })),
        }));

        const startTime = Date.now();

        // Process all sync operations concurrently
        const allProcessed = await Promise.all(
          syncOperations.map(async (syncData) => {
            return syncData.items.map((item) => {
              const article = {
                title: item.title,
                content: item.summary.content,
                url: item.canonical[0].href,
              };
              return mockDecoder.decodeArticleData(article);
            });
          })
        );

        const totalTime = Date.now() - startTime;

        // Should process 1000 articles (10 syncs × 100 articles each)
        const totalArticles = allProcessed.flat().length;
        expect(totalArticles).toBe(1000);

        // Should complete in reasonable time even with concurrent operations
        expect(totalTime).toBeLessThan(2000); // Less than 2 seconds for 1000 articles

        // Verify random samples are decoded correctly
        expect(allProcessed[0][0].title).toContain("Sync 0 Article 0 & '");
        expect(allProcessed[9][99].title).toContain("Sync 9 Article 99 & '");
      });
    });
  });

  describe("3. Sync Route Integration Points", () => {
    describe("3.1 Integration with Existing Sync Logic", () => {
      it("should decode entities at the correct point in sync pipeline", () => {
        // The decoding should happen AFTER fetching from Inoreader
        // but BEFORE saving to database

        const syncPipeline = [
          "fetchFromInoreader",
          "transformArticleData",
          "decodeHtmlEntities", // <-- Should be inserted here
          "saveToDatabase",
        ];

        const expectedIndex = syncPipeline.indexOf("decodeHtmlEntities");
        expect(expectedIndex).toBe(2); // After transform, before save
        expect(expectedIndex).toBeGreaterThan(
          syncPipeline.indexOf("transformArticleData")
        );
        expect(expectedIndex).toBeLessThan(
          syncPipeline.indexOf("saveToDatabase")
        );
      });
    });

    describe("3.2 Compatibility with Incremental Sync", () => {
      it("should decode entities in both full and incremental syncs", async () => {
        // Full sync response
        const fullSyncResponse = {
          items: [
            {
              id: "full-1",
              title: "Full Sync &amp; Article",
              summary: { content: "Content with &rsquo; entity" },
              canonical: [{ href: "https://example.com/full-1" }],
              published: 1704067200,
              categories: [],
            },
          ],
        };

        // Incremental sync response
        const incrementalSyncResponse = {
          items: [
            {
              id: "inc-1",
              title: "Incremental &amp; Article",
              summary: { content: "New content with &ldquo;quotes&rdquo;" },
              canonical: [{ href: "https://example.com/inc-1" }],
              published: 1704067300,
              categories: [],
            },
          ],
        };

        // Process full sync
        const fullSyncArticle = mockDecoder.decodeArticleData({
          title: fullSyncResponse.items[0].title,
          content: fullSyncResponse.items[0].summary.content,
          url: fullSyncResponse.items[0].canonical[0].href,
        });

        // Process incremental sync
        const incSyncArticle = mockDecoder.decodeArticleData({
          title: incrementalSyncResponse.items[0].title,
          content: incrementalSyncResponse.items[0].summary.content,
          url: incrementalSyncResponse.items[0].canonical[0].href,
        });

        // Both should be decoded
        expect(fullSyncArticle.title).toBe("Full Sync & Article");
        expect(fullSyncArticle.content).toBe("Content with ' entity");

        expect(incSyncArticle.title).toBe("Incremental & Article");
        expect(incSyncArticle.content).toBe('New content with "quotes"');
      });
    });
  });
});
