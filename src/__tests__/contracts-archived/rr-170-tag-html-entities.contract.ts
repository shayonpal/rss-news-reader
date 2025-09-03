/**
 * RR-170: Test Contract for HTML Entity Decoding in Tag Names
 *
 * This contract defines the SPECIFICATION for how tag names with HTML entities
 * must be decoded and displayed in the UI. Implementation must conform to these tests.
 *
 * Test Coverage:
 * - 15 different HTML entity types
 * - Security validation (XSS prevention)
 * - URL preservation
 * - Performance benchmarks
 */

export interface TagTestCase {
  description: string;
  tag: {
    id: string;
    name: string; // With HTML entities
    slug: string;
    articleCount: number;
    color?: string | null;
  };
  expectedDisplay: string; // After decoding
  shouldDecodeUrls: boolean;
}

/**
 * Core HTML entity decoding test cases
 * These define the exact behavior required for tag name decoding
 */
export const CORE_DECODING_CASES = [
  {
    input: "India&#x2F;Canada",
    expected: "India/Canada",
    description: "Forward slash entity",
  },
  {
    input: "Tech &amp; Science",
    expected: "Tech & Science",
    description: "Ampersand entity",
  },
  {
    input: "News&#8211;Updates",
    expected: "News–Updates",
    description: "En-dash entity",
  },
  {
    input: "Q&amp;A",
    expected: "Q&A",
    description: "Q&A format",
  },
  {
    input: "Finance &amp; Markets",
    expected: "Finance & Markets",
    description: "Multiple words with ampersand",
  },
  {
    input: "&lt;Tech&gt;",
    expected: "<Tech>",
    description: "Less-than and greater-than",
  },
  {
    input: "&quot;Breaking&quot; News",
    expected: '"Breaking" News',
    description: "Quote entities",
  },
  {
    input: "Today&apos;s News",
    expected: "Today's News",
    description: "Apostrophe entity",
  },
  {
    input: "News &#8212; Daily",
    expected: "News — Daily",
    description: "Em-dash numeric entity",
  },
  {
    input: "Tech&#8230;",
    expected: "Tech…",
    description: "Ellipsis entity",
  },
  {
    input: "&#169; Copyright",
    expected: "© Copyright",
    description: "Copyright symbol",
  },
  {
    input: "&copy; 2025",
    expected: "© 2025",
    description: "Named copyright entity",
  },
  {
    input: "&reg; Trademark",
    expected: "® Trademark",
    description: "Registered trademark",
  },
  {
    input: "&trade; Brand",
    expected: "™ Brand",
    description: "Trademark symbol",
  },
  {
    input: "Tech &amp; Innovation &#8211; AI&#x2F;ML &copy; 2025",
    expected: "Tech & Innovation – AI/ML © 2025",
    description: "Mixed entity types",
  },
];

/**
 * Component test cases for SimpleFeedSidebar
 */
export const COMPONENT_TEST_CASES: TagTestCase[] = [
  {
    description: "India/Canada with forward slash",
    tag: {
      id: "tag-1",
      name: "India&#x2F;Canada",
      slug: "india-canada",
      articleCount: 42,
      color: "#FF5733",
    },
    expectedDisplay: "India/Canada",
    shouldDecodeUrls: false,
  },
  {
    description: "Tech & Science with ampersand",
    tag: {
      id: "tag-2",
      name: "Tech &amp; Science",
      slug: "tech-science",
      articleCount: 156,
      color: "#3366CC",
    },
    expectedDisplay: "Tech & Science",
    shouldDecodeUrls: false,
  },
  {
    description: "News–Updates with en-dash",
    tag: {
      id: "tag-3",
      name: "News&#8211;Updates",
      slug: "news-updates",
      articleCount: 89,
      color: "#95E77E",
    },
    expectedDisplay: "News–Updates",
    shouldDecodeUrls: false,
  },
  {
    description: "Q&A format",
    tag: {
      id: "tag-4",
      name: "Q&amp;A",
      slug: "q-and-a",
      articleCount: 23,
      color: null,
    },
    expectedDisplay: "Q&A",
    shouldDecodeUrls: false,
  },
  {
    description: "Finance & Markets",
    tag: {
      id: "tag-5",
      name: "Finance &amp; Markets",
      slug: "finance-markets",
      articleCount: 345,
      color: "#A8DADC",
    },
    expectedDisplay: "Finance & Markets",
    shouldDecodeUrls: false,
  },
];

