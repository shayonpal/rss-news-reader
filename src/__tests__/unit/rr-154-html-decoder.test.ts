import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * RR-154: Unit tests for HTML entity decoding module
 * These tests define the SPECIFICATION for the html-decoder module.
 * The implementation MUST conform to these tests, not the other way around.
 *
 * Problem Statement:
 * - 68 article titles and 277 article contents have undecoded HTML entities
 * - Entities like &rsquo;, &lsquo;, &amp;, &quot;, &#8217;, &ndash; need decoding
 * - URLs must NOT be decoded to preserve their integrity
 *
 * Implementation Requirements:
 * - Module path: /src/lib/utils/html-decoder.ts
 * - Use 'he' library for decoding
 * - Must handle all common HTML entities and numeric character references
 * - Must preserve URLs exactly as-is
 */
describe("RR-154: HTML Entity Decoder Module", () => {
  describe("1. Core Decoding Functions", () => {
    describe("1.1 decodeHtmlEntities(text: string): string", () => {
      it("should decode apostrophe entities correctly", async () => {
        const { decodeHtmlEntities } = await import("@/lib/utils/html-decoder");

        // Right single quotation mark
        expect(decodeHtmlEntities("Biden&rsquo;s decision")).toBe(
          "Biden\u2019s decision"
        );
        expect(decodeHtmlEntities("It&rsquo;s working")).toBe(
          "It\u2019s working"
        );

        // Numeric character reference for apostrophe
        expect(decodeHtmlEntities("Biden&#8217;s decision")).toBe(
          "Biden\u2019s decision"
        );
        expect(decodeHtmlEntities("It&#8217;s working")).toBe(
          "It\u2019s working"
        );

        // Multiple apostrophes
        expect(decodeHtmlEntities("John&rsquo;s friend&rsquo;s car")).toBe(
          "John\u2019s friend\u2019s car"
        );
      });

      it("should decode quotation mark entities correctly", async () => {
        const { decodeHtmlEntities } = await import("@/lib/utils/html-decoder");

        // Left and right double quotes
        expect(decodeHtmlEntities("&ldquo;Hello World&rdquo;")).toBe(
          "\u201cHello World\u201d"
        );

        // Left and right single quotes
        expect(decodeHtmlEntities("&lsquo;Hello World&rsquo;")).toBe(
          "\u2018Hello World\u2019"
        );

        // Standard double quote entity
        expect(decodeHtmlEntities("&quot;Hello World&quot;")).toBe(
          '"Hello World"'
        );

        // Mixed quotes
        expect(
          decodeHtmlEntities("He said &ldquo;It&rsquo;s done&rdquo;")
        ).toBe("He said \u201cIt\u2019s done\u201d");
      });

      it("should decode ampersand entities correctly", async () => {
        const { decodeHtmlEntities } = await import("@/lib/utils/html-decoder");

        expect(decodeHtmlEntities("AT&amp;T")).toBe("AT&T");
        expect(decodeHtmlEntities("Research &amp; Development")).toBe(
          "Research & Development"
        );
        expect(decodeHtmlEntities("Q&amp;A Session")).toBe("Q&A Session");

        // Multiple ampersands
        expect(decodeHtmlEntities("A &amp; B &amp; C")).toBe("A & B & C");
      });

      it("should decode dash entities correctly", async () => {
        const { decodeHtmlEntities } = await import("@/lib/utils/html-decoder");

        // En dash
        expect(decodeHtmlEntities("2020&ndash;2024")).toBe("2020\u20132024");
        expect(decodeHtmlEntities("Pages 10&ndash;20")).toBe(
          "Pages 10\u201320"
        );

        // Em dash
        expect(decodeHtmlEntities("Breaking&mdash;this just in")).toBe(
          "Breaking\u2014this just in"
        );
        expect(decodeHtmlEntities("The result&mdash;unexpected")).toBe(
          "The result\u2014unexpected"
        );
      });

      it("should decode less than and greater than entities", async () => {
        const { decodeHtmlEntities } = await import("@/lib/utils/html-decoder");

        expect(decodeHtmlEntities("5 &lt; 10")).toBe("5 < 10");
        expect(decodeHtmlEntities("10 &gt; 5")).toBe("10 > 5");
        expect(decodeHtmlEntities("&lt;div&gt;content&lt;/div&gt;")).toBe(
          "<div>content</div>"
        );
      });

      it("should decode numeric character references", async () => {
        const { decodeHtmlEntities } = await import("@/lib/utils/html-decoder");

        // Decimal references
        expect(decodeHtmlEntities("&#8217;")).toBe("\u2019"); // Right single quote
        expect(decodeHtmlEntities("&#8220;")).toBe("\u201c"); // Left double quote
        expect(decodeHtmlEntities("&#8221;")).toBe("\u201d"); // Right double quote
        expect(decodeHtmlEntities("&#8211;")).toBe("\u2013"); // En dash
        expect(decodeHtmlEntities("&#8212;")).toBe("\u2014"); // Em dash

        // Hexadecimal references
        expect(decodeHtmlEntities("&#x2019;")).toBe("\u2019"); // Right single quote (hex)
        expect(decodeHtmlEntities("&#x201C;")).toBe("\u201c"); // Left double quote (hex)
        expect(decodeHtmlEntities("&#x201D;")).toBe("\u201d"); // Right double quote (hex)
      });

      it("should handle mixed entities in complex text", async () => {
        const { decodeHtmlEntities } = await import("@/lib/utils/html-decoder");

        const input =
          "AT&amp;T&rsquo;s &ldquo;Innovation&rdquo; &ndash; Q&amp;A";
        const expected = "AT&T\u2019s \u201cInnovation\u201d \u2013 Q&A";
        expect(decodeHtmlEntities(input)).toBe(expected);

        const input2 =
          "The company&#8217;s R&amp;D &mdash; it&rsquo;s amazing!";
        const expected2 = "The company\u2019s R&D \u2014 it\u2019s amazing!";
        expect(decodeHtmlEntities(input2)).toBe(expected2);
      });

      it("should handle already decoded text without modification", async () => {
        const { decodeHtmlEntities } = await import("@/lib/utils/html-decoder");

        const normalText = "Biden's decision & research";
        expect(decodeHtmlEntities(normalText)).toBe(normalText);

        const withQuotes = '"Hello World" – it\'s working';
        expect(decodeHtmlEntities(withQuotes)).toBe(withQuotes);
      });

      it("should handle empty strings and null values gracefully", async () => {
        const { decodeHtmlEntities } = await import("@/lib/utils/html-decoder");

        expect(decodeHtmlEntities("")).toBe("");
        expect(decodeHtmlEntities(null as any)).toBe("");
        expect(decodeHtmlEntities(undefined as any)).toBe("");
      });

      it("should decode special characters entities", async () => {
        const { decodeHtmlEntities } = await import("@/lib/utils/html-decoder");

        expect(decodeHtmlEntities("&nbsp;")).toBe("\u00A0"); // Non-breaking space
        expect(decodeHtmlEntities("&copy;")).toBe("©"); // Copyright
        expect(decodeHtmlEntities("&reg;")).toBe("®"); // Registered
        expect(decodeHtmlEntities("&euro;")).toBe("€"); // Euro
        expect(decodeHtmlEntities("&pound;")).toBe("£"); // Pound
      });
    });

    describe("1.2 decodeArticleData(article: object): object", () => {
      it("should decode title and content but preserve URLs", async () => {
        const { decodeArticleData } = await import("@/lib/utils/html-decoder");

        const article = {
          id: "article-1",
          title: "Biden&rsquo;s Policy &amp; Strategy",
          content:
            "The president&rsquo;s &ldquo;new approach&rdquo; includes R&amp;D.",
          url: "https://example.com/article?param=value&amp;other=test",
          canonical_url: "https://example.com/article?id=123&amp;category=news",
          inoreader_id: "tag:google.com,2005:reader/item/000000001234",
        };

        const decoded = decodeArticleData(article);

        // Title and content should be decoded
        expect(decoded.title).toBe("Biden\u2019s Policy & Strategy");
        expect(decoded.content).toBe(
          "The president\u2019s \u201cnew approach\u201d includes R&D."
        );

        // URLs should remain exactly as-is
        expect(decoded.url).toBe(
          "https://example.com/article?param=value&amp;other=test"
        );
        expect(decoded.canonical_url).toBe(
          "https://example.com/article?id=123&amp;category=news"
        );
        expect(decoded.inoreader_id).toBe(
          "tag:google.com,2005:reader/item/000000001234"
        );
      });

      it("should handle articles with null or missing fields", async () => {
        const { decodeArticleData } = await import("@/lib/utils/html-decoder");

        const article = {
          id: "article-2",
          title: null,
          content: undefined,
          url: "https://example.com",
        };

        const decoded = decodeArticleData(article);

        expect(decoded.title).toBe(null);
        expect(decoded.content).toBe(undefined);
        expect(decoded.url).toBe("https://example.com");
      });

      it("should preserve all other article properties unchanged", async () => {
        const { decodeArticleData } = await import("@/lib/utils/html-decoder");

        const article = {
          id: "article-3",
          title: "Test &amp; Title",
          content: "Content with &rsquo; entity",
          url: "https://example.com",
          published_at: "2024-01-01T00:00:00Z",
          author: "John Doe",
          feed_id: "feed-123",
          is_read: false,
          is_starred: true,
          tags: ["tech", "news"],
        };

        const decoded = decodeArticleData(article);

        // Check decoded fields
        expect(decoded.title).toBe("Test & Title");
        expect(decoded.content).toBe("Content with \u2019 entity");

        // Check preserved fields
        expect(decoded.published_at).toBe("2024-01-01T00:00:00Z");
        expect(decoded.author).toBe("John Doe");
        expect(decoded.feed_id).toBe("feed-123");
        expect(decoded.is_read).toBe(false);
        expect(decoded.is_starred).toBe(true);
        expect(decoded.tags).toEqual(["tech", "news"]);
      });

      it("should handle description field if present", async () => {
        const { decodeArticleData } = await import("@/lib/utils/html-decoder");

        const article = {
          id: "article-4",
          title: "Title",
          description:
            "A &ldquo;brief&rdquo; description &ndash; it&rsquo;s useful",
          content: "Full content",
          url: "https://example.com",
        };

        const decoded = decodeArticleData(article);

        expect(decoded.description).toBe(
          "A \u201cbrief\u201d description \u2013 it\u2019s useful"
        );
      });
    });

    describe("1.3 isSafeUrl(text: string): boolean", () => {
      it("should identify URLs correctly", async () => {
        const { isSafeUrl } = await import("@/lib/utils/html-decoder");

        // Valid URLs that should NOT be decoded
        expect(isSafeUrl("https://example.com")).toBe(true);
        expect(isSafeUrl("http://example.com")).toBe(true);
        expect(
          isSafeUrl("https://example.com/path?param=value&other=test")
        ).toBe(true);
        expect(isSafeUrl("tag:google.com,2005:reader/item/000000001234")).toBe(
          true
        );
        expect(isSafeUrl("feed://example.com/rss")).toBe(true);

        // Not URLs - should be decoded
        expect(isSafeUrl("Biden&rsquo;s Policy")).toBe(false);
        expect(isSafeUrl("Research & Development")).toBe(false);
        expect(isSafeUrl("Q&A Session")).toBe(false);
      });
    });
  });

  describe("2. Batch Processing Functions", () => {
    describe("2.1 decodeArticleBatch(articles: array): array", () => {
      it("should decode multiple articles efficiently", async () => {
        const { decodeArticleBatch } = await import("@/lib/utils/html-decoder");

        const articles = [
          {
            id: "1",
            title: "First &amp; Article",
            content: "Content with &rsquo; apostrophe",
            url: "https://example.com/1",
          },
          {
            id: "2",
            title: "Second &ldquo;Article&rdquo;",
            content: "More content &ndash; testing",
            url: "https://example.com/2?param=value&test=1",
          },
          {
            id: "3",
            title: "Third Article&#8217;s Title",
            content: null,
            url: "https://example.com/3",
          },
        ];

        const decoded = decodeArticleBatch(articles);

        expect(decoded[0].title).toBe("First & Article");
        expect(decoded[0].content).toBe("Content with \u2019 apostrophe");
        expect(decoded[0].url).toBe("https://example.com/1");

        expect(decoded[1].title).toBe("Second \u201cArticle\u201d");
        expect(decoded[1].content).toBe("More content \u2013 testing");
        expect(decoded[1].url).toBe("https://example.com/2?param=value&test=1");

        expect(decoded[2].title).toBe("Third Article\u2019s Title");
        expect(decoded[2].content).toBe(null);
        expect(decoded[2].url).toBe("https://example.com/3");
      });

      it("should handle empty batch", async () => {
        const { decodeArticleBatch } = await import("@/lib/utils/html-decoder");

        expect(decodeArticleBatch([])).toEqual([]);
        expect(decodeArticleBatch(null as any)).toEqual([]);
        expect(decodeArticleBatch(undefined as any)).toEqual([]);
      });

      it("should preserve article order", async () => {
        const { decodeArticleBatch } = await import("@/lib/utils/html-decoder");

        const articles = Array.from({ length: 10 }, (_, i) => ({
          id: String(i),
          title: `Article ${i} &amp; Title`,
          content: `Content ${i}`,
          url: `https://example.com/${i}`,
        }));

        const decoded = decodeArticleBatch(articles);

        expect(decoded.length).toBe(10);
        decoded.forEach((article, index) => {
          expect(article.id).toBe(String(index));
          expect(article.title).toBe(`Article ${index} & Title`);
        });
      });
    });
  });

  describe("3. Error Handling", () => {
    it("should handle malformed entities gracefully", async () => {
      const { decodeHtmlEntities } = await import("@/lib/utils/html-decoder");

      // Incomplete entities should be left as-is
      expect(decodeHtmlEntities("Test &rsquo incomplete")).toBe(
        "Test &rsquo incomplete"
      );
      expect(decodeHtmlEntities("Test & alone")).toBe("Test & alone");
      expect(decodeHtmlEntities("Test &#")).toBe("Test &#");
    });

    it("should handle extremely long strings without performance issues", async () => {
      const { decodeHtmlEntities } = await import("@/lib/utils/html-decoder");

      // Create a long string with many entities
      const longString = "Test &amp; ".repeat(1000) + "&rsquo;s end";
      const startTime = Date.now();
      const result = decodeHtmlEntities(longString);
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 100ms)
      expect(duration).toBeLessThan(100);
      expect(result).toContain("Test & ");
      expect(result).toContain("\u2019s end");
    });

    it("should not throw errors on invalid input types", async () => {
      const { decodeHtmlEntities } = await import("@/lib/utils/html-decoder");

      expect(() => decodeHtmlEntities(123 as any)).not.toThrow();
      expect(() => decodeHtmlEntities({} as any)).not.toThrow();
      expect(() => decodeHtmlEntities([] as any)).not.toThrow();
      expect(() => decodeHtmlEntities(true as any)).not.toThrow();
    });
  });

  describe("4. Performance Requirements", () => {
    it("should decode 1000 articles in under 1 second", async () => {
      const { decodeArticleBatch } = await import("@/lib/utils/html-decoder");

      const articles = Array.from({ length: 1000 }, (_, i) => ({
        id: String(i),
        title: `Article ${i} &amp; &rsquo; &ldquo;test&rdquo; &ndash; complex`,
        content: `Content with &amp; many &rsquo; entities &ldquo;everywhere&rdquo; &ndash; testing`,
        url: `https://example.com/${i}?param=value&test=1`,
      }));

      const startTime = Date.now();
      const decoded = decodeArticleBatch(articles);
      const duration = Date.now() - startTime;

      expect(decoded.length).toBe(1000);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second

      // Verify first and last articles are properly decoded
      expect(decoded[0].title).toBe(
        "Article 0 & \u2019 \u201ctest\u201d \u2013 complex"
      );
      expect(decoded[999].title).toBe(
        "Article 999 & \u2019 \u201ctest\u201d \u2013 complex"
      );
    });
  });
});
