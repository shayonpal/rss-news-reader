import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../html-escape';

describe('HTML Escape Utility', () => {
  it('should escape HTML special characters', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;&#x2F;script&gt;');
    expect(escapeHtml('<img src="x" onerror="alert(1)">')).toBe('&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;');
    expect(escapeHtml("'; DROP TABLE users; --")).toBe('&#039;; DROP TABLE users; --');
    expect(escapeHtml('Test & "quotes" <tags>')).toBe('Test &amp; &quot;quotes&quot; &lt;tags&gt;');
  });

  it('should handle empty and null inputs', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null as any)).toBe('');
    expect(escapeHtml(undefined as any)).toBe('');
  });

  it('should not modify safe strings', () => {
    expect(escapeHtml('Normal text')).toBe('Normal text');
    expect(escapeHtml('Numbers 123')).toBe('Numbers 123');
    expect(escapeHtml('Special chars: !@#$%^*()')).toBe('Special chars: !@#$%^*()');
  });

  it('should escape forward slashes for complete XSS protection', () => {
    expect(escapeHtml('</script>')).toBe('&lt;&#x2F;script&gt;');
    expect(escapeHtml('javascript:alert(1)')).toBe('javascript:alert(1)');
  });
});