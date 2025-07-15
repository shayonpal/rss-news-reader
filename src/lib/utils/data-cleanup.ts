// Utility functions for cleaning up corrupted article data

/**
 * Safely extracts text content from potentially corrupted data
 */
export function extractTextContent(data: any): string {
  // If it's already a string, return it
  if (typeof data === 'string') {
    return data;
  }
  
  // If it's null or undefined, return empty string
  if (data == null) {
    return '';
  }
  
  // If it's an object with a content property, extract it
  if (typeof data === 'object' && 'content' in data) {
    if (typeof data.content === 'string') {
      return data.content;
    }
  }
  
  // If it's an object without content property, try to convert to string
  if (typeof data === 'object') {
    try {
      // Check if it looks like a content object that should be stringified
      if ('direction' in data && typeof data.direction === 'string') {
        console.warn('Found object with direction property, likely corrupted InoreaderContent:', data);
        return JSON.stringify(data);
      }
      
      // For any other object, return empty string to avoid [object Object]
      console.warn('Found unexpected object type, returning empty string:', data);
      return '';
    } catch (error) {
      console.error('Error processing object data:', error);
      return '';
    }
  }
  
  // For any other type, convert to string
  return String(data);
}

/**
 * Checks if article data has corrupted content fields
 */
export function isArticleDataCorrupted(article: any): boolean {
  if (!article) return false;
  
  // Check if content or summary are objects instead of strings
  const hasCorruptedContent = typeof article.content === 'object' && article.content !== null;
  const hasCorruptedSummary = typeof article.summary === 'object' && article.summary !== null;
  
  return hasCorruptedContent || hasCorruptedSummary;
}

/**
 * Cleans up a single article's data
 */
export function cleanupArticleData(article: any): any {
  if (!article) return article;
  
  return {
    ...article,
    content: extractTextContent(article.content),
    summary: extractTextContent(article.summary),
  };
}