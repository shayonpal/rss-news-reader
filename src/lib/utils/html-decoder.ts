import { decode } from 'he';

/**
 * RR-154: HTML Entity Decoder Module
 * 
 * Provides safe HTML entity decoding for article titles and content while preserving URLs.
 * Uses the 'he' library for standards-compliant decoding of HTML entities.
 * 
 * Key Requirements:
 * - Decode common entities: &rsquo;, &amp;, &lsquo;, &quot;, &#8217;, &ndash;, etc.
 * - URLs must NEVER be decoded to preserve query parameters
 * - Handle null/undefined gracefully
 * - Performance: <1ms per article, <200ms for 200 articles
 */

/**
 * Checks if text appears to be a URL that should not be decoded
 * Enhanced to catch more URL patterns and edge cases
 */
export function isSafeUrl(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Check for absolute URLs with protocols
  if (text.startsWith('http://') || text.startsWith('https://') || 
      text.startsWith('feed://') || text.startsWith('ftp://') ||
      text.startsWith('tag:') || text.includes('://')) {
    return true;
  }

  // Check for URLs with query parameters (common case for entities in URLs)
  if (text.includes('?') && (text.includes('&amp;') || text.includes('='))) {
    return true;
  }

  // Check for common URL patterns without protocol
  if (text.match(/^(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&=]*)/)) {
    return true;
  }

  // Check for Inoreader/Google Reader style IDs
  if (text.startsWith('user/') || text.startsWith('state/com.google/')) {
    return true;
  }

  return false;
}

/**
 * Decodes HTML entities in text content while preserving URLs
 */
export function decodeHtmlEntities(text: string | null | undefined): string {
  // Handle null/undefined gracefully
  if (!text) {
    return text === null ? '' : (text === undefined ? '' : '');
  }

  // Convert non-string types to empty string
  if (typeof text !== 'string') {
    return '';
  }

  // Don't decode URLs
  if (isSafeUrl(text)) {
    return text;
  }

  try {
    // Use he library for standards-compliant decoding
    return decode(text);
  } catch (error) {
    // Track decoding failures for monitoring
    const errorDetails = {
      input: text.substring(0, 100), // Limit for privacy
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
    
    console.warn('HTML entity decoding failed:', errorDetails);
    
    // TODO: Add metrics tracking for production monitoring
    // trackDecodingFailure(errorDetails);
    
    return text;
  }
}

/**
 * Article data structure for decoding
 */
interface ArticleData {
  id?: string;
  title?: string | null;
  content?: string | null;
  description?: string | null;
  url?: string;
  canonical_url?: string;
  inoreader_id?: string;
  [key: string]: any;
}

/**
 * Decodes HTML entities in article title, content, and description while preserving other fields
 */
export function decodeArticleData(article: ArticleData | null | undefined): ArticleData {
  if (!article || typeof article !== 'object') {
    return article || {};
  }

  const decoded = { ...article };

  // Decode title if present
  if (decoded.title !== null && decoded.title !== undefined) {
    decoded.title = decodeHtmlEntities(decoded.title);
  }

  // Decode content if present
  if (decoded.content !== null && decoded.content !== undefined) {
    decoded.content = decodeHtmlEntities(decoded.content);
  }

  // Decode description if present
  if (decoded.description !== null && decoded.description !== undefined) {
    decoded.description = decodeHtmlEntities(decoded.description);
  }

  // Preserve URLs exactly as-is (do not decode)
  // url, canonical_url, inoreader_id should remain unchanged

  return decoded;
}

/**
 * Processes multiple articles efficiently with batch decoding
 */
export function decodeArticleBatch(articles: ArticleData[] | null | undefined): ArticleData[] {
  if (!articles || !Array.isArray(articles)) {
    return [];
  }

  return articles.map(article => decodeArticleData(article));
}

/**
 * Legacy compatibility functions for existing codebase patterns
 */

/**
 * Decodes HTML entities in article title specifically
 */
export function decodeTitle(title: string | null | undefined): string {
  return decodeHtmlEntities(title);
}

/**
 * Decodes HTML entities in article content specifically
 */
export function decodeContent(content: string | null | undefined): string {
  return decodeHtmlEntities(content);
}

/**
 * Batch processing with performance tracking for migration scenarios
 */
export function batchDecodeArticles(
  articles: ArticleData[],
  options: { chunkSize?: number; onProgress?: (processed: number, total: number) => void } = {}
): ArticleData[] {
  const { chunkSize = 200, onProgress } = options;
  const total = articles.length;
  const results: ArticleData[] = [];

  for (let i = 0; i < articles.length; i += chunkSize) {
    const chunk = articles.slice(i, i + chunkSize);
    const decodedChunk = decodeArticleBatch(chunk);
    results.push(...decodedChunk);

    if (onProgress) {
      onProgress(Math.min(i + chunkSize, total), total);
    }
  }

  return results;
}