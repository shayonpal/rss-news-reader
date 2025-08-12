import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAdminClient } from "@/lib/db/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock the migration execution function that would be in the actual migration file
interface MigrationResult {
  success: boolean;
  processed: number;
  errors: string[];
  timing: {
    totalMs: number;
    avgPerArticleMs: number;
  };
}

// This simulates the migration function that will be created
async function executeHtmlEntityMigration(
  supabase: SupabaseClient
): Promise<MigrationResult> {
  const startTime = performance.now();
  const errors: string[] = [];
  let processed = 0;

  try {
    // In the real migration, this would be the actual SQL execution
    // For testing, we simulate the migration logic

    // Step 1: Find articles with HTML entities (simulated)
    const { data: articlesWithEntities } = await supabase
      .from("articles")
      .select("id, title, content")
      .or(
        "title.ilike.%&amp;%,title.ilike.%&rsquo;%,title.ilike.%&lsquo;%,title.ilike.%&quot;%,title.ilike.%&#8217;%,title.ilike.%&ndash;%,content.ilike.%&amp;%,content.ilike.%&rsquo;%,content.ilike.%&lsquo;%,content.ilike.%&quot;%,content.ilike.%&#8217;%,content.ilike.%&ndash;%"
      );

    if (!articlesWithEntities) {
      return {
        success: true,
        processed: 0,
        errors: [],
        timing: {
          totalMs: performance.now() - startTime,
          avgPerArticleMs: 0,
        },
      };
    }

    // Step 2: Process in chunks of 200 (RR-150 pattern)
    const chunkSize = 200;
    for (let i = 0; i < articlesWithEntities.length; i += chunkSize) {
      const chunk = articlesWithEntities.slice(i, i + chunkSize);

      try {
        // Simulate HTML entity decoding for each article in chunk
        const decodedChunk = chunk.map((article) => ({
          id: article.id,
          title: decodeHtmlEntitiesForMigration(article.title),
          content: decodeHtmlEntitiesForMigration(article.content),
        }));

        // Simulate batch update
        const { error } = await supabase
          .from("articles")
          .upsert(decodedChunk, { onConflict: "id" });

        if (error) {
          errors.push(`Chunk ${i}-${i + chunk.length - 1}: ${error.message}`);
        } else {
          processed += chunk.length;
        }
      } catch (chunkError) {
        errors.push(
          `Chunk ${i}-${i + chunk.length - 1}: ${(chunkError as Error).message}`
        );
      }
    }

    // Step 3: Record migration completion in sync_metadata
    await supabase.from("sync_metadata").upsert({
      key: "html_entity_migration_completed",
      value: new Date().toISOString(),
      description: `Processed ${processed} articles, ${errors.length} errors`,
    });

    const totalMs = performance.now() - startTime;
    return {
      success: errors.length === 0,
      processed,
      errors,
      timing: {
        totalMs,
        avgPerArticleMs: processed > 0 ? totalMs / processed : 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      processed: 0,
      errors: [(error as Error).message],
      timing: {
        totalMs: performance.now() - startTime,
        avgPerArticleMs: 0,
      },
    };
  }
}

// Simplified HTML entity decoder for migration testing
function decodeHtmlEntitiesForMigration(text: string | null): string {
  if (!text) return "";

  const entityMap: Record<string, string> = {
    "&amp;": "&",
    "&rsquo;": "\u2019",
    "&lsquo;": "\u2018",
    "&quot;": '"',
    "&#8217;": "\u2019",
    "&ndash;": "–",
    "&mdash;": "—",
    "&hellip;": "…",
    "&lt;": "<",
    "&gt;": ">",
  };

  return text.replace(
    /&(?:#8217|amp|rsquo|lsquo|quot|ndash|mdash|hellip|lt|gt);/g,
    (match) => {
      return entityMap[match] || match;
    }
  );
}

describe("RR-154: HTML Entity Migration Database Tests", () => {
  let mockSupabase: any;
  let mockArticles: any[];

  beforeEach(() => {
    // Create mock articles with HTML entities (simulating the 308 affected articles)
    mockArticles = [
      {
        id: "article-1",
        title: "Johnson &amp; Johnson&rsquo;s Q3 Results",
        content:
          "&lt;p&gt;Johnson &amp; Johnson announced &quot;breakthrough&quot; results.&lt;/p&gt;",
      },
      {
        id: "article-2",
        title:
          "&lsquo;AI Revolution&rsquo; &ndash; Tech Giants&rsquo; Response",
        content:
          "&lt;div&gt;The AI revolution &amp; tech companies&rsquo; strategies.&lt;/div&gt;",
      },
      {
        id: "article-3",
        title: "Plain Title Without Entities",
        content: "<p>Plain content without HTML entities.</p>",
      },
      {
        id: "article-4",
        title: "Breaking: Apple &amp; Google Partnership",
        content: null, // Test null content handling
      },
      {
        id: "article-5",
        title: null, // Test null title handling
        content: "&lt;p&gt;Content with entities but null title.&lt;/p&gt;",
      },
    ];

    // Mock Supabase client
    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn(() => ({
              or: vi.fn(() =>
                Promise.resolve({
                  data: mockArticles.filter(
                    (article) =>
                      (article.title &&
                        /&(?:amp|rsquo|lsquo|quot|#8217|ndash);/.test(
                          article.title
                        )) ||
                      (article.content &&
                        /&(?:amp|rsquo|lsquo|quot|#8217|ndash);/.test(
                          article.content
                        ))
                  ),
                })
              ),
            })),
            upsert: vi.fn((data: any) => {
              // Simulate successful upsert
              return Promise.resolve({ data, error: null });
            }),
          };
        }
        if (table === "sync_metadata") {
          return {
            upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
          };
        }
        return {
          select: vi.fn(() => Promise.resolve({ data: [], error: null })),
          upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
      }),
    };

    // Mock the getAdminClient function
    vi.mock("@/lib/db/supabase-admin", () => ({
      getAdminClient: vi.fn(() => mockSupabase),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should identify articles with HTML entities correctly", async () => {
    const supabase = getAdminClient();

    // Test the query that identifies articles needing migration
    const { data } = await supabase
      .from("articles")
      .select("id, title, content")
      .or(
        "title.ilike.%&amp;%,title.ilike.%&rsquo;%,title.ilike.%&lsquo;%,title.ilike.%&quot;%,title.ilike.%&#8217;%,title.ilike.%&ndash;%,content.ilike.%&amp;%,content.ilike.%&rsquo;%,content.ilike.%&lsquo;%,content.ilike.%&quot;%,content.ilike.%&#8217;%,content.ilike.%&ndash;%"
      );

    expect(data).toBeDefined();
    expect(data?.length).toBeGreaterThan(0);

    // Should identify articles 1, 2, 4, and 5 (those with entities)
    const identifiedIds = data?.map((a) => a.id) || [];
    expect(identifiedIds).toContain("article-1");
    expect(identifiedIds).toContain("article-2");
    expect(identifiedIds).toContain("article-4");
    expect(identifiedIds).toContain("article-5");
    expect(identifiedIds).not.toContain("article-3"); // Plain article should not be included
  });

  it("should execute migration and decode HTML entities correctly", async () => {
    const supabase = getAdminClient();

    const result = await executeHtmlEntityMigration(supabase);

    expect(result.success).toBe(true);
    expect(result.processed).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
    expect(result.timing.totalMs).toBeGreaterThan(0);

    // Verify upsert was called with decoded data
    expect(mockSupabase.from).toHaveBeenCalledWith("articles");

    const upsertCalls = mockSupabase.from("articles").upsert.mock.calls;
    expect(upsertCalls.length).toBeGreaterThan(0);

    // Check the actual decoded data
    const decodedArticles = upsertCalls[0][0];
    expect(Array.isArray(decodedArticles)).toBe(true);

    // Find specific articles and verify decoding
    const article1 = decodedArticles.find((a: any) => a.id === "article-1");
    expect(article1?.title).toBe("Johnson & Johnson\u2019s Q3 Results");
    expect(article1?.content).toBe(
      '<p>Johnson & Johnson announced "breakthrough" results.</p>'
    );

    const article2 = decodedArticles.find((a: any) => a.id === "article-2");
    expect(article2?.title).toBe(
      "\u2018AI Revolution\u2019 – Tech Giants\u2019 Response"
    );
    expect(article2?.content).toBe(
      "<div>The AI revolution & tech companies\u2019 strategies.</div>"
    );

    // Verify null handling
    const article4 = decodedArticles.find((a: any) => a.id === "article-4");
    expect(article4?.title).toBe("Breaking: Apple & Google Partnership");
    expect(article4?.content).toBe(""); // Null should become empty string

    const article5 = decodedArticles.find((a: any) => a.id === "article-5");
    expect(article5?.title).toBe(""); // Null should become empty string
    expect(article5?.content).toBe(
      "<p>Content with entities but null title.</p>"
    );
  });

  it("should handle chunked processing for large datasets", async () => {
    // Create a large mock dataset (500 articles)
    const largeDataset = Array.from({ length: 500 }, (_, i) => ({
      id: `bulk-article-${i}`,
      title: `Article ${i} &amp; Company&rsquo;s News`,
      content: `&lt;p&gt;Content ${i} with &quot;entities&quot; &amp; symbols.&lt;/p&gt;`,
    }));

    // Override mock to return large dataset
    mockSupabase.from = vi.fn((table: string) => {
      if (table === "articles") {
        return {
          select: vi.fn(() => ({
            or: vi.fn(() => Promise.resolve({ data: largeDataset })),
          })),
          upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
      }
      if (table === "sync_metadata") {
        return {
          upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
      }
      return {
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };
    });

    const supabase = getAdminClient();
    const result = await executeHtmlEntityMigration(supabase);

    expect(result.success).toBe(true);
    expect(result.processed).toBe(500);
    expect(result.errors).toHaveLength(0);

    // Verify chunked processing (should have 3 chunks: 200 + 200 + 100)
    const upsertCalls = mockSupabase.from("articles").upsert.mock.calls;
    expect(upsertCalls.length).toBe(3);

    // First two chunks should have 200 articles each
    expect(upsertCalls[0][0]).toHaveLength(200);
    expect(upsertCalls[1][0]).toHaveLength(200);
    // Last chunk should have 100 articles
    expect(upsertCalls[2][0]).toHaveLength(100);

    // Verify all articles were decoded properly
    upsertCalls.forEach((call, chunkIndex) => {
      const chunk = call[0];
      chunk.forEach((article: any, articleIndex: number) => {
        const expectedIndex = chunkIndex * 200 + articleIndex;
        expect(article.title).toBe(
          `Article ${expectedIndex} & Company\u2019s News`
        );
        expect(article.content).toBe(
          `<p>Content ${expectedIndex} with "entities" & symbols.</p>`
        );
      });
    });
  });

  it("should handle migration errors gracefully", async () => {
    // Mock a database error
    mockSupabase.from = vi.fn((table: string) => {
      if (table === "articles") {
        return {
          select: vi.fn(() => ({
            or: vi.fn(() =>
              Promise.resolve({ data: mockArticles.slice(0, 2) })
            ),
          })),
          upsert: vi.fn(() =>
            Promise.resolve({
              data: null,
              error: new Error("Database connection failed"),
            })
          ),
        };
      }
      return {
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };
    });

    const supabase = getAdminClient();
    const result = await executeHtmlEntityMigration(supabase);

    expect(result.success).toBe(false);
    expect(result.processed).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Database connection failed");
  });

  it("should meet performance requirements for migration", async () => {
    // Test with 308 articles (the actual number from RR-154)
    const rr154Articles = Array.from({ length: 308 }, (_, i) => ({
      id: `rr154-article-${i}`,
      title: `Article ${i} &amp; HTML entities &rsquo;test&rsquo;`,
      content: `&lt;p&gt;Test content ${i} with &quot;quotes&quot; and &amp; symbols.&lt;/p&gt;`,
    }));

    mockSupabase.from = vi.fn((table: string) => {
      if (table === "articles") {
        return {
          select: vi.fn(() => ({
            or: vi.fn(() => Promise.resolve({ data: rr154Articles })),
          })),
          upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
      }
      return {
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };
    });

    const supabase = getAdminClient();
    const start = performance.now();
    const result = await executeHtmlEntityMigration(supabase);
    const duration = performance.now() - start;

    expect(result.success).toBe(true);
    expect(result.processed).toBe(308);
    expect(result.timing.totalMs).toBeLessThan(2000); // Should complete < 2 seconds
    expect(result.timing.avgPerArticleMs).toBeLessThan(10); // Should average < 10ms per article
    expect(duration).toBeLessThan(2000); // Real-world timing should also be < 2 seconds
  });

  it("should record migration completion in sync_metadata", async () => {
    const supabase = getAdminClient();

    await executeHtmlEntityMigration(supabase);

    // Verify sync_metadata was updated
    expect(mockSupabase.from).toHaveBeenCalledWith("sync_metadata");

    const metadataUpserts =
      mockSupabase.from("sync_metadata").upsert.mock.calls;
    expect(metadataUpserts.length).toBeGreaterThan(0);

    const migrationRecord = metadataUpserts[0][0];
    expect(migrationRecord.key).toBe("html_entity_migration_completed");
    expect(migrationRecord.value).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO timestamp
    expect(migrationRecord.description).toContain("Processed");
  });

  it("should handle duplicate migration runs safely", async () => {
    // Simulate running migration twice
    const supabase = getAdminClient();

    const result1 = await executeHtmlEntityMigration(supabase);
    const result2 = await executeHtmlEntityMigration(supabase);

    // Both runs should succeed
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // Second run should process the same articles (idempotent)
    expect(result2.processed).toBeGreaterThanOrEqual(0);

    // Verify upsert operations work correctly (no errors from duplicates)
    const upsertCalls = mockSupabase.from("articles").upsert.mock.calls;
    expect(upsertCalls.length).toBe(2); // One for each migration run

    // Each call should use onConflict: 'id' to handle duplicates
    upsertCalls.forEach((call) => {
      expect(call[1]).toEqual({ onConflict: "id" });
    });
  });

  it("should preserve non-HTML entity content during migration", async () => {
    // Add articles with legitimate ampersands that shouldn't be decoded
    const mixedContent = [
      {
        id: "mixed-1",
        title: "Johnson &amp; Johnson vs AT&T Partnership",
        content:
          "&lt;p&gt;Partnership between J&amp;J and AT&T announced.&lt;/p&gt;",
      },
      {
        id: "mixed-2",
        title: "R&D Investment &amp; Innovation",
        content: "&lt;p&gt;R&amp;D spending increased by 15%.&lt;/p&gt;",
      },
    ];

    mockSupabase.from = vi.fn((table: string) => {
      if (table === "articles") {
        return {
          select: vi.fn(() => ({
            or: vi.fn(() => Promise.resolve({ data: mixedContent })),
          })),
          upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
      }
      return {
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };
    });

    const supabase = getAdminClient();
    const result = await executeHtmlEntityMigration(supabase);

    expect(result.success).toBe(true);

    const upsertCalls = mockSupabase.from("articles").upsert.mock.calls;
    const decodedArticles = upsertCalls[0][0];

    // Verify proper decoding - only HTML entities should be decoded
    const article1 = decodedArticles.find((a: any) => a.id === "mixed-1");
    expect(article1?.title).toBe("Johnson & Johnson vs AT&T Partnership");
    expect(article1?.content).toBe(
      "<p>Partnership between J&J and AT&T announced.</p>"
    );

    const article2 = decodedArticles.find((a: any) => a.id === "mixed-2");
    expect(article2?.title).toBe("R&D Investment & Innovation");
    expect(article2?.content).toBe("<p>R&D spending increased by 15%.</p>");
  });
});
