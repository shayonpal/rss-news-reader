import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Tag } from '@/types';

interface TagState {
  tags: Map<string, Tag>;
  selectedTagIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadTags: (includeEmpty?: boolean) => Promise<void>;
  selectTag: (tagId: string | null) => void;
  toggleTag: (tagId: string) => void;
  clearSelectedTags: () => void;
  getSelectedTags: () => Tag[];
}

export const useTagStore = create<TagState>()(
  persist(
    (set, get) => ({
      tags: new Map(),
      selectedTagIds: new Set(),
      isLoading: false,
      error: null,

      loadTags: async (includeEmpty = false) => {
        set({ isLoading: true, error: null });
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
              userId: tag.user_id,
              createdAt: new Date(tag.created_at),
              updatedAt: new Date(tag.updated_at),
            });
          });
          
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