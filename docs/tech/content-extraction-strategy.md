# Content Extraction Strategy - Shayon's News

## Problem Statement

RSS feeds often contain only partial article content (title, excerpt, summary) rather than the full article text. This is controlled by the feed publisher, and even services like Inoreader cannot provide full content if it's not in the original feed. To provide a complete reading experience, we need to fetch and extract full content directly from the original article URLs.

## Content Extraction Approach

### Primary Strategy: @mozilla/readability + JSDOM

**Selected Library**: `@mozilla/readability` with `jsdom`

**Rationale**:

- Battle-tested (used in Firefox Reader View)
- Excellent content extraction accuracy
- Lightweight compared to browser automation
- No external browser dependencies
- Good TypeScript support
- Active maintenance by Mozilla

#### Implementation Architecture

```typescript
// lib/content-extraction/content-extractor.ts
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";

export interface ExtractedContent {
  title: string;
  content: string;
  textContent: string;
  excerpt: string;
  byline: string | null;
  readingTime: number;
  publishedTime: Date | null;
  siteName: string | null;
  imageUrl: string | null;
  success: boolean;
  originalUrl: string;
}

export class ContentExtractor {
  private timeout = 30000; // 30 seconds
  private userAgent =
    "Mozilla/5.0 (compatible; Shayon-News/1.0; +https://shayon-news.com)";

  async extractFromUrl(url: string): Promise<ExtractedContent> {
    try {
      // Step 1: Fetch the HTML
      const html = await this.fetchHTML(url);

      // Step 2: Extract content using Readability
      const content = await this.extractContent(html, url);

      // Step 3: Sanitize the content
      const sanitizedContent = this.sanitizeContent(content.content);

      return {
        ...content,
        content: sanitizedContent,
        success: true,
        originalUrl: url,
      };
    } catch (error) {
      console.error(`Content extraction failed for ${url}:`, error);
      return {
        title: "",
        content: "",
        textContent: "",
        excerpt: "",
        byline: null,
        readingTime: 0,
        publishedTime: null,
        siteName: null,
        imageUrl: null,
        success: false,
        originalUrl: url,
      };
    }
  }

  private async fetchHTML(url: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": this.userAgent,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("text/html")) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async extractContent(
    html: string,
    url: string
  ): Promise<Partial<ExtractedContent>> {
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // Check if content is suitable for extraction
    if (!Readability.isProbablyReaderable(document)) {
      throw new Error("Content is not suitable for extraction");
    }

    const reader = new Readability(document, {
      debug: false,
      maxElemsToParse: 0, // No limit
      nbTopCandidates: 5,
      charThreshold: 500,
      classesToPreserve: ["caption", "credit", "highlight"],
      keepClasses: true,
    });

    const article = reader.parse();

    if (!article) {
      throw new Error("Failed to extract article content");
    }

    // Extract additional metadata
    const siteName = this.extractSiteName(document);
    const publishedTime = this.extractPublishedTime(document);
    const imageUrl = this.extractMainImage(document, url);
    const readingTime = this.calculateReadingTime(article.textContent);

    return {
      title: article.title,
      content: article.content,
      textContent: article.textContent,
      excerpt: article.excerpt,
      byline: article.byline,
      readingTime,
      publishedTime,
      siteName,
      imageUrl,
    };
  }

  private sanitizeContent(content: string): string {
    // Use DOMPurify to sanitize content
    const window = new JSDOM("").window;
    const purify = DOMPurify(window);

    return purify.sanitize(content, {
      ALLOWED_TAGS: [
        "p",
        "br",
        "strong",
        "em",
        "u",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
        "ul",
        "ol",
        "li",
        "a",
        "img",
        "figure",
        "figcaption",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "pre",
        "code",
      ],
      ALLOWED_ATTR: [
        "href",
        "src",
        "alt",
        "title",
        "class",
        "id",
        "width",
        "height",
      ],
      KEEP_CONTENT: true,
      RETURN_DOM: false,
    });
  }

  private extractSiteName(document: Document): string | null {
    // Try various meta tags for site name
    const selectors = [
      'meta[property="og:site_name"]',
      'meta[name="application-name"]',
      'meta[name="twitter:site"]',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const content = element?.getAttribute("content");
      if (content) return content.trim();
    }

    return null;
  }

  private extractPublishedTime(document: Document): Date | null {
    // Try various meta tags and structured data for published time
    const selectors = [
      'meta[property="article:published_time"]',
      'meta[name="article:published_time"]',
      'meta[property="og:updated_time"]',
      "time[datetime]",
      '[class*="date" i][datetime]',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const datetime =
        element?.getAttribute("datetime") || element?.getAttribute("content");
      if (datetime) {
        const date = new Date(datetime);
        if (!isNaN(date.getTime())) return date;
      }
    }

    return null;
  }

  private extractMainImage(document: Document, baseUrl: string): string | null {
    // Try various meta tags for main image
    const selectors = [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'link[rel="image_src"]',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const content =
        element?.getAttribute("content") || element?.getAttribute("href");
      if (content) {
        return new URL(content, baseUrl).href;
      }
    }

    // Fallback: find first meaningful image in content
    const images = document.querySelectorAll("img");
    for (const img of images) {
      const src = img.getAttribute("src");
      if (src && this.isValidImageUrl(src)) {
        return new URL(src, baseUrl).href;
      }
    }

    return null;
  }

  private isValidImageUrl(src: string): boolean {
    // Filter out common non-content images
    const skipPatterns = [
      /tracking/,
      /analytics/,
      /pixel/,
      /beacon/,
      /\.gif$/,
      /1x1/,
      /spacer/,
      /blank/,
    ];

    return !skipPatterns.some((pattern) => pattern.test(src.toLowerCase()));
  }

  private calculateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const wordCount = text.trim().split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }
}
```

