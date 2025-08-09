import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities } from '@/lib/utils/html-decoder';
import { escapeHtml } from '@/lib/utils/html-escape';

/**
 * RR-170: Unit tests for HTML entity decoding in tag names
 * 
 * These tests are the SPECIFICATION for tag name decoding behavior.
 * The implementation MUST conform to these tests.
 * 
 * Problem Statement:
 * - Tag names with HTML entities display encoded in sidebar (e.g., "India&#x2F;Canada")
 * - Should display decoded (e.g., "India/Canada") while maintaining XSS protection
 * 
 * Security Requirement:
 * - Processing order MUST be: decode → escape → render
 * - URLs must NEVER be decoded
 */
describe('RR-170: Tag Name HTML Entity Decoding', () => {
  
  describe('Core HTML Entity Decoding', () => {
    it('should decode forward slash entity (&#x2F;)', () => {
      const input = 'India&#x2F;Canada';
      const expected = 'India/Canada';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode ampersand entity (&amp;)', () => {
      const input = 'Tech &amp; Science';
      const expected = 'Tech & Science';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode en-dash entity (&#8211;)', () => {
      const input = 'News&#8211;Updates';
      const expected = 'News–Updates';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode multiple ampersands in Q&A format', () => {
      const input = 'Q&amp;A';
      const expected = 'Q&A';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode multiple entities in one tag name', () => {
      const input = 'Finance &amp; Markets&#8211;2025';
      const expected = 'Finance & Markets–2025';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should handle tag names without entities', () => {
      const input = 'normal-tag';
      const expected = 'normal-tag';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode less-than and greater-than entities', () => {
      expect(decodeHtmlEntities('&lt;Tech&gt;')).toBe('<Tech>');
      expect(decodeHtmlEntities('Code&lt;/&gt;Review')).toBe('Code</>Review');
    });

    it('should decode quote entities', () => {
      expect(decodeHtmlEntities('&quot;Breaking&quot; News')).toBe('"Breaking" News');
      expect(decodeHtmlEntities('Today&apos;s News')).toBe("Today's News");
    });

    it('should decode numeric character references', () => {
      expect(decodeHtmlEntities('News &#8212; Daily')).toBe('News — Daily'); // em-dash
      expect(decodeHtmlEntities('Tech&#8230;')).toBe('Tech…'); // ellipsis
      expect(decodeHtmlEntities('&#169; Copyright')).toBe('© Copyright');
    });

    it('should decode HTML5 named entities', () => {
      expect(decodeHtmlEntities('&copy; 2025')).toBe('© 2025');
      expect(decodeHtmlEntities('&reg; Trademark')).toBe('® Trademark');
      expect(decodeHtmlEntities('&trade; Brand')).toBe('™ Brand');
    });

    it('should handle empty and null inputs gracefully', () => {
      expect(decodeHtmlEntities('')).toBe('');
      expect(decodeHtmlEntities(null)).toBe('');
      expect(decodeHtmlEntities(undefined)).toBe('');
    });

    it('should decode mixed entity types in complex tag names', () => {
      const input = 'Tech &amp; Innovation &#8211; AI&#x2F;ML &copy; 2025';
      const expected = 'Tech & Innovation – AI/ML © 2025';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should handle partial or malformed entities', () => {
      // The 'he' library correctly handles malformed entities
      // If it's not a complete entity, it preserves the original text
      expect(decodeHtmlEntities('Tech &amp Science')).toBe('Tech & Science'); // &amp is decoded, then ' Science' is kept
      expect(decodeHtmlEntities('News & Updates')).toBe('News & Updates');
    });

    it('should decode nbsp and other whitespace entities', () => {
      expect(decodeHtmlEntities('Tech&nbsp;News')).toBe('Tech\u00A0News');
      expect(decodeHtmlEntities('Line&ensp;Break')).toBe('Line\u2002Break');
    });

    it('should handle international characters with entities', () => {
      expect(decodeHtmlEntities('Caf&eacute;')).toBe('Café');
      expect(decodeHtmlEntities('&Uuml;ber')).toBe('Über');
      expect(decodeHtmlEntities('Se&ntilde;or')).toBe('Señor');
    });
  });

  describe('Security: Decode then Escape Pipeline', () => {
    it('should escape HTML after decoding to prevent XSS', () => {
      const tagName = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
      
      // Step 1: Decode HTML entities
      const decoded = decodeHtmlEntities(tagName);
      expect(decoded).toBe('<script>alert("XSS")</script>');
      
      // Step 2: Escape for safe rendering
      const escaped = escapeHtml(decoded);
      // The escapeHtml function also escapes forward slashes
      expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
    });

    it('should handle onclick attribute injection attempts', () => {
      const malicious = '&lt;span onclick=&quot;alert(1)&quot;&gt;Tag&lt;/span&gt;';
      const decoded = decodeHtmlEntities(malicious);
      const escaped = escapeHtml(decoded);
      
      // Should be safely escaped for rendering - the escaped version contains the text 'onclick' but it's escaped
      expect(escaped).toContain('onclick'); // It contains the text but safely escaped
      expect(escaped).toContain('&lt;span');
      expect(escaped).toContain('&quot;');
    });

    it('should handle javascript: protocol attempts', () => {
      const malicious = '&lt;a href=&quot;javascript:alert(1)&quot;&gt;Tag&lt;/a&gt;';
      const decoded = decodeHtmlEntities(malicious);
      const escaped = escapeHtml(decoded);
      
      // The text 'javascript:' is present but safely escaped
      expect(escaped).toContain('javascript:'); // It's present but as escaped text, not executable
      expect(escaped).toContain('&lt;a');
      expect(escaped).toContain('&quot;');
    });

    it('should preserve normal tag names through decode-escape pipeline', () => {
      const normal = 'Tech & Science';
      const processed = escapeHtml(decodeHtmlEntities('Tech &amp; Science'));
      expect(processed).toBe('Tech &amp; Science');
    });
  });

  describe('URL Preservation', () => {
    it('should NOT decode URLs to preserve query parameters', () => {
      const url = 'https://example.com?tag=Tech&amp;category=Science';
      expect(decodeHtmlEntities(url)).toBe(url); // URL should remain unchanged
    });

    it('should NOT decode Inoreader-style URLs', () => {
      const inoreaderUrl = 'user/1234/label/Tech&amp;Science';
      expect(decodeHtmlEntities(inoreaderUrl)).toBe(inoreaderUrl);
    });

    it('should NOT decode feed URLs', () => {
      const feedUrl = 'feed://example.com/rss?category=Tech&amp;News';
      expect(decodeHtmlEntities(feedUrl)).toBe(feedUrl);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should decode single tag in under 1ms', () => {
      const start = performance.now();
      decodeHtmlEntities('India&#x2F;Canada');
      const end = performance.now();
      
      expect(end - start).toBeLessThan(1);
    });

    it('should decode 100 tags in under 50ms', () => {
      const tags = Array.from({ length: 100 }, (_, i) => 
        `Tag ${i} &amp; Category&#x2F;Subcategory&#8211;${i}`
      );
      
      const start = performance.now();
      tags.forEach(tag => decodeHtmlEntities(tag));
      const end = performance.now();
      
      expect(end - start).toBeLessThan(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long tag names', () => {
      const longTag = 'Very ' + '&amp; '.repeat(100) + 'Long Tag';
      const decoded = decodeHtmlEntities(longTag);
      expect(decoded).toContain('& & & &');
      expect(decoded).not.toContain('&amp;');
    });

    it('should handle tag names with only entities', () => {
      expect(decodeHtmlEntities('&amp;&amp;&amp;')).toBe('&&&');
      expect(decodeHtmlEntities('&#x2F;&#x2F;&#x2F;')).toBe('///');
    });

    it('should handle consecutive different entities', () => {
      const input = '&lt;&gt;&amp;&quot;&apos;';
      const expected = '<>&"\'';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should handle Unicode entities', () => {
      expect(decodeHtmlEntities('&#x1F4BB;')).toBe('💻'); // laptop emoji
      expect(decodeHtmlEntities('&#128187;')).toBe('💻'); // same emoji, decimal
    });
  });
});