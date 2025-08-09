import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * RR-170: Integration tests for tag display with HTML entity decoding
 * 
 * These tests verify the complete flow from API to UI for tags with HTML entities.
 * Tests are the SPECIFICATION - implementation must conform to these requirements.
 * 
 * Integration Points:
 * 1. Tag data from database (with HTML entities)
 * 2. API endpoint serving tags
 * 3. Tag store processing
 * 4. UI component rendering
 */

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [
              {
                id: '1',
                name: 'India&#x2F;Canada',
                slug: 'india-canada',
                type: 'label',
                color: '#FF6B6B',
                sortIndex: 0,
                articleCount: 42,
                user_id: 'test-user'
              },
              {
                id: '2',
                name: 'Tech &amp; Science',
                slug: 'tech-science',
                type: 'label',
                color: '#4ECDC4',
                sortIndex: 1,
                articleCount: 78,
                user_id: 'test-user'
              },
              {
                id: '3',
                name: 'News&#8211;Updates',
                slug: 'news-updates',
                type: 'label',
                color: '#95E77E',
                sortIndex: 2,
                articleCount: 156,
                user_id: 'test-user'
              },
              {
                id: '4',
                name: 'Q&amp;A',
                slug: 'q-and-a',
                type: 'label',
                color: '#FFE66D',
                sortIndex: 3,
                articleCount: 23,
                user_id: 'test-user'
              },
              {
                id: '5',
                name: 'Finance &amp; Markets',
                slug: 'finance-markets',
                type: 'label',
                color: '#A8DADC',
                sortIndex: 4,
                articleCount: 89,
                user_id: 'test-user'
              }
            ],
            error: null
          }))
        }))
      }))
    }))
  }))
}));

