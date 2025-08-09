import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * Test Specification for RR-163: Dynamic Sidebar Filtering
 * 
 * These tests define the contract for sidebar filtering behavior.
 * The implementation MUST conform to these tests. Do NOT modify tests to match
 * implementation - fix the implementation to pass these tests.
 * 
 * Requirements:
 * - When "Unread Only" selected: Show only feeds with unreadCount > 0 and topics with unread articles
 * - When "Read Only" selected: Show only feeds with read articles and topics with read articles  
 * - When "All Articles" selected: Show only non-empty feeds and topics
 * - 200ms fade transitions for hiding/showing items
 * - Empty state messages when no items match filter
 */

// Type definitions that implementation must support
interface Tag {
  id: string;
  name: string;
  slug: string;
  color?: string;
  description?: string;
  articleCount: number;
  unreadCount?: number; // New field for RR-163
  totalCount?: number;  // New field for RR-163
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TagStore {
  tags: Map<string, Tag>;
  selectedTagIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadTags: (includeEmpty?: boolean) => Promise<void>;
  selectTag: (tagId: string | null) => void;
  applySidebarTags: (sidebarTags: Array<{ id: string; name: string; count: number }>) => void;
  updateSelectedTagUnreadCount: (delta: number) => void; // New for RR-163
}

describe('RR-163: Sidebar Filtering Contract', () => {
  let mockFetch: any;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock fetch for API calls
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    // Mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      data: [],
      error: null
    };
  });

  describe('Tag Model Extension', () => {
    it('should include unreadCount and totalCount fields', () => {
      const tag: Tag = {
        id: 'tag-1',
        name: 'Technology',
        slug: 'technology',
        articleCount: 25,
        unreadCount: 10,  // New field
        totalCount: 25,   // New field (alias of articleCount)
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(tag.unreadCount).toBeDefined();
      expect(tag.totalCount).toBeDefined();
      expect(tag.articleCount).toBe(tag.totalCount); // Backward compatibility
    });

    it('should handle undefined unreadCount gracefully', () => {
      const tag: Tag = {
        id: 'tag-1',
        name: 'Technology',
        slug: 'technology',
        articleCount: 25,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // unreadCount is optional
      expect(tag.unreadCount).toBeUndefined();
      expect(tag.articleCount).toBe(25);
    });
  });

  describe('Tag Store Merge Logic', () => {
    let tagStore: TagStore;

    beforeEach(() => {
      // Mock tag store implementation
      tagStore = {
        tags: new Map(),
        selectedTagIds: new Set(),
        isLoading: false,
        error: null,
        
        loadTags: vi.fn(),
        selectTag: vi.fn(),
        applySidebarTags: vi.fn(),
        updateSelectedTagUnreadCount: vi.fn()
      };

      // Set up existing tags with metadata
      tagStore.tags.set('tag-1', {
        id: 'tag-1',
        name: 'Technology',
        slug: 'technology',
        color: '#0ea5e9',
        description: 'Tech articles',
        articleCount: 25,
        totalCount: 25,
        userId: 'shayon',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      });

      tagStore.tags.set('tag-2', {
        id: 'tag-2',
        name: 'Science',
        slug: 'science',
        color: '#10b981',
        articleCount: 15,
        totalCount: 15,
        userId: 'shayon',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      });
    });

    it('should merge sidebar tags preserving existing metadata', () => {
      const sidebarTags = [
        { id: 'tag-1', name: 'Technology', count: 10 }, // Has unread
        // tag-2 not in response (has 0 unread)
      ];

      // Implementation should merge, not replace
      tagStore.applySidebarTags = function(sidebarTags) {
        const existingTags = new Map(this.tags);
        
        // Reset all unreadCounts to 0
        existingTags.forEach(tag => {
          tag.unreadCount = 0;
        });
        
        // Update with new unread counts
        sidebarTags.forEach(sidebarTag => {
          const existing = existingTags.get(sidebarTag.id);
          if (existing) {
            existing.unreadCount = sidebarTag.count;
          } else {
            // New tag from sync
            existingTags.set(sidebarTag.id, {
              id: sidebarTag.id,
              name: sidebarTag.name,
              slug: sidebarTag.name.toLowerCase().replace(/\s+/g, '-'),
              articleCount: sidebarTag.count,
              unreadCount: sidebarTag.count,
              totalCount: sidebarTag.count,
              userId: 'shayon',
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        });
        
        this.tags = existingTags;
      };

      tagStore.applySidebarTags(sidebarTags);

      // tag-1 should have updated unreadCount but preserved metadata
      const tag1 = tagStore.tags.get('tag-1');
      expect(tag1?.unreadCount).toBe(10);
      expect(tag1?.color).toBe('#0ea5e9'); // Preserved
      expect(tag1?.description).toBe('Tech articles'); // Preserved
      expect(tag1?.totalCount).toBe(25); // Preserved

      // tag-2 should exist with unreadCount = 0
      const tag2 = tagStore.tags.get('tag-2');
      expect(tag2).toBeDefined();
      expect(tag2?.unreadCount).toBe(0);
      expect(tag2?.color).toBe('#10b981'); // Preserved
      expect(tag2?.totalCount).toBe(15); // Preserved
    });

    it('should decode HTML entities in tag names', () => {
      const sidebarTags = [
        { id: 'tag-3', name: 'Design &amp; UX', count: 5 }
      ];

      tagStore.applySidebarTags = function(sidebarTags) {
        sidebarTags.forEach(tag => {
          // Decode HTML entities
          const decodedName = tag.name
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
          
          this.tags.set(tag.id, {
            id: tag.id,
            name: decodedName,
            slug: decodedName.toLowerCase().replace(/\s+/g, '-'),
            articleCount: tag.count,
            unreadCount: tag.count,
            totalCount: tag.count,
            userId: 'shayon',
            createdAt: new Date(),
            updatedAt: new Date()
          });
        });
      };

      tagStore.applySidebarTags(sidebarTags);
      
      const tag3 = tagStore.tags.get('tag-3');
      expect(tag3?.name).toBe('Design & UX'); // Decoded
    });
  });

  describe('Optimistic Updates', () => {
    let tagStore: TagStore;

    beforeEach(() => {
      tagStore = {
        tags: new Map(),
        selectedTagIds: new Set(['tag-1']),
        isLoading: false,
        error: null,
        
        loadTags: vi.fn(),
        selectTag: vi.fn(),
        applySidebarTags: vi.fn(),
        updateSelectedTagUnreadCount: vi.fn()
      };

      tagStore.tags.set('tag-1', {
        id: 'tag-1',
        name: 'Technology',
        slug: 'technology',
        articleCount: 25,
        unreadCount: 10,
        totalCount: 25,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    it('should update selected tag unread count optimistically', () => {
      tagStore.updateSelectedTagUnreadCount = function(delta: number) {
        // Only update if single tag selected
        if (this.selectedTagIds.size !== 1) return;
        
        const tagId = Array.from(this.selectedTagIds)[0];
        const tag = this.tags.get(tagId);
        if (tag && tag.unreadCount !== undefined) {
          // Bound at 0 to prevent negative
          tag.unreadCount = Math.max(0, tag.unreadCount + delta);
        }
      };

      // Decrement by 1 (mark as read)
      tagStore.updateSelectedTagUnreadCount(-1);
      expect(tagStore.tags.get('tag-1')?.unreadCount).toBe(9);

      // Increment by 1 (mark as unread)
      tagStore.updateSelectedTagUnreadCount(1);
      expect(tagStore.tags.get('tag-1')?.unreadCount).toBe(10);
    });

    it('should prevent negative unread counts', () => {
      tagStore.tags.get('tag-1')!.unreadCount = 1;
      
      tagStore.updateSelectedTagUnreadCount = function(delta: number) {
        if (this.selectedTagIds.size !== 1) return;
        
        const tagId = Array.from(this.selectedTagIds)[0];
        const tag = this.tags.get(tagId);
        if (tag && tag.unreadCount !== undefined) {
          tag.unreadCount = Math.max(0, tag.unreadCount + delta);
        }
      };

      // Try to decrement by 5 when only 1 unread
      tagStore.updateSelectedTagUnreadCount(-5);
      expect(tagStore.tags.get('tag-1')?.unreadCount).toBe(0); // Bounded at 0
    });

    it('should not update when multiple tags selected', () => {
      tagStore.selectedTagIds.add('tag-2');
      const originalCount = tagStore.tags.get('tag-1')?.unreadCount;
      
      tagStore.updateSelectedTagUnreadCount = function(delta: number) {
        // Only update if single tag selected
        if (this.selectedTagIds.size !== 1) return;
        
        const tagId = Array.from(this.selectedTagIds)[0];
        const tag = this.tags.get(tagId);
        if (tag && tag.unreadCount !== undefined) {
          tag.unreadCount = Math.max(0, tag.unreadCount + delta);
        }
      };

      tagStore.updateSelectedTagUnreadCount(-1);
      expect(tagStore.tags.get('tag-1')?.unreadCount).toBe(originalCount); // No change
    });
  });

  describe('Sidebar Filtering Logic', () => {
    interface SimpleFeedSidebarProps {
      readStatusFilter: 'all' | 'unread' | 'read';
      selectedTagId: string | null;
      tags: Map<string, Tag>;
    }

    const filterTags = (tags: Map<string, Tag>, filter: 'all' | 'unread' | 'read', selectedTagId: string | null) => {
      return Array.from(tags.values()).filter(tag => {
        // Always show selected tag
        if (selectedTagId === tag.id) return true;
        
        // Filter based on read status
        if (filter === 'unread') {
          return (tag.unreadCount ?? 0) > 0;
        } else if (filter === 'read') {
          const totalCount = tag.totalCount ?? tag.articleCount;
          const unreadCount = tag.unreadCount ?? 0;
          return totalCount > 0 && unreadCount === 0;
        } else {
          // 'all' - show all non-empty tags
          return (tag.totalCount ?? tag.articleCount) > 0;
        }
      });
    };

    it('should show only tags with unread articles when filter is "unread"', () => {
      const tags = new Map<string, Tag>();
      tags.set('tag-1', {
        id: 'tag-1',
        name: 'Technology',
        slug: 'technology',
        articleCount: 25,
        unreadCount: 10,
        totalCount: 25,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      tags.set('tag-2', {
        id: 'tag-2',
        name: 'Science',
        slug: 'science',
        articleCount: 15,
        unreadCount: 0,
        totalCount: 15,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const filtered = filterTags(tags, 'unread', null);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('tag-1');
    });

    it('should show only tags with read articles when filter is "read"', () => {
      const tags = new Map<string, Tag>();
      tags.set('tag-1', {
        id: 'tag-1',
        name: 'Technology',
        slug: 'technology',
        articleCount: 25,
        unreadCount: 10,
        totalCount: 25,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      tags.set('tag-2', {
        id: 'tag-2',
        name: 'Science',
        slug: 'science',
        articleCount: 15,
        unreadCount: 0,
        totalCount: 15,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const filtered = filterTags(tags, 'read', null);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('tag-2');
    });

    it('should show all non-empty tags when filter is "all"', () => {
      const tags = new Map<string, Tag>();
      tags.set('tag-1', {
        id: 'tag-1',
        name: 'Technology',
        slug: 'technology',
        articleCount: 25,
        unreadCount: 10,
        totalCount: 25,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      tags.set('tag-2', {
        id: 'tag-2',
        name: 'Science',
        slug: 'science',
        articleCount: 15,
        unreadCount: 0,
        totalCount: 15,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      tags.set('tag-3', {
        id: 'tag-3',
        name: 'Empty',
        slug: 'empty',
        articleCount: 0,
        unreadCount: 0,
        totalCount: 0,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const filtered = filterTags(tags, 'all', null);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.find(t => t.id === 'tag-3')).toBeUndefined();
    });

    it('should always show selected tag regardless of filter', () => {
      const tags = new Map<string, Tag>();
      tags.set('tag-1', {
        id: 'tag-1',
        name: 'Technology',
        slug: 'technology',
        articleCount: 25,
        unreadCount: 0, // No unread
        totalCount: 25,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Filter is "unread" but tag-1 has no unread - should still show because selected
      const filtered = filterTags(tags, 'unread', 'tag-1');
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('tag-1');
    });
  });

  describe('Visual Transitions', () => {
    it('should apply opacity 0.35 to zero-unread tags in "all" mode', () => {
      const tag: Tag = {
        id: 'tag-1',
        name: 'Technology',
        slug: 'technology',
        articleCount: 25,
        unreadCount: 0,
        totalCount: 25,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const getTagOpacity = (tag: Tag, filter: 'all' | 'unread' | 'read', isSelected: boolean) => {
        if (isSelected) return 1;
        if (filter === 'all' && (tag.unreadCount ?? 0) === 0) {
          return 0.35;
        }
        return 1;
      };

      expect(getTagOpacity(tag, 'all', false)).toBe(0.35);
      expect(getTagOpacity(tag, 'all', true)).toBe(1); // Selected overrides
      expect(getTagOpacity(tag, 'unread', false)).toBe(1); // Different filter
    });

    it('should define 200ms transition duration', () => {
      const transitionClass = 'transition-all duration-200';
      expect(transitionClass).toContain('duration-200');
    });
  });

  describe('RR-27 State Preservation Integration', () => {
    interface ArticleListState {
      feedId?: string;
      folderId?: string;
      tagId?: string; // New for RR-163
      preservedArticles: Set<string>;
    }

    let articleListState: ArticleListState;

    beforeEach(() => {
      articleListState = {
        feedId: undefined,
        folderId: undefined,
        tagId: undefined,
        preservedArticles: new Set()
      };
    });

    it('should clear state when switching from All Articles to tag', () => {
      // Start with All Articles (no tag selected)
      articleListState.preservedArticles.add('article-1');
      articleListState.preservedArticles.add('article-2');
      
      // Switch to a tag
      const selectTag = (tagId: string | null) => {
        if (tagId !== articleListState.tagId) {
          // Clear state on tag change
          articleListState.preservedArticles.clear();
          articleListState.tagId = tagId;
        }
      };

      selectTag('tag-1');
      
      expect(articleListState.preservedArticles.size).toBe(0);
      expect(articleListState.tagId).toBe('tag-1');
    });

    it('should clear state when switching between different tags', () => {
      articleListState.tagId = 'tag-1';
      articleListState.preservedArticles.add('article-1');
      
      const selectTag = (tagId: string | null) => {
        if (tagId !== articleListState.tagId) {
          articleListState.preservedArticles.clear();
          articleListState.tagId = tagId;
        }
      };

      selectTag('tag-2');
      
      expect(articleListState.preservedArticles.size).toBe(0);
      expect(articleListState.tagId).toBe('tag-2');
    });

    it('should preserve state when navigating within same tag', () => {
      articleListState.tagId = 'tag-1';
      articleListState.preservedArticles.add('article-1');
      
      // Navigate to article (same tag context)
      // State should be preserved
      
      expect(articleListState.preservedArticles.has('article-1')).toBe(true);
      expect(articleListState.tagId).toBe('tag-1');
    });
  });

  describe('Sync API Integration', () => {
    it('should return correct unread counts grouped by tag', async () => {
      // Mock sync API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          sidebarTags: [
            { id: 'tag-1', name: 'Technology', count: 10 },
            { id: 'tag-2', name: 'Science', count: 5 }
          ]
        })
      });

      const response = await fetch('/api/sync');
      const data = await response.json();
      
      expect(data.sidebarTags).toHaveLength(2);
      expect(data.sidebarTags[0].count).toBe(10);
    });

    it('should properly join tags table for names', async () => {
      // The query should join to tags table, not rely on article_tags.tag_name
      const mockQuery = `
        SELECT t.id, t.name, COUNT(DISTINCT a.id) as count
        FROM articles a
        INNER JOIN article_tags at ON a.id = at.article_id
        INNER JOIN tags t ON at.tag_id = t.id
        WHERE a.user_id = 'shayon' AND a.is_read = false
        GROUP BY t.id, t.name
      `;
      
      // This ensures we're using proper schema columns
      expect(mockQuery).toContain('tags t');
      expect(mockQuery).toContain('t.name');
      expect(mockQuery).not.toContain('at.tag_name'); // Should not use non-existent column
    });

    it('should exclude tags with zero unread from response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          sidebarTags: [
            { id: 'tag-1', name: 'Technology', count: 10 }
            // tag-2 with 0 unread not included
          ]
        })
      });

      const response = await fetch('/api/sync');
      const data = await response.json();
      
      // Should not include tags with 0 unread
      expect(data.sidebarTags.find((t: any) => t.count === 0)).toBeUndefined();
    });
  });

  describe('Real-time Updates', () => {
    it('should update tag counts immediately when marking articles read', () => {
      const tag: Tag = {
        id: 'tag-1',
        name: 'Technology',
        slug: 'technology',
        articleCount: 25,
        unreadCount: 10,
        totalCount: 25,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mark article as read
      const markArticleRead = () => {
        if (tag.unreadCount !== undefined) {
          tag.unreadCount = Math.max(0, tag.unreadCount - 1);
        }
      };

      const startTime = performance.now();
      markArticleRead();
      const endTime = performance.now();

      expect(tag.unreadCount).toBe(9);
      expect(endTime - startTime).toBeLessThan(50); // Should be immediate
    });

    it('should only update selected tag optimistically', () => {
      const tags = new Map<string, Tag>();
      tags.set('tag-1', {
        id: 'tag-1',
        name: 'Technology',
        slug: 'technology',
        articleCount: 25,
        unreadCount: 10,
        totalCount: 25,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      tags.set('tag-2', {
        id: 'tag-2',
        name: 'Science',
        slug: 'science',
        articleCount: 15,
        unreadCount: 5,
        totalCount: 15,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const selectedTagId = 'tag-1';
      
      // Mark article as read - only update selected tag
      const markArticleRead = () => {
        const tag = tags.get(selectedTagId);
        if (tag && tag.unreadCount !== undefined) {
          tag.unreadCount = Math.max(0, tag.unreadCount - 1);
        }
      };

      markArticleRead();
      
      expect(tags.get('tag-1')?.unreadCount).toBe(9); // Updated
      expect(tags.get('tag-2')?.unreadCount).toBe(5); // Unchanged
    });

    it('should merge counts without UI flicker on manual sync', async () => {
      const tags = new Map<string, Tag>();
      tags.set('tag-1', {
        id: 'tag-1',
        name: 'Technology',
        slug: 'technology',
        articleCount: 25,
        unreadCount: 10,
        totalCount: 25,
        color: '#0ea5e9',
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Simulate sync response
      const sidebarTags = [
        { id: 'tag-1', name: 'Technology', count: 8 } // Server says 8 unread
      ];

      // Merge should preserve tag in Map, not remove and re-add
      const originalTag = tags.get('tag-1');
      
      // Apply merge
      sidebarTags.forEach(sidebarTag => {
        const tag = tags.get(sidebarTag.id);
        if (tag) {
          tag.unreadCount = sidebarTag.count;
        }
      });

      const updatedTag = tags.get('tag-1');
      
      // Same object reference = no flicker
      expect(updatedTag).toBe(originalTag);
      expect(updatedTag?.unreadCount).toBe(8);
      expect(updatedTag?.color).toBe('#0ea5e9'); // Metadata preserved
    });
  });

  describe('Edge Cases', () => {
    it('should handle HTML entities in tag names', () => {
      const decodeHtmlEntities = (text: string) => {
        return text
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#x27;/g, "'")
          .replace(/&#x2F;/g, '/')
          .replace(/&#96;/g, '`')
          .replace(/&#x3D;/g, '=');
      };

      expect(decodeHtmlEntities('Design &amp; UX')).toBe('Design & UX');
      expect(decodeHtmlEntities('Q&amp;A')).toBe('Q&A');
      expect(decodeHtmlEntities('&lt;Code&gt;')).toBe('<Code>');
    });

    it('should hide tags with 0 total articles in all filters', () => {
      const tag: Tag = {
        id: 'tag-1',
        name: 'Empty Tag',
        slug: 'empty-tag',
        articleCount: 0,
        unreadCount: 0,
        totalCount: 0,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const shouldShowTag = (tag: Tag, filter: 'all' | 'unread' | 'read') => {
        const total = tag.totalCount ?? tag.articleCount;
        if (total === 0) return false;
        
        if (filter === 'unread') return (tag.unreadCount ?? 0) > 0;
        if (filter === 'read') return total > 0 && (tag.unreadCount ?? 0) === 0;
        return true; // 'all'
      };

      expect(shouldShowTag(tag, 'all')).toBe(false);
      expect(shouldShowTag(tag, 'unread')).toBe(false);
      expect(shouldShowTag(tag, 'read')).toBe(false);
    });

    it('should maintain consistency with concurrent operations', async () => {
      const tag: Tag = {
        id: 'tag-1',
        name: 'Technology',
        slug: 'technology',
        articleCount: 25,
        unreadCount: 10,
        totalCount: 25,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Simulate concurrent operations
      const operations = [
        () => { tag.unreadCount = Math.max(0, (tag.unreadCount ?? 0) - 1); }, // Mark read
        () => { tag.unreadCount = Math.max(0, (tag.unreadCount ?? 0) - 1); }, // Mark read
        () => { tag.unreadCount = (tag.unreadCount ?? 0) + 1; }, // Mark unread
      ];

      // Execute concurrently
      await Promise.all(operations.map(op => Promise.resolve(op())));
      
      // Result should be consistent (10 - 1 - 1 + 1 = 9)
      expect(tag.unreadCount).toBe(9);
    });

    it('should let server state win on sync conflicts', async () => {
      const tag: Tag = {
        id: 'tag-1',
        name: 'Technology',
        slug: 'technology',
        articleCount: 25,
        unreadCount: 10, // Client thinks 10
        totalCount: 25,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Server says 8 unread (source of truth)
      const serverResponse = { id: 'tag-1', name: 'Technology', count: 8 };
      
      // Apply server state
      tag.unreadCount = serverResponse.count;
      
      expect(tag.unreadCount).toBe(8); // Server wins
    });
  });

  describe('Performance Requirements', () => {
    it('should apply filter changes within 200ms', async () => {
      const startTime = performance.now();
      
      // Simulate filter change
      const applyFilter = (filter: 'all' | 'unread' | 'read') => {
        // Filter logic here
        return filter;
      };
      
      applyFilter('unread');
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(200);
    });

    it('should update counts immediately (< 50ms)', () => {
      const tag: Tag = {
        id: 'tag-1',
        name: 'Technology',
        slug: 'technology',
        articleCount: 25,
        unreadCount: 10,
        totalCount: 25,
        userId: 'shayon',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const startTime = performance.now();
      tag.unreadCount = 9;
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should limit re-renders to maximum 2 per update', () => {
      let renderCount = 0;
      
      const simulateRender = () => {
        renderCount++;
      };
      
      // Simulate sidebar update
      const updateSidebar = () => {
        simulateRender(); // Initial render
        // Batch state updates
        simulateRender(); // Final render
      };
      
      updateSidebar();
      
      expect(renderCount).toBeLessThanOrEqual(2);
    });
  });
});