/**
 * Contract Schemas for RR-170: Tag HTML Entity Decoding
 *
 * Defines runtime validation contracts for HTML entity decoding in tag names.
 * These schemas ensure proper decoding while maintaining XSS protection.
 */

import { z } from "zod";

/**
 * Schema for tag with encoded HTML entities
 */
export const EncodedTagSchema = z
  .object({
    id: z.string(),
    name: z.string(), // May contain HTML entities like &amp; or &#x2F;
    slug: z.string(),
    articleCount: z.number().nonnegative(),
    lastUsed: z.string().datetime().optional(),
  })
  .strict();

export type EncodedTag = z.infer<typeof EncodedTagSchema>;

/**
 * Schema for decoded tag display
 */
export const DecodedTagSchema = z
  .object({
    id: z.string(),
    displayName: z.string(), // Decoded and escaped for safe display
    originalName: z.string(), // Original encoded name from database
    slug: z.string(),
    articleCount: z.number().nonnegative(),
    lastUsed: z.string().datetime().optional(),
  })
  .strict();

export type DecodedTag = z.infer<typeof DecodedTagSchema>;

/**
 * Schema for HTML entity decoding test case
 */
export const DecodingTestCaseSchema = z
  .object({
    input: z.string(),
    expectedDecoded: z.string(),
    expectedEscaped: z.string(),
    description: z.string(),
  })
  .strict();

export type DecodingTestCase = z.infer<typeof DecodingTestCaseSchema>;

/**
 * Common HTML entities found in tag names
 */
export const COMMON_HTML_ENTITIES = {
  "&amp;": "&",
  "&#x2F;": "/",
  "&#8211;": "–", // en-dash
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#8212;": "—", // em-dash
  "&#8230;": "…", // ellipsis
  "&copy;": "©",
  "&reg;": "®",
  "&trade;": "™",
  "&nbsp;": "\u00A0", // non-breaking space
} as const;

/**
 * XSS attack patterns that must be escaped after decoding
 */
export const XSS_PATTERNS = [
  "<script>",
  "</script>",
  "javascript:",
  "onclick=",
  "onerror=",
  "<img",
  "<iframe",
  "eval(",
  "document.write",
  "innerHTML",
] as const;

/**
 * Contract validation functions
 */
export const TagDecodingValidation = {
  /**
   * Validates that a tag is properly decoded
   */
  validateDecodedTag: (tag: unknown): DecodedTag => {
    const validated = DecodedTagSchema.parse(tag);

    // Ensure no HTML entities remain in display name
    for (const entity of Object.keys(COMMON_HTML_ENTITIES)) {
      if (validated.displayName.includes(entity)) {
        throw new Error(`Display name contains undecoded entity: ${entity}`);
      }
    }

    return validated;
  },

  /**
   * Validates that decoded content is properly escaped
   */
  validateXSSProtection: (content: string): void => {
    // Check for unescaped XSS patterns
    for (const pattern of XSS_PATTERNS) {
      if (content.includes(pattern)) {
        throw new Error(`Unescaped XSS pattern detected: ${pattern}`);
      }
    }
  },

  /**
   * Validates the decode-then-escape pipeline
   */
  validateProcessingPipeline: (
    input: string,
    decoded: string,
    escaped: string
  ): void => {
    // Step 1: Verify decoding happened
    if (input.includes("&amp;") && decoded.includes("&amp;")) {
      throw new Error("HTML entities were not decoded");
    }

    // Step 2: Verify escaping happened
    if (decoded.includes("<") && !escaped.includes("&lt;")) {
      throw new Error("Dangerous characters were not escaped");
    }

    // Step 3: Verify no double-escaping
    if (escaped.includes("&amp;lt;") || escaped.includes("&amp;gt;")) {
      throw new Error("Content was double-escaped");
    }
  },

  /**
   * Validates that URLs are NOT decoded (preserving query parameters)
   */
  validateURLPreservation: (url: string, processed: string): void => {
    if (url.includes("?") && url.includes("&amp;")) {
      // URLs with query parameters should preserve &amp;
      if (!processed.includes("&amp;") && processed.includes("&")) {
        throw new Error("URL query parameters were incorrectly decoded");
      }
    }
  },
};

/**
 * Test cases for HTML entity decoding
 */
export const STANDARD_DECODING_TESTS: DecodingTestCase[] = [
  {
    input: "India&#x2F;Canada",
    expectedDecoded: "India/Canada",
    expectedEscaped: "India/Canada",
    description: "Forward slash entity",
  },
  {
    input: "Tech &amp; Science",
    expectedDecoded: "Tech & Science",
    expectedEscaped: "Tech &amp; Science",
    description: "Ampersand entity",
  },
  {
    input: "News&#8211;Updates",
    expectedDecoded: "News–Updates",
    expectedEscaped: "News–Updates",
    description: "En-dash entity",
  },
  {
    input: "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;",
    expectedDecoded: '<script>alert("XSS")</script>',
    expectedEscaped: "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;",
    description: "XSS attempt",
  },
];

/**
 * Performance requirements for decoding
 */
export const PERFORMANCE_REQUIREMENTS = {
  maxDecodingTime: 1, // ms per tag
  maxBatchTime: 50, // ms for 100 tags
  maxMemoryUsage: 10 * 1024 * 1024, // 10MB for batch processing
} as const;