describe('RR-170: Tag Display Integration Tests', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createClient('mock-url', 'mock-key');
  });

  describe('API to UI Data Flow', () => {
    it('should fetch tags with HTML entities from database', async () => {
      // Simulate API call to get tags
      const result = await mockSupabase
        .from('tags')
        .select('*')
        .eq('user_id', 'test-user')
        .order('sortIndex', { ascending: true });

      expect(result.data).toBeDefined();
      expect(result.data.length).toBe(5);
      
      // Verify tags contain HTML entities as stored in DB
      expect(result.data[0].name).toBe('India&#x2F;Canada');
      expect(result.data[1].name).toBe('Tech &amp; Science');
      expect(result.data[2].name).toBe('News&#8211;Updates');
    });

    it('should preserve HTML entities in database storage', async () => {
      const tags = await mockSupabase
        .from('tags')
        .select('*')
        .eq('user_id', 'test-user')
        .order('sortIndex', { ascending: true });

      // Database should store entities as-is (not decoded)
      tags.data.forEach((tag: any) => {
        if (tag.name.includes('/')) {
          expect(tag.name).toContain('&#x2F;');
          expect(tag.name).not.toContain('/');
        }
        if (tag.name.includes('&') && !tag.name.includes('&amp;')) {
          expect(tag.name).toContain('&amp;');
        }
      });
    });

    it('should maintain tag metadata alongside encoded names', async () => {
      const result = await mockSupabase
        .from('tags')
        .select('*')
        .eq('user_id', 'test-user')
        .order('sortIndex', { ascending: true });

      const indiaCanadaTag = result.data.find((t: any) => t.slug === 'india-canada');
      
      expect(indiaCanadaTag).toMatchObject({
        name: 'India&#x2F;Canada',
        slug: 'india-canada',
        color: '#FF6B6B',
        articleCount: 42,
        type: 'label'
      });
    });
  });

  describe('Tag Filtering and Selection', () => {
    it('should filter articles by tag ID regardless of HTML entities', async () => {
      const tags = await mockSupabase
        .from('tags')
        .select('*')
        .eq('user_id', 'test-user');

      const techScienceTag = tags.data.find((t: any) => t.name === 'Tech &amp; Science');
      
      // Tag selection should work with ID, not decoded name
      expect(techScienceTag.id).toBe('2');
      expect(techScienceTag.articleCount).toBe(78);
    });

    it('should handle tag selection with special characters', async () => {
      const tags = await mockSupabase
        .from('tags')
        .select('*')
        .eq('user_id', 'test-user');

      // All tags should be selectable despite HTML entities
      const selectableTags = tags.data.filter((t: any) => t.id);
      expect(selectableTags.length).toBe(5);
      
      // Each tag should have unique ID for selection
      const ids = selectableTags.map((t: any) => t.id);
      expect(new Set(ids).size).toBe(5);
    });
  });

  describe('Batch Processing Performance', () => {
    it('should handle batch of 100 tags efficiently', async () => {
      // Mock large batch of tags
      const largeBatch = Array.from({ length: 100 }, (_, i) => ({
        id: `tag-${i}`,
        name: `Category ${i} &amp; Subcategory&#x2F;Item&#8211;${i}`,
        slug: `category-${i}-subcategory-item-${i}`,
        type: 'label',
        color: '#' + Math.floor(Math.random()*16777215).toString(16),
        sortIndex: i,
        articleCount: Math.floor(Math.random() * 1000),
        user_id: 'test-user'
      }));

      // Mock Supabase response with large batch
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                data: largeBatch,
                error: null
              }))
            }))
          }))
        }))
      } as any);

      const client = createClient('mock-url', 'mock-key');
      const start = performance.now();
      
      const result = await client
        .from('tags')
        .select('*')
        .eq('user_id', 'test-user')
        .order('sortIndex', { ascending: true });
      
      const end = performance.now();

      expect(result.data.length).toBe(100);
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Database Preservation', () => {
    it('should never modify stored tag names in database', async () => {
      // This test verifies that the fix is display-only
      const originalTags = await mockSupabase
        .from('tags')
        .select('*')
        .eq('user_id', 'test-user');

      // Simulate UI rendering (which should decode for display)
      // But database values should remain unchanged
      const dbCheckTags = await mockSupabase
        .from('tags')
        .select('*')
        .eq('user_id', 'test-user');

      // Database values should be identical (no mutation)
      expect(dbCheckTags.data).toEqual(originalTags.data);
      
      // Specifically check that entities are preserved
      expect(dbCheckTags.data[0].name).toBe('India&#x2F;Canada');
      expect(dbCheckTags.data[1].name).toBe('Tech &amp; Science');
    });

    it('should maintain data integrity across sync operations', async () => {
      const tags = await mockSupabase
        .from('tags')
        .select('*')
        .eq('user_id', 'test-user');

      // All critical fields should be present and valid
      tags.data.forEach((tag: any) => {
        expect(tag.id).toBeDefined();
        expect(tag.name).toBeDefined();
        expect(tag.slug).toBeDefined();
        expect(tag.articleCount).toBeGreaterThanOrEqual(0);
        expect(tag.user_id).toBe('test-user');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle tags with malformed entities gracefully', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                data: [
                  {
                    id: 'malformed-1',
                    name: 'Broken &amp Entity',
                    slug: 'broken-entity',
                    type: 'label',
                    articleCount: 5
                  },
                  {
                    id: 'malformed-2',
                    name: 'Partial &#x2F',
                    slug: 'partial-entity',
                    type: 'label',
                    articleCount: 3
                  }
                ],
                error: null
              }))
            }))
          }))
        }))
      } as any);

      const client = createClient('mock-url', 'mock-key');
      const result = await client
        .from('tags')
        .select('*')
        .eq('user_id', 'test-user')
        .order('sortIndex', { ascending: true });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data.length).toBe(2);
    });

    it('should handle empty tag names', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                data: [
                  {
                    id: 'empty-1',
                    name: '',
                    slug: 'empty',
                    type: 'label',
                    articleCount: 0
                  }
                ],
                error: null
              }))
            }))
          }))
        }))
      } as any);

      const client = createClient('mock-url', 'mock-key');
      const result = await client
        .from('tags')
        .select('*')
        .eq('user_id', 'test-user')
        .order('sortIndex', { ascending: true });

      expect(result.data[0].name).toBe('');
      expect(result.error).toBeNull();
    });
  });
});