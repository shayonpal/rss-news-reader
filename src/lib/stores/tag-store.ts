import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Tag } from '@/types';

interface TagState {
  tags: Map<string, Tag>;
  selectedTagIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  includeEmpty: boolean;
  
  // Actions
  loadTags: (includeEmpty?: boolean) => Promise<void>;
  selectTag: (tagId: string | null) => void;
  toggleTag: (tagId: string) => void;
  clearSelectedTags: () => void;
  getSelectedTags: () => Tag[];
  refreshTags: () => Promise<void>;
  applySidebarTags: (sidebarTags: Array<{ id: string; name: string; count: number }>) => void;
  updateSelectedTagUnreadCount: (delta: number) => void; // RR-163: Optimistic updates
}

export const useTagStore = create<TagState>()(
  persist(
    (set, get) => ({
      tags: new Map(),
      selectedTagIds: new Set(),
      isLoading: false,
      error: null,
      includeEmpty: false,

      loadTags: async (includeEmpty = false) => {
        set({ isLoading: true, error: null, includeEmpty });
        try {
          const response = await fetch(`/reader/api/tags?includeEmpty=${includeEmpty}`);
          if (!response.ok) throw new Error('Failed to load tags');
          
          const data = await response.json();
          const tagsMap = new Map<string, Tag>();
          
          data.tags.forEach((tag: any) => {
            tagsMap.set(tag.id, {
              id: tag.id,
              name: tag.name,
              slug: tag.slug,
              color: tag.color,
              description: tag.description,
              articleCount: tag.article_count,
              totalCount: tag.article_count, // RR-163: Set totalCount as alias
              unreadCount: tag.unread_count || 0, // RR-163: Use unread count from API
              userId: tag.user_id,
              createdAt: new Date(tag.created_at),
              updatedAt: new Date(tag.updated_at),
            });
          });
          
          console.log(`[TagStore] Loaded ${tagsMap.size} tags from API`);
          set({ tags: tagsMap, isLoading: false });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load tags',
            isLoading: false 
          });
        }
      },

      selectTag: (tagId) => {
        if (tagId === null) {
          set({ selectedTagIds: new Set() });
        } else {
          set({ selectedTagIds: new Set([tagId]) });
        }
      },

      toggleTag: (tagId) => {
        set((state) => {
          const newSet = new Set(state.selectedTagIds);
          if (newSet.has(tagId)) {
            newSet.delete(tagId);
          } else {
            newSet.add(tagId);
          }
          return { selectedTagIds: newSet };
        });
      },

      clearSelectedTags: () => {
        set({ selectedTagIds: new Set() });
      },

      getSelectedTags: () => {
        const state = get();
        return Array.from(state.selectedTagIds)
          .map(id => state.tags.get(id))
          .filter((tag): tag is Tag => tag !== undefined);
      },

      // Add refresh method for RR-171
      refreshTags: async () => {
        const state = get();
        return state.loadTags(state.includeEmpty);
      },

      // RR-163: Apply sidebar tags from API response with merge strategy
      applySidebarTags: (sidebarTags: Array<{ id: string; name: string; count: number }>) => {
        console.log(`[TagStore] Applying sidebar tags: ${sidebarTags.length} tags with unread counts`);
        
        // Don't reset counts if sync returns no tags - this means no unread articles have tags
        // The existing counts from the API are still valid
        if (sidebarTags.length === 0) {
          console.log(`[TagStore] No sidebar tags from sync, keeping existing unread counts`);
          return;
        }
        
        set((state) => {
          const mergedTags = new Map(state.tags);
          console.log(`[TagStore] Current tags in store: ${mergedTags.size}`);
          
          // Reset all unreadCounts to 0 (tags not in response have 0 unread)
          mergedTags.forEach(tag => {
            tag.unreadCount = 0;
          });
          
          // Update with new unread counts from sync
          sidebarTags.forEach(sidebarTag => {
            const existing = mergedTags.get(sidebarTag.id);
            if (existing) {
              // Preserve existing metadata, update counts
              existing.unreadCount = sidebarTag.count;
              // Keep totalCount if it exists, otherwise use articleCount
              if (!existing.totalCount && existing.articleCount) {
                existing.totalCount = existing.articleCount;
              }
              console.log(`[TagStore] Updated ${existing.name}: unreadCount=${sidebarTag.count}`);
            } else {
              // New tag from sync
              console.log(`[TagStore] Adding new tag ${sidebarTag.name} with unreadCount=${sidebarTag.count}`);
              mergedTags.set(sidebarTag.id, {
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
          
          console.log(`[TagStore] After merge: ${mergedTags.size} total tags`);
          return { tags: mergedTags };
        });
      },

      // RR-163: Optimistic unread count updates for selected tag
      updateSelectedTagUnreadCount: (delta: number) => {
        set((state) => {
          // Only update if single tag selected
          if (state.selectedTagIds.size !== 1) return state;
          
          const tagId = Array.from(state.selectedTagIds)[0];
          const updatedTags = new Map(state.tags);
          const tag = updatedTags.get(tagId);
          
          if (tag && tag.unreadCount !== undefined) {
            // Bound at 0 to prevent negative counts
            tag.unreadCount = Math.max(0, tag.unreadCount + delta);
            updatedTags.set(tagId, { ...tag });
          }
          
          return { tags: updatedTags };
        });
      },
    }),
    {
      name: 'tag-store',
      partialize: (state) => ({
        selectedTagIds: Array.from(state.selectedTagIds),
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.selectedTagIds)) {
          state.selectedTagIds = new Set(state.selectedTagIds);
        }
      },
    }
  )
);