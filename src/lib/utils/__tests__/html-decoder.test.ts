import { describe, it, expect, vi } from "vitest";
import {
  decodeHtmlEntities,
  decodeTitle,
  decodeContent,
  batchDecodeArticles,
  type DecodingResult,
  type ArticleDecoding,
} from "../html-decoder";

describe("HTML Entity Decoder (RR-154)", () => {
  describe("decodeHtmlEntities", () => {
    it("should decode common HTML entities in text", () => {
      const input =
        "Johnson &amp; Johnson&rsquo;s new &quot;breakthrough&quot; drug";
      const expected = 'Johnson & Johnson\u2019s new "breakthrough" drug';

      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it("should decode numeric HTML entities", () => {
      const input = "We&#8217;re testing &#8211; numeric entities";
      const expected = "We\u2019re testing – numeric entities";

      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it("should handle mixed entity types", () => {
      const input = "&lsquo;Mixed&rsquo; &amp; &#8217;numeric&#8217; entities";
      const expected = "\u2018Mixed\u2019 & \u2019numeric\u2019 entities";

      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it("should preserve URLs with query parameters", () => {
      const input =
        "Visit https://example.com?param=value&amp;other=test for more info";
      const expected =
        "Visit https://example.com?param=value&other=test for more info";

      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it("should preserve URLs in anchor tags", () => {
      const input =
        '&lt;a href="https://example.com?a=1&amp;b=2"&gt;Link&lt;/a&gt;';
      const expected = '<a href="https://example.com?a=1&b=2">Link</a>';

      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it("should handle empty string", () => {
      expect(decodeHtmlEntities("")).toBe("");
    });

    it("should handle null gracefully", () => {
      expect(decodeHtmlEntities(null as any)).toBe("");
    });

    it("should handle undefined gracefully", () => {
      expect(decodeHtmlEntities(undefined as any)).toBe("");
    });

    it("should handle non-string input gracefully", () => {
      expect(decodeHtmlEntities(123 as any)).toBe("123");
      expect(decodeHtmlEntities(true as any)).toBe("true");
      expect(decodeHtmlEntities({} as any)).toBe("[object Object]");
    });

    it("should handle text with no entities", () => {
      const input = "Plain text with no entities";
      expect(decodeHtmlEntities(input)).toBe(input);
    });

    it("should handle malformed entities gracefully", () => {
      const input = "Text with &malformed; and &amp incomplete entities";
      const expected = "Text with &malformed; and & incomplete entities";

      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it("should decode all entities found in RR-154 analysis", () => {
      // Test all specific entities mentioned in the issue
      const testCases = [
        { input: "&rsquo;", expected: "\u2019" },
        { input: "&amp;", expected: "&" },
        { input: "&lsquo;", expected: "\u2018" },
        { input: "&quot;", expected: '"' },
        { input: "&#8217;", expected: "\u2019" },
        { input: "&ndash;", expected: "–" },
        { input: "&mdash;", expected: "—" },
        { input: "&hellip;", expected: "…" },
        { input: "&lt;", expected: "<" },
        { input: "&gt;", expected: ">" },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(decodeHtmlEntities(input)).toBe(expected);
      });
    });

    it("should maintain performance for single entity", () => {
      const start = performance.now();
      decodeHtmlEntities("Simple &amp; test");
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1); // Should be < 1ms
    });
  });

  describe("decodeTitle", () => {
    it("should decode HTML entities in article titles", () => {
      const input = "Apple &amp; Google&rsquo;s &quot;AI Revolution&quot;";
      const expected = 'Apple & Google\u2019s "AI Revolution"';

      expect(decodeTitle(input)).toBe(expected);
    });

    it("should handle null title gracefully", () => {
      expect(decodeTitle(null)).toBe("");
    });

    it("should handle undefined title gracefully", () => {
      expect(decodeTitle(undefined)).toBe("");
    });

    it("should preserve title structure and formatting", () => {
      const input = "Breaking: Johnson &amp; Johnson&rsquo;s Stock Rises 15%";
      const expected = "Breaking: Johnson & Johnson\u2019s Stock Rises 15%";

      expect(decodeTitle(input)).toBe(expected);
    });
  });

  describe("decodeContent", () => {
    it("should decode HTML entities in article content", () => {
      const input =
        "&lt;p&gt;Johnson &amp; Johnson announced that it&rsquo;s launching a new &quot;breakthrough&quot; treatment.&lt;/p&gt;";
      const expected =
        '<p>Johnson & Johnson announced that it\u2019s launching a new "breakthrough" treatment.</p>';

      expect(decodeContent(input)).toBe(expected);
    });

    it("should handle null content gracefully", () => {
      expect(decodeContent(null)).toBe("");
    });

    it("should handle undefined content gracefully", () => {
      expect(decodeContent(undefined)).toBe("");
    });

    it("should preserve HTML structure after decoding", () => {
      const input =
        "&lt;div class=&quot;article&quot;&gt;&lt;h2&gt;Tech &amp; Innovation&lt;/h2&gt;&lt;p&gt;AI&rsquo;s impact on society.&lt;/p&gt;&lt;/div&gt;";
      const expected =
        '<div class="article"><h2>Tech & Innovation</h2><p>AI\u2019s impact on society.</p></div>';

      expect(decodeContent(input)).toBe(expected);
    });

    it("should preserve URLs in content", () => {
      const input =
        '&lt;a href="https://example.com?utm_source=feed&amp;utm_medium=rss"&gt;Read more&lt;/a&gt;';
      const expected =
        '<a href="https://example.com?utm_source=feed&utm_medium=rss">Read more</a>';

      expect(decodeContent(input)).toBe(expected);
    });
  });

  describe("batchDecodeArticles", () => {
    it("should decode HTML entities in multiple articles", async () => {
      const articles = [
        {
          id: "1",
          title: "Apple &amp; Google&rsquo;s Partnership",
          content: "&lt;p&gt;Breaking news about tech giants.&lt;/p&gt;",
        },
        {
          id: "2",
          title: "Microsoft&rsquo;s &quot;New Era&quot;",
          content: "&lt;div&gt;Innovation &amp; progress.&lt;/div&gt;",
        },
      ];

      const result = await batchDecodeArticles(articles);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(result.results).toHaveLength(2);

      // Check first article
      expect(result.results[0].id).toBe("1");
      expect(result.results[0].title).toBe("Apple & Google\u2019s Partnership");
      expect(result.results[0].content).toBe(
        "<p>Breaking news about tech giants.</p>"
      );

      // Check second article
      expect(result.results[1].id).toBe("2");
      expect(result.results[1].title).toBe('Microsoft\u2019s "New Era"');
      expect(result.results[1].content).toBe(
        "<div>Innovation & progress.</div>"
      );
    });

    it("should handle articles with null/undefined fields", async () => {
      const articles = [
        {
          id: "1",
          title: null,
          content: undefined,
        },
        {
          id: "2",
          title: "Valid &amp; Title",
          content: null,
        },
      ];

      const result = await batchDecodeArticles(articles);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.results[0].title).toBe("");
      expect(result.results[0].content).toBe("");
      expect(result.results[1].title).toBe("Valid & Title");
      expect(result.results[1].content).toBe("");
    });

    it("should handle empty array", async () => {
      const result = await batchDecodeArticles([]);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(0);
      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should collect errors but continue processing", async () => {
      const articles = [
        { id: "1", title: "Valid &amp; Title", content: "Valid content" },
        { id: "2" }, // Missing title and content fields
        {
          id: "3",
          title: "Another &rsquo;Valid&rsquo; Title",
          content: "More content",
        },
      ];

      const result = await batchDecodeArticles(articles);

      expect(result.success).toBe(true); // Should succeed overall
      expect(result.processed).toBe(3);
      expect(result.results).toHaveLength(3);

      // Check that valid articles were processed correctly
      expect(result.results[0].title).toBe("Valid & Title");
      expect(result.results[2].title).toBe("Another \u2018Valid\u2019 Title");
    });

    it("should meet performance requirements for batch processing", async () => {
      // Create 200 articles (typical batch size)
      const articles = Array.from({ length: 200 }, (_, i) => ({
        id: `article-${i}`,
        title: `Article ${i} &amp; Company&rsquo;s News`,
        content: `&lt;p&gt;Content for article ${i} with &quot;quotes&quot; and &amp; symbols.&lt;/p&gt;`,
      }));

      const start = performance.now();
      const result = await batchDecodeArticles(articles);
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(result.processed).toBe(200);
      expect(duration).toBeLessThan(200); // Should be < 200ms for 200 articles
    });

    it("should provide detailed timing metrics", async () => {
      const articles = [
        {
          id: "1",
          title: "Test &amp; Article",
          content: "Test content",
        },
      ];

      const result = await batchDecodeArticles(articles);

      expect(result.timing).toBeDefined();
      expect(result.timing.totalMs).toBeGreaterThan(0);
      expect(result.timing.avgPerArticleMs).toBeGreaterThan(0);
      expect(result.timing.avgPerArticleMs).toBeLessThan(1); // Should average < 1ms per article
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed input gracefully", () => {
      const malformedInputs = [
        "&amp;&rsquo;&quot;", // Consecutive entities
        "&amp;lt;test&gt;&amp;", // Complex nesting
        "Text & more &amp; mixed", // Mixed encoded/unencoded
      ];

      malformedInputs.forEach((input) => {
        expect(() => decodeHtmlEntities(input)).not.toThrow();
        const result = decodeHtmlEntities(input);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it("should handle very long strings without memory issues", () => {
      // Create a 10MB string with entities
      const longString = "Test &amp; ".repeat(1000000);

      expect(() => decodeHtmlEntities(longString)).not.toThrow();

      const result = decodeHtmlEntities(longString);
      expect(result).toContain("Test & ");
      expect(result.length).toBeLessThan(longString.length); // Should be shorter after decoding
    });

    it("should handle circular references in batch processing", async () => {
      const article: any = {
        id: "1",
        title: "Test &amp; Title",
      };
      article.self = article; // Create circular reference

      const result = await batchDecodeArticles([article]);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.results[0].title).toBe("Test & Title");
    });
  });

  describe("Integration with Real RR-154 Data", () => {
    it("should handle actual problematic titles from RR-154", () => {
      // Real examples from the RR-154 issue analysis
      const problematicTitles = [
        "Johnson &amp; Johnson&rsquo;s Q3 Results",
        "&quot;AI Revolution&quot; &ndash; What&rsquo;s Next?",
        "Tech Giants&rsquo; Battle for Supremacy",
        "Breaking: Apple &amp; Google Partnership",
        "The Future &ndash; AI &amp; Human Collaboration",
      ];

      const expectedTitles = [
        "Johnson & Johnson\u2019s Q3 Results",
        '"AI Revolution" – What\u2019s Next?',
        "Tech Giants\u2019 Battle for Supremacy",
        "Breaking: Apple & Google Partnership",
        "The Future – AI & Human Collaboration",
      ];

      problematicTitles.forEach((title, index) => {
        expect(decodeTitle(title)).toBe(expectedTitles[index]);
      });
    });

    it("should handle actual problematic content from RR-154", () => {
      const problematicContent =
        "&lt;p&gt;Johnson &amp; Johnson announced today that it&rsquo;s launching a &quot;breakthrough&quot; treatment that could revolutionize healthcare. The company&rsquo;s CEO said, &quot;This represents a new era in medicine.&quot;&lt;/p&gt;&lt;p&gt;The treatment &ndash; developed over 5 years &ndash; shows promising results.&lt;/p&gt;";

      const expectedContent =
        '<p>Johnson & Johnson announced today that it\u2019s launching a "breakthrough" treatment that could revolutionize healthcare. The company\u2019s CEO said, "This represents a new era in medicine."</p><p>The treatment – developed over 5 years – shows promising results.</p>';

      expect(decodeContent(problematicContent)).toBe(expectedContent);
    });
  });

  describe("Type Safety", () => {
    it("should have correct TypeScript types for DecodingResult", () => {
      const result: DecodingResult = {
        success: true,
        processed: 1,
        errors: [],
        results: [
          {
            id: "1",
            title: "Test",
            content: "Content",
          },
        ],
        timing: {
          totalMs: 10,
          avgPerArticleMs: 10,
        },
      };

      expect(result.success).toBe(true);
      expect(result.results[0]).toHaveProperty("id");
      expect(result.results[0]).toHaveProperty("title");
      expect(result.results[0]).toHaveProperty("content");
    });

    it("should have correct TypeScript types for ArticleDecoding", () => {
      const article: ArticleDecoding = {
        id: "test-id",
        title: "Test Title",
        content: "Test Content",
      };

      expect(article).toHaveProperty("id");
      expect(article).toHaveProperty("title");
      expect(article).toHaveProperty("content");
    });
  });
});
