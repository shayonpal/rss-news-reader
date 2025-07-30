/**
 * Process HTML content to ensure all links open in new tabs
 * and fix iOS double-tap issues
 */
export function processArticleLinks(html: string): string {
  // Create a temporary container to parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Find all anchor tags
  const links = doc.querySelectorAll("a");

  links.forEach((link) => {
    // Add target="_blank" to open in new tab
    link.setAttribute("target", "_blank");

    // Add rel="noopener noreferrer" for security
    link.setAttribute("rel", "noopener noreferrer");
  });

  // Return the processed HTML
  return doc.body.innerHTML;
}

/**
 * Process HTML content for server-side rendering (without DOM APIs)
 * Uses regex for environments where DOMParser is not available
 */
export function processArticleLinksSSR(html: string): string {
  // Match all anchor tags
  return html.replace(/<a\s+([^>]*?)>/gi, (match, attributes) => {
    // Check if target already exists
    const hasTarget = /target\s*=\s*["'][^"']*["']/i.test(attributes);
    const hasRel = /rel\s*=\s*["'][^"']*["']/i.test(attributes);

    // Add or update attributes
    let newAttributes = attributes;

    if (!hasTarget) {
      newAttributes += ' target="_blank"';
    } else {
      // Replace existing target
      newAttributes = newAttributes.replace(
        /target\s*=\s*["'][^"']*["']/i,
        'target="_blank"'
      );
    }

    if (!hasRel) {
      newAttributes += ' rel="noopener noreferrer"';
    } else {
      // Update existing rel to include our values
      newAttributes = newAttributes.replace(
        /rel\s*=\s*["']([^"']*)["']/i,
        (relMatch: string, relValue: string) => {
          const values = new Set(relValue.split(/\s+/));
          values.add("noopener");
          values.add("noreferrer");
          return `rel="${Array.from(values).join(" ")}"`;
        }
      );
    }

    return `<a ${newAttributes}>`;
  });
}