/**
 * Security test cases - XSS prevention
 */
export const SECURITY_TEST_CASES = [
  {
    input: '&lt;script&gt;alert("xss")&lt;/script&gt;',
    decoded: '<script>alert("xss")</script>',
    escaped: "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    description: "Script tag injection",
  },
  {
    input: "&lt;img src=x onerror=alert(1)&gt;",
    decoded: "<img src=x onerror=alert(1)>",
    escaped: "&lt;img src=x onerror=alert(1)&gt;",
    description: "Image tag with onerror",
  },
  {
    input: '&lt;a href="javascript:alert(1)"&gt;Click&lt;/a&gt;',
    decoded: '<a href="javascript:alert(1)">Click</a>',
    escaped: "&lt;a href=&quot;javascript:alert(1)&quot;&gt;Click&lt;/a&gt;",
    description: "JavaScript protocol",
  },
];

/**
 * URL preservation test cases
 * These URLs should NOT be decoded to preserve their integrity
 */
export const URL_PRESERVATION_CASES = [
  "https://example.com?tag=Tech&amp;category=Science",
  "http://site.com/path?a=1&amp;b=2&amp;c=3",
  "feed://example.com/rss?category=Tech&amp;News",
  "user/1234/label/Tech&amp;Science",
  "state/com.google/label/News&amp;Updates",
];

/**
 * Performance benchmarks
 */
export const PERFORMANCE_BENCHMARKS = {
  singleTagDecode: {
    maxMs: 1,
    description: "Single tag decode should complete in under 1ms",
  },
  batchDecode100Tags: {
    maxMs: 50,
    description: "100 tags should decode in under 50ms",
  },
  componentRender50Tags: {
    maxMs: 500,
    description: "Component should render 50 tags in under 500ms",
  },
  apiResponse100Tags: {
    maxMs: 1000,
    description: "API should return 100 tags in under 1 second",
  },
};

/**
 * Processing pipeline requirement
 * CRITICAL: The order MUST be decode → escape → render
 */
export const PROCESSING_PIPELINE = {
  step1: "decodeHtmlEntities",
  step2: "escapeHtml",
  step3: "render",
  description:
    "Security requirement: decode first, then escape for safe rendering",
};

/**
 * Edge cases to test
 */
export const EDGE_CASES = [
  {
    input: "",
    expected: "",
    description: "Empty string",
  },
  {
    input: null,
    expected: "",
    description: "Null value",
  },
  {
    input: undefined,
    expected: "",
    description: "Undefined value",
  },
  {
    input: "&amp;&amp;&amp;",
    expected: "&&&",
    description: "Multiple consecutive entities",
  },
  {
    input: "&#x2F;&#x2F;&#x2F;",
    expected: "///",
    description: "Multiple slashes",
  },
  {
    input: "&lt;&gt;&amp;&quot;&apos;",
    expected: "<>&\"'",
    description: "All common entities",
  },
  {
    input: "Normal tag without entities",
    expected: "Normal tag without entities",
    description: "No entities to decode",
  },
];

/**
 * Acceptance criteria from Linear issue RR-170
 */
export const ACCEPTANCE_CRITERIA = {
  tagNamesDecoded: "Tag names render decoded (text-only), matching DB values",
  urlsNotDecoded: "No decoding applied to URLs",
  unitTestCoverage:
    "Unit test for sample entities (&#x2F;, &amp;, numeric entities)",
  xssPrevention: "Ensure no XSS vector (decode text only)",
  consistentLayer: "Keep decoding at render layer or on ingest consistently",
};

/**
 * Test summary
 */
export const TEST_SUMMARY = {
  totalTestCases: 70,
  unitTests: 30,
  integrationTests: 20,
  componentTests: 20,
  categories: [
    "Core HTML entity decoding",
    "Security (XSS prevention)",
    "URL preservation",
    "Performance benchmarks",
    "Edge cases",
    "Visual elements",
    "User interaction",
    "Accessibility",
  ],
};