### Alternative/Fallback Strategy: @extractus/article-extractor

For cases where Readability fails, we can fallback to `@extractus/article-extractor`:

```typescript
// lib/content-extraction/fallback-extractor.ts
import { extract } from "@extractus/article-extractor";

export class FallbackExtractor {
  async extractFromUrl(url: string): Promise<ExtractedContent> {
    try {
      const result = await extract(url, {
        fetchOptions: {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Shayon-News/1.0)",
          },
        },
      });

      if (!result) {
        throw new Error("No content extracted");
      }

      return {
        title: result.title || "",
        content: result.content || "",
        textContent: result.content ? this.stripHTML(result.content) : "",
        excerpt: result.description || "",
        byline: result.author || null,
        readingTime: this.calculateReadingTime(result.content || ""),
        publishedTime: result.published ? new Date(result.published) : null,
        siteName: result.source || null,
        imageUrl: result.image || null,
        success: true,
        originalUrl: url,
      };
    } catch (error) {
      console.error(`Fallback extraction failed for ${url}:`, error);
      throw error;
    }
  }

  private stripHTML(html: string): string {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private calculateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const wordCount = this.stripHTML(text).split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }
}
```

### Orchestration Service

```typescript
// lib/content-extraction/extraction-service.ts
export class ContentExtractionService {
  private primaryExtractor = new ContentExtractor();
  private fallbackExtractor = new FallbackExtractor();
  private cache = new Map<string, ExtractedContent>();

  async extractContent(
    url: string,
    useCache = true
  ): Promise<ExtractedContent> {
    // Check cache first
    if (useCache && this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    let result: ExtractedContent;

    try {
      // Try primary extractor (Readability)
      result = await this.primaryExtractor.extractFromUrl(url);

      if (!result.success || result.content.length < 500) {
        // Try fallback extractor
        console.log(
          `Primary extraction failed/insufficient for ${url}, trying fallback`
        );
        result = await this.fallbackExtractor.extractFromUrl(url);
      }
    } catch (primaryError) {
      console.warn(`Primary extraction failed for ${url}:`, primaryError);

      try {
        // Try fallback extractor
        result = await this.fallbackExtractor.extractFromUrl(url);
      } catch (fallbackError) {
        console.error(`Both extractors failed for ${url}:`, fallbackError);
        result = {
          title: "",
          content: "",
          textContent: "",
          excerpt: "",
          byline: null,
          readingTime: 0,
          publishedTime: null,
          siteName: null,
          imageUrl: null,
          success: false,
          originalUrl: url,
        };
      }
    }

    // Cache successful results
    if (result.success && useCache) {
      this.cache.set(url, result);
    }

    return result;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}
```

## Integration with Article Management

### Database Schema Updates

```typescript
// Update Article interface to include extraction metadata
interface Article {
  id: string;
  title: string;
  originalContent: string; // Content from RSS feed
  extractedContent?: string; // Full content from extraction
  extractedAt?: Date; // When extraction was performed
  extractionSuccess?: boolean;
  extractionError?: string;
  hasFullContent: boolean; // True if either original or extracted content is complete
  // ... other existing fields
}
```

### UI Integration

```typescript
// components/ArticleDetail.tsx
const ArticleDetail = ({ article }: Props) => {
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractedContent, setExtractedContent] = useState<string | null>(null)
  const extractionService = useContentExtraction()

  const handleFetchFullContent = async () => {
    setIsExtracting(true)

    try {
      const result = await extractionService.extractContent(article.url)

      if (result.success) {
        setExtractedContent(result.content)
        // Update article in database
        await updateArticle(article.id, {
          extractedContent: result.content,
          extractedAt: new Date(),
          extractionSuccess: true,
          hasFullContent: true
        })
      } else {
        throw new Error('Extraction failed')
      }
    } catch (error) {
      console.error('Failed to extract content:', error)
      // Show user-friendly error message
    } finally {
      setIsExtracting(false)
    }
  }

  const displayContent = extractedContent || article.extractedContent || article.originalContent
  const needsExtraction = !article.hasFullContent && !extractedContent

  return (
    <article>
      <h1>{article.title}</h1>

      {needsExtraction && (
        <div className="extraction-prompt">
          <p>This article shows only a preview.</p>
          <button
            onClick={handleFetchFullContent}
            disabled={isExtracting}
          >
            {isExtracting ? 'Fetching Full Content...' : 'Fetch Full Content'}
          </button>
        </div>
      )}

      <div
        className="article-content"
        dangerouslySetInnerHTML={{ __html: displayContent }}
      />
    </article>
  )
}
```

## Performance Considerations

### Caching Strategy

- **Memory Cache**: Recently extracted content (100 articles max)
- **IndexedDB Cache**: Persistent storage for extracted content
- **Cache Invalidation**: 7-day TTL for extracted content

### Rate Limiting

- **Concurrent Extractions**: Maximum 3 simultaneous extractions
- **Request Throttling**: 1-second delay between requests to same domain
- **Timeout Handling**: 30-second timeout per extraction

### Error Handling

- **Retry Logic**: 2 retries with exponential backoff
- **Graceful Degradation**: Show original content if extraction fails
- **User Feedback**: Clear error messages and retry options

## Security Considerations

### Content Sanitization

- **DOMPurify**: Sanitize all extracted HTML content
- **Allowed Tags**: Whitelist of safe HTML tags
- **URL Validation**: Validate and normalize image/link URLs

### Request Safety

- **User Agent**: Identify as legitimate RSS reader
- **Respect robots.txt**: Check robots.txt before extraction (optional)
- **Rate Limiting**: Avoid overwhelming target servers

## Dependencies

```json
{
  "dependencies": {
    "@mozilla/readability": "^0.4.4",
    "jsdom": "^23.0.0",
    "dompurify": "^3.0.0",
    "@extractus/article-extractor": "^8.0.0"
  },
  "devDependencies": {
    "@types/dompurify": "^3.0.0",
    "@types/jsdom": "^21.0.0"
  }
}
```

## Testing Strategy

### Unit Tests

- Test content extraction with known URLs
- Test error handling and fallbacks
- Test content sanitization

### Integration Tests

- Test with various website types
- Test caching behavior
- Test rate limiting

### Manual Testing

- Test with popular news sites
- Test with different content types (articles, blogs, etc.)
- Test extraction quality and accuracy

This strategy provides a robust, scalable approach to full content extraction while maintaining good performance and user experience.
