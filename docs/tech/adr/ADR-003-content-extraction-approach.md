# ADR-003: Mozilla Readability for Content Extraction

## Status

Accepted

## Context

Many RSS feeds only provide partial content (summaries or excerpts) rather than full articles. To provide a complete reading experience, we need to extract full content from the original article URLs. This requires:

- Accurate content extraction from various website layouts
- Clean, readable output without ads or navigation
- Preservation of important media (images, videos)
- Security through content sanitization
- Good performance and reliability
- Support for various content types and languages

The extraction must work server-side in Node.js since we can't rely on browser-based solutions in our PWA architecture.

## Decision

We will use Mozilla's Readability library with JSDOM for primary content extraction, with @extractus/article-extractor as a fallback option for sites where Readability struggles.

## Consequences

### Positive

- **Battle-tested**: Readability powers Firefox Reader View, proven on millions of sites
- **High accuracy**: Excellent content detection algorithms
- **Active maintenance**: Regularly updated by Mozilla
- **Lightweight**: No browser dependencies, pure JavaScript
- **Good TypeScript support**: Type definitions available
- **Customizable**: Options for parsing behavior
- **Fast**: Efficient parsing algorithms

### Negative

- **JSDOM dependency**: Requires JSDOM for DOM parsing (larger dependency)
- **Not perfect**: Some sites may still fail extraction
- **No built-in sanitization**: Requires additional DOMPurify step
- **Memory usage**: DOM parsing can be memory intensive for large pages

### Neutral

- **Server-side only**: Can't use browser's native DOM
- **Maintenance burden**: Need to handle edge cases and failures

## Alternatives Considered

### Alternative 1: Puppeteer/Playwright

- **Description**: Full browser automation for content extraction
- **Pros**: Handles JavaScript-rendered content, most accurate
- **Cons**: Heavy dependencies, slow, resource intensive, complex deployment
- **Reason for rejection**: Overkill for most articles, deployment complexity on Mac Mini

### Alternative 2: Cheerio + Custom Rules

- **Description**: Lightweight HTML parsing with custom extraction rules
- **Pros**: Very lightweight, fast, full control
- **Cons**: Requires maintaining extraction rules, poor accuracy, lots of work
- **Reason for rejection**: Too much maintenance burden, poor results on diverse sites

### Alternative 3: Mercury Parser (Postlight)

- **Description**: Popular content extraction library
- **Pros**: Good accuracy, nice API
- **Cons**: No longer maintained, last update 2019
- **Reason for rejection**: Abandoned project, security concerns

### Alternative 4: Article-extractor Only

- **Description**: Modern extraction library
- **Pros**: Actively maintained, simple API, no JSDOM needed
- **Cons**: Less accurate than Readability, fewer options
- **Reason for rejection**: Better as fallback option, not primary solution

### Alternative 5: Commercial APIs (Diffbot, ScrapingBee)

- **Description**: Paid content extraction services
- **Pros**: High accuracy, no maintenance, handles JS sites
- **Cons**: Ongoing costs, privacy concerns, internet dependency
- **Reason for rejection**: Want self-hosted solution, avoid ongoing costs

## Implementation Notes

### Architecture

```typescript
// Primary extractor using Readability
class ContentExtractor {
  async extractFromUrl(url: string): Promise<ExtractedContent> {
    // 1. Fetch HTML
    const html = await this.fetchHTML(url);

    // 2. Parse with JSDOM
    const dom = new JSDOM(html, { url });

    // 3. Check if suitable for extraction
    if (!Readability.isProbablyReaderable(dom.window.document)) {
      throw new Error("Content not suitable for extraction");
    }

    // 4. Extract with Readability
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    // 5. Sanitize content
    return this.sanitizeContent(article);
  }
}

// Fallback extractor
class FallbackExtractor {
  async extractFromUrl(url: string): Promise<ExtractedContent> {
    const result = await extract(url);
    return this.normalizeResult(result);
  }
}

// Orchestration service
class ContentExtractionService {
  async extractContent(url: string): Promise<ExtractedContent> {
    try {
      return await this.primaryExtractor.extractFromUrl(url);
    } catch (error) {
      return await this.fallbackExtractor.extractFromUrl(url);
    }
  }
}
```

### Performance Optimizations

- Cache extracted content in memory (LRU cache, 100 items)
- Cache extracted content in IndexedDB (7-day TTL)
- Implement request throttling (1 req/sec per domain)
- Set reasonable timeouts (30 seconds max)
- Limit concurrent extractions (max 3)

### Security Measures

```typescript
// Sanitize all extracted content
const purify = DOMPurify(window);
const clean = purify.sanitize(dirty, {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "h1",
    "h2",
    "h3",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "img",
  ],
  ALLOWED_ATTR: ["href", "src", "alt", "title"],
});
```

## Testing Strategy

1. Unit tests with known HTML samples
2. Integration tests with real URLs
3. Fallback behavior testing
4. Performance benchmarks
5. Security testing with malicious content

## Monitoring

- Track extraction success rate by domain
- Monitor extraction times
- Log failed extractions for analysis
- Track fallback usage rate

## References

- [Mozilla Readability](https://github.com/mozilla/readability)
- [JSDOM Documentation](https://github.com/jsdom/jsdom)
- [Article Extractor](https://github.com/extractus/article-extractor)
- [DOMPurify](https://github.com/cure53/DOMPurify)
- [Reader View Specification](https://github.com/mozilla/readability#overview)
