/**
 * RR-170: Unit Tests for HTML Entity Decoding in Tag Names
 * 
 * These tests are the SPECIFICATION for how tag names with HTML entities
 * must be decoded for display. The implementation MUST conform to these tests.
 * 
 * Test Scope:
 * 1. Decoding function behavior with various HTML entities
 * 2. Security: proper escaping after decoding
 * 3. URL preservation (URLs should NOT be decoded)
 * 4. Edge cases and error handling
 * 5. Performance validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { decodeHtmlEntities } from '@/lib/utils/html-decoder';
import { escapeHtml } from '@/lib/utils/html-escape';
import {
  DECODING_TEST_CASES,
  SECURITY_TEST_CASES,
  URL_PRESERVATION_TEST_CASES,
  EDGE_CASES,
  PROCESSING_ORDER_TEST,
  PERFORMANCE_REQUIREMENTS
} from '../contracts/rr-170-tag-html-entities.contract';

describe('RR-170: Tag HTML Entity Decoding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Core Decoding Functionality', () => {
    DECODING_TEST_CASES.forEach(testCase => {
      it(testCase.description, () => {
        const result = decodeHtmlEntities(testCase.input);
        expect(result).toBe(testCase.expectedDecoded);
      });
    });
  });

  describe('Security: XSS Prevention', () => {
    SECURITY_TEST_CASES.forEach(testCase => {
      it(testCase.description, () => {
        // First decode the entities
        const decoded = decodeHtmlEntities(testCase.input);
        expect(decoded).toBe(testCase.expectedDecoded);
        
        // Then escape for safe rendering
        const escaped = escapeHtml(decoded);
        
        // Should be safe for rendering (no executable code)
        expect(escaped).not.toContain('<script>');
        expect(escaped).not.toContain('javascript:');
        expect(escaped).not.toContain('<img');
        
        // Should contain escaped versions
        expect(escaped).toMatch(/&lt;|&gt;|&quot;|&#039;|&#x2F;/);
      });
    });
  });

  describe('URL Preservation', () => {
    URL_PRESERVATION_TEST_CASES.forEach(testCase => {
      it(testCase.description, () => {
        const result = decodeHtmlEntities(testCase.input);
        expect(result).toBe(testCase.expectedDecoded);
        
        // URLs should remain unchanged (not decoded)
        expect(result).toContain('&amp;');
      });
    });
  });

  describe('Processing Pipeline: Decode → Escape → Render', () => {
    it(PROCESSING_ORDER_TEST.description, () => {
      // Step 1: Decode HTML entities
      const decoded = decodeHtmlEntities(PROCESSING_ORDER_TEST.input);
      expect(decoded).toBe(PROCESSING_ORDER_TEST.afterDecode);
      
      // Step 2: Escape for safe rendering
      const escaped = escapeHtml(decoded);
      expect(escaped).toBe(PROCESSING_ORDER_TEST.afterEscape);
      
      // Final result should be safe for display
      expect(escaped).toBe(PROCESSING_ORDER_TEST.expectedDisplay);
    });
  });

  describe('Edge Cases', () => {
    EDGE_CASES.forEach(testCase => {
      it(testCase.description, () => {
        const result = decodeHtmlEntities(testCase.input);
        expect(result).toBe(testCase.expectedDecoded);
      });
    });

    it('should handle null input', () => {
      const result = decodeHtmlEntities(null);
      expect(result).toBe('');
    });

    it('should handle undefined input', () => {
      const result = decodeHtmlEntities(undefined);
      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      const result = decodeHtmlEntities(123 as any);
      expect(result).toBe('');
    });

    it('should handle very long tag names', () => {
      const longTag = 'Very' + '&amp;'.repeat(100) + 'Long';
      const decoded = decodeHtmlEntities(longTag);
      expect(decoded).toContain('&');
      expect(decoded).not.toContain('&amp;');
    });
  });

  describe('Performance', () => {
    it('should decode single tag within performance threshold', () => {
      const startTime = performance.now();
      const result = decodeHtmlEntities('India&#x2F;Canada &amp; USA');
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.maxDecodingTime);
      expect(result).toBe('India/Canada & USA');
    });

    it('should decode batch of tags within performance threshold', () => {
      const tags = Array(100).fill(null).map((_, i) => 
        `Tag ${i} &amp; More &#x2F; Stuff`
      );
      
      const startTime = performance.now();
      const results = tags.map(tag => decodeHtmlEntities(tag));
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.maxBatchTime);
      expect(results).toHaveLength(100);
      expect(results[0]).toBe('Tag 0 & More / Stuff');
    });
  });

  describe('Integration with escapeHtml', () => {
    it('should properly chain decodeHtmlEntities and escapeHtml', () => {
      const tagName = 'Tech &amp; &lt;Innovation&gt;';
      
      // This is how it should be used in the component
      const displayName = escapeHtml(decodeHtmlEntities(tagName));
      
      // Should decode &amp; to & but escape < and > for safety
      expect(displayName).toBe('Tech &amp; &lt;Innovation&gt;');
    });

    it('should handle already escaped content correctly', () => {
      const alreadyEscaped = '&lt;div&gt;Test&lt;/div&gt;';
      
      // Decode first (converts &lt; to <)
      const decoded = decodeHtmlEntities(alreadyEscaped);
      expect(decoded).toBe('<div>Test</div>');
      
      // Then escape for safety (converts < back to &lt;)
      const safeDisplay = escapeHtml(decoded);
      expect(safeDisplay).toBe('&lt;div&gt;Test&lt;/div&gt;');
    });
  });

  describe('Common Tag Name Patterns', () => {
    const commonPatterns = [
      { input: 'News/Politics', expected: 'News/Politics' },
      { input: 'Science &amp; Tech', expected: 'Science & Tech' },
      { input: 'Q&amp;A', expected: 'Q&A' },
      { input: 'COVID-19', expected: 'COVID-19' },
      { input: 'AI/ML', expected: 'AI/ML' },
      { input: 'R&amp;D', expected: 'R&D' },
      { input: 'M&amp;A', expected: 'M&A' },
      { input: 'B2B/B2C', expected: 'B2B/B2C' },
      { input: 'US &amp; Canada', expected: 'US & Canada' },
      { input: 'Health &amp; Wellness', expected: 'Health & Wellness' }
    ];

    commonPatterns.forEach(({ input, expected }) => {
      it(`should handle common pattern: ${input}`, () => {
        // Test without entities (should remain unchanged)
        expect(decodeHtmlEntities(input)).toBe(expected);
        
        // Test with encoded ampersand (common from Inoreader)
        const encoded = input.replace(/&/g, '&amp;');
        expect(decodeHtmlEntities(encoded)).toBe(expected);
        
        // Test with encoded slash (as reported in bug)
        const slashEncoded = input.replace(/\//g, '&#x2F;');
        expect(decodeHtmlEntities(slashEncoded)).toBe(expected);
      });
    });
  });

  describe('Database Value Preservation', () => {
    it('should not modify the original database value', () => {
      const dbValue = 'India&#x2F;Canada';
      const originalValue = dbValue;
      
      // Decoding creates a new string, doesn't modify original
      const decoded = decodeHtmlEntities(dbValue);
      
      expect(dbValue).toBe(originalValue); // Original unchanged
      expect(decoded).toBe('India/Canada'); // New decoded value
      expect(dbValue).not.toBe(decoded); // Different values
    });

    it('should work with tag objects from database', () => {
      const tagFromDb = {
        id: 'tag-123',
        name: 'Tech &amp; Science',
        slug: 'tech-science',
        articleCount: 42
      };
      
      const originalName = tagFromDb.name;
      
      // Display transformation
      const displayName = decodeHtmlEntities(tagFromDb.name);
      
      // Database object remains unchanged
      expect(tagFromDb.name).toBe(originalName);
      expect(displayName).toBe('Tech & Science');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed entities gracefully', () => {
      const malformed = [
        'Tag &amp',      // Missing semicolon
        'Tag &#x2F',     // Missing semicolon
        'Tag &unknown;', // Unknown entity
        'Tag &#99999;',  // Invalid numeric entity
        'Tag &#xGGGG;'   // Invalid hex entity
      ];

      malformed.forEach(input => {
        expect(() => decodeHtmlEntities(input)).not.toThrow();
        const result = decodeHtmlEntities(input);
        expect(typeof result).toBe('string');
      });
    });

    it('should log warning for decoding failures', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Force an error by mocking the decode function to throw
      const { decode } = await import('he');
      vi.spyOn({ decode }, 'decode').mockImplementationOnce(() => {
        throw new Error('Decoding error');
      });
      
      const result = decodeHtmlEntities('Test &amp; Error');
      
      // Should return original on error
      expect(result).toBe('Test &amp; Error');
      
      // Should log the error
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });
  });
});