/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param unsafe - The unsafe string to escape
 * @returns The escaped string safe for rendering
 */
export function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Unescapes HTML entities back to their original characters
 * @param escaped - The escaped string
 * @returns The unescaped string
 */
export function unescapeHtml(escaped: string): string {
  if (!escaped) return '';
  
  const div = document.createElement('div');
  div.innerHTML = escaped;
  return div.textContent || div.innerText || '';
}