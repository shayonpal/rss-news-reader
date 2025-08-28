/**
 * Test fixtures and factories for RR-256: Auto-fetch Full Content
 * Provides consistent test data for partial feeds, articles, and fetch scenarios.
 */

import type { Article, Feed } from "@/types";

// Known partial feed domains (based on real-world data)
export const PARTIAL_FEED_DOMAINS = [
  "bbc.com",
  "bbc.co.uk",
  "cnn.com",
  "reuters.com",
  "bloomberg.com",
  "wsj.com",
  "nytimes.com",
  "theguardian.com",
];

// Known complete feed domains
export const COMPLETE_FEED_DOMAINS = [
  "techcrunch.com",
  "theverge.com",
  "arstechnica.com",
  "hackernews.com",
  "dev.to",
  "medium.com",
];

// Article factory for partial feed articles
export const createPartialFeedArticle = (
  overrides: Partial<Article> = {}
): Article => ({
  id: "partial-article-" + Math.random().toString(36).substr(2, 9),
  feed_id: "bbc-feed",
  user_id: "user-1",
  title: "Breaking: Major News Event Unfolds",
  link: "https://www.bbc.com/news/world-12345678",
  content: `
    <p>This article contains only the first paragraph from the RSS feed.
    The full story is available on the BBC website...</p>
    <p>Click through to read more.</p>
  `.trim(),
  full_content: null,
  has_full_content: false,
  author: "BBC News",
  published_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  is_read: false,
  is_starred: false,
  reading_time: 1, // Short because truncated
  ai_summary: null,
  ai_summary_model: null,
  ai_summary_generated_at: null,
  inoreader_id:
    "tag:google.com,2005:reader/item/" +
    Math.random().toString(36).substr(2, 9),
  ...overrides,
});

// Article factory for complete feed articles
export const createCompleteFeedArticle = (
  overrides: Partial<Article> = {}
): Article => ({
  id: "complete-article-" + Math.random().toString(36).substr(2, 9),
  feed_id: "techcrunch-feed",
  user_id: "user-1",
  title: "Startup Raises $100M in Series B Funding",
  link: "https://techcrunch.com/2024/01/01/startup-funding",
  content: `
    <p>A Silicon Valley startup announced today that it has raised $100 million
    in Series B funding led by prominent venture capital firms.</p>
    
    <p>The company, which develops AI-powered productivity tools, plans to use
    the funding to expand its engineering team and accelerate product development.
    The CEO stated that this investment validates their vision for transforming
    how teams collaborate in the modern workplace.</p>
    
    <p>The funding round was oversubscribed, with participation from existing
    investors as well as new strategic partners. The company has seen 300%
    year-over-year growth in revenue and now serves over 10,000 enterprise
    customers worldwide.</p>
    
    <p>Industry analysts note that this represents one of the largest Series B
    rounds in the productivity software space this year, signaling continued
    investor confidence despite broader market uncertainty.</p>
  `.trim(),
  full_content: null, // Complete feeds don't need extraction
  has_full_content: false,
  author: "Sarah Johnson",
  published_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  is_read: false,
  is_starred: false,
  reading_time: 3,
  ai_summary: null,
  ai_summary_model: null,
  ai_summary_generated_at: null,
  inoreader_id:
    "tag:google.com,2005:reader/item/" +
    Math.random().toString(36).substr(2, 9),
  ...overrides,
});

// Article with existing full content (already fetched)
export const createArticleWithFullContent = (
  overrides: Partial<Article> = {}
): Article => ({
  ...createPartialFeedArticle(),
  full_content: `
    <article>
      <h1>Breaking: Major News Event Unfolds - Complete Coverage</h1>
      
      <p>This is the complete article content that was previously fetched
      from the source website. It contains all the details that were missing
      from the truncated RSS feed.</p>
      
      <h2>Background</h2>
      <p>The event began early this morning when authorities received reports
      of unusual activity in the area. Initial investigations revealed...</p>
      
      <h2>Current Situation</h2>
      <p>As of the latest update, officials have confirmed that the situation
      is under control. Emergency services remain on scene as a precaution...</p>
      
      <h2>Expert Analysis</h2>
      <p>Leading experts in the field have weighed in on the significance of
      today's events. Professor Smith from University College stated...</p>
      
      <h2>What's Next</h2>
      <p>Authorities plan to hold a press conference later today to provide
      additional details. The investigation is ongoing...</p>
    </article>
  `.trim(),
  has_full_content: true,
  reading_time: 5,
  ...overrides,
});

// Feed factory for partial content feeds
export const createPartialFeed = (overrides: Partial<Feed> = {}): Feed => ({
  id: "bbc-feed",
  title: "BBC News - World",
  url: "https://feeds.bbci.co.uk/news/world/rss.xml",
  site_url: "https://www.bbc.com/news/world",
  user_id: "user-1",
  created_at: new Date().toISOString(),
  last_fetched_at: new Date().toISOString(),
  category: "News",
  is_partial_content: true,
  fetch_full_content: false, // User preference to auto-fetch
  ...overrides,
});

// Feed factory for complete content feeds
export const createCompleteFeed = (overrides: Partial<Feed> = {}): Feed => ({
  id: "techcrunch-feed",
  title: "TechCrunch",
  url: "https://techcrunch.com/feed/",
  site_url: "https://techcrunch.com",
  user_id: "user-1",
  created_at: new Date().toISOString(),
  last_fetched_at: new Date().toISOString(),
  category: "Technology",
  is_partial_content: false,
  fetch_full_content: false,
  ...overrides,
});

// Fetch log entry factory
export const createFetchLog = (overrides: any = {}) => ({
  id: "log-" + Math.random().toString(36).substr(2, 9),
  article_id: "article-1",
  feed_id: "feed-1",
  url: "https://example.com/article",
  status: "success",
  response_time_ms: 1234,
  content_length: 5678,
  error_message: null,
  attempted_at: new Date().toISOString(),
  metadata: {
    trigger: "summarization",
    partial_feed: true,
    user_agent: "RSS Reader Bot 1.0",
  },
  ...overrides,
});

// Sample extracted content (what fetch-content returns)
export const createExtractedContent = (overrides: any = {}) => ({
  success: true,
  content: `
    <article class="main-article">
      <header>
        <h1>Full Article Title from Website</h1>
        <time datetime="2024-01-01">January 1, 2024</time>
        <address>By Original Author</address>
      </header>
      
      <div class="article-body">
        <p class="lead">This is the complete lead paragraph that provides
        a comprehensive introduction to the article topic.</p>
        
        <p>The article continues with detailed information that was not
        available in the RSS feed. This includes quotes, statistics, and
        in-depth analysis that readers expect from quality journalism.</p>
        
        <blockquote>
          <p>"This is a relevant quote from an expert in the field that
          adds credibility and perspective to the story."</p>
          <footer>— Expert Name, Title</footer>
        </blockquote>
        
        <p>Additional paragraphs provide context, background, and analysis
        that help readers understand the full scope of the story...</p>
        
        <h2>Key Points</h2>
        <ul>
          <li>Important point number one with supporting details</li>
          <li>Critical insight that wasn't in the RSS summary</li>
          <li>Additional context that enriches understanding</li>
        </ul>
        
        <p>The article concludes with forward-looking statements and
        implications for readers to consider...</p>
      </div>
    </article>
  `.trim(),
  extractedAt: new Date().toISOString(),
  metadata: {
    title: "Full Article Title from Website",
    author: "Original Author",
    publishedDate: "2024-01-01",
    wordCount: 850,
    readingTime: 4,
    images: 3,
  },
  ...overrides,
});

// Error scenarios for testing
export const ERROR_SCENARIOS = {
  TIMEOUT: {
    id: "timeout-article",
    url: "https://slow-website.com/article",
    error: "Timeout: Content extraction exceeded 30 seconds",
  },
  NOT_FOUND: {
    id: "404-article",
    url: "https://example.com/deleted-article",
    error: "HTTP 404: Article not found",
  },
  FORBIDDEN: {
    id: "403-article",
    url: "https://paywall.com/premium-article",
    error: "HTTP 403: Access forbidden - paywall detected",
  },
  NETWORK_ERROR: {
    id: "network-error-article",
    url: "https://unreachable.com/article",
    error: "Network error: Failed to connect",
  },
  PARSING_ERROR: {
    id: "parse-error-article",
    url: "https://broken-html.com/article",
    error: "Parsing error: Unable to extract content",
  },
  RATE_LIMIT: {
    id: "rate-limit-article",
    url: "https://api-limited.com/article",
    error: "Rate limit exceeded: Try again in 60 seconds",
  },
};

// Mock HTML responses for different scenarios
export const MOCK_HTML_RESPONSES = {
  COMPLETE_ARTICLE: `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Complete Article</title>
        <meta property="og:title" content="Complete Article Title" />
        <meta property="og:description" content="Article description" />
      </head>
      <body>
        <article>
          <h1>Complete Article Title</h1>
          <p>Full article content goes here...</p>
        </article>
      </body>
    </html>
  `,
  PAYWALL: `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="paywall-prompt">
          <h2>Subscribe to continue reading</h2>
          <p>This content requires a subscription.</p>
        </div>
      </body>
    </html>
  `,
  MALFORMED: `
    <html>
      <p>Unclosed paragraph
      <div>Mixed up tags</p>
      <script>alert('should be removed')</script>
      Some content
    </html>
  `,
  EMPTY: `
    <!DOCTYPE html>
    <html>
      <body></body>
    </html>
  `,
};

// Performance test data
export const PERFORMANCE_TEST_DATA = {
  SMALL_ARTICLE: "x".repeat(1000), // 1KB
  MEDIUM_ARTICLE: "x".repeat(50000), // 50KB
  LARGE_ARTICLE: "x".repeat(500000), // 500KB
  HUGE_ARTICLE: "x".repeat(5000000), // 5MB
};

// Batch test scenarios
export const createArticleBatch = (
  count: number,
  type: "partial" | "complete" | "mixed"
) => {
  const articles: Article[] = [];

  for (let i = 0; i < count; i++) {
    if (type === "partial") {
      articles.push(createPartialFeedArticle({ id: `batch-partial-${i}` }));
    } else if (type === "complete") {
      articles.push(createCompleteFeedArticle({ id: `batch-complete-${i}` }));
    } else {
      // Mixed: alternate between partial and complete
      const isPartial = i % 2 === 0;
      articles.push(
        isPartial
          ? createPartialFeedArticle({ id: `batch-mixed-${i}` })
          : createCompleteFeedArticle({ id: `batch-mixed-${i}` })
      );
    }
  }

  return articles;
};

// Helper to determine if a URL is from a partial feed domain
export const isPartialFeedUrl = (url: string): boolean => {
  return PARTIAL_FEED_DOMAINS.some((domain) => url.includes(domain));
};

// Helper to generate realistic fetch timing
export const generateFetchTiming = (
  scenario: "fast" | "normal" | "slow" | "timeout"
) => {
  switch (scenario) {
    case "fast":
      return Math.random() * 500 + 200; // 200-700ms
    case "normal":
      return Math.random() * 2000 + 1000; // 1-3 seconds
    case "slow":
      return Math.random() * 10000 + 5000; // 5-15 seconds
    case "timeout":
      return 35000; // Exceeds 30s timeout
    default:
      return 1000;
  }
};
