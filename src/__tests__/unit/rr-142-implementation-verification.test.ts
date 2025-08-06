import { describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

describe('RR-142: Verify author field implementation', () => {
  it('should confirm that sync route now includes author field mapping', async () => {
    // Read the actual sync route file
    const syncRoutePath = path.join(
      process.cwd(), 
      'src', 
      'app', 
      'api', 
      'sync', 
      'route.ts'
    );
    
    const fileContent = await fs.readFile(syncRoutePath, 'utf-8');
    
    // Find the article mapping section
    const lines = fileContent.split('\n');
    
    // Look for the return statement that maps articles
    let mappingStartIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('return {') && 
          lines[i + 1]?.includes('feed_id: feedId')) {
        mappingStartIndex = i;
        break;
      }
    }
    
    expect(mappingStartIndex).toBeGreaterThan(-1);
    
    // Extract the mapping object
    const mappingLines = lines.slice(mappingStartIndex, mappingStartIndex + 20);
    const mappingContent = mappingLines.join('\n');
    
    // Verify author field is now present
    expect(mappingContent).toContain('author: article.author || null');
    
    // Verify the complete structure
    expect(mappingContent).toContain('feed_id: feedId');
    expect(mappingContent).toContain('inoreader_id: article.id');
    expect(mappingContent).toContain('title: article.title || "Untitled"');
    expect(mappingContent).toContain('content: article.content?.content || article.summary?.content || ""');
    expect(mappingContent).toContain('is_read:');
    expect(mappingContent).toContain('is_starred:');
    expect(mappingContent).toContain('last_sync_update: syncTimestamp');
  });
  
  it('should verify author field is positioned correctly after title', async () => {
    const syncRoutePath = path.join(
      process.cwd(), 
      'src', 
      'app', 
      'api', 
      'sync', 
      'route.ts'
    );
    
    const fileContent = await fs.readFile(syncRoutePath, 'utf-8');
    const lines = fileContent.split('\n');
    
    // Find line with title mapping
    const titleLineIndex = lines.findIndex(line => 
      line.includes('title: article.title || "Untitled"')
    );
    
    expect(titleLineIndex).toBeGreaterThan(-1);
    
    // The author field should be right after the title line
    const authorLine = lines[titleLineIndex + 1];
    
    expect(authorLine).toContain('author: article.author || null');
  });
  
  it('should handle author field correctly with fallback to null', async () => {
    const syncRoutePath = path.join(
      process.cwd(), 
      'src', 
      'app', 
      'api', 
      'sync', 
      'route.ts'
    );
    
    const fileContent = await fs.readFile(syncRoutePath, 'utf-8');
    
    // Find the author line
    const authorLineMatch = fileContent.match(/author:\s*article\.author\s*\|\|\s*null/);
    
    expect(authorLineMatch).toBeTruthy();
    expect(authorLineMatch![0]).toBe('author: article.author || null');
  });
});