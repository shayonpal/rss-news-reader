/**
 * RR-270: Patch Builder Tests
 * 
 * Tests the utility that builds minimal patch objects
 * for preference updates using patch semantics.
 */

import { describe, it, expect } from 'vitest';
import { buildPreferencesPatch } from '@/lib/utils/preferences-patch-builder';
import type { PreferencesData } from '@/types/preferences';

describe('PreferencesPatchBuilder - RR-270', () => {
  describe('Basic Patch Generation', () => {
    it('should return empty patch when no changes', () => {
      const saved: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      const draft = { ...saved };
      const patch = buildPreferencesPatch(draft, saved);

      expect(patch).toEqual({});
    });

    it('should include only changed fields', () => {
      const saved: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      const draft: PreferencesData = {
        ...saved,
        sync: {
          ...saved.sync,
          maxArticles: 1000,
        },
      };

      const patch = buildPreferencesPatch(draft, saved);

      expect(patch).toEqual({
        sync: {
          maxArticles: 1000,
        },
      });
    });

    it('should handle multiple changes across sections', () => {
      const saved: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      const draft: PreferencesData = {
        ai: {
          ...saved.ai,
          model: 'claude-3-sonnet-20240229',
          summaryLengthMin: 200,
        },
        sync: {
          maxArticles: 1000,
          retentionCount: 60,
        },
      };

      const patch = buildPreferencesPatch(draft, saved);

      expect(patch).toEqual({
        ai: {
          model: 'claude-3-sonnet-20240229',
          summaryLengthMin: 200,
        },
        sync: {
          maxArticles: 1000,
          retentionCount: 60,
        },
      });
    });
  });

  describe('API Key State Machine', () => {
    it('should handle API key replacement', () => {
      const saved: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      const patch = buildPreferencesPatch(
        saved,
        saved,
        'replace',
        'sk-ant-api03-xxx'
      );

      expect(patch).toEqual({
        ai: {
          apiKeyChange: 'replace',
          apiKey: 'sk-ant-api03-xxx',
        },
      });
    });

    it('should handle API key clearing', () => {
      const saved: PreferencesData = {
        ai: {
          hasApiKey: true,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      const patch = buildPreferencesPatch(saved, saved, 'clear');

      expect(patch).toEqual({
        ai: {
          apiKeyChange: 'clear',
          apiKey: null,
        },
      });
    });

    it('should not include API key when unchanged', () => {
      const saved: PreferencesData = {
        ai: {
          hasApiKey: true,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      const draft: PreferencesData = {
        ...saved,
        sync: {
          ...saved.sync,
          maxArticles: 1000,
        },
      };

      const patch = buildPreferencesPatch(draft, saved, 'unchanged');

      expect(patch).toEqual({
        sync: {
          maxArticles: 1000,
        },
      });
      expect(patch.ai).toBeUndefined();
    });

    it('should combine API key change with other AI field changes', () => {
      const saved: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      const draft: PreferencesData = {
        ...saved,
        ai: {
          ...saved.ai,
          model: 'claude-3-sonnet-20240229',
        },
      };

      const patch = buildPreferencesPatch(
        draft,
        saved,
        'replace',
        'sk-ant-new-key'
      );

      expect(patch).toEqual({
        ai: {
          model: 'claude-3-sonnet-20240229',
          apiKeyChange: 'replace',
          apiKey: 'sk-ant-new-key',
        },
      });
    });
  });

  describe('Null Value Handling', () => {
    it('should include null values for field clearing', () => {
      const saved: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      const draft: PreferencesData = {
        ...saved,
        ai: {
          ...saved.ai,
          contentFocus: null as any, // Explicitly clearing
        },
      };

      const patch = buildPreferencesPatch(draft, saved);

      expect(patch).toEqual({
        ai: {
          contentFocus: null,
        },
      });
    });
  });

  describe('System Fields Exclusion', () => {
    it('should exclude system-generated fields', () => {
      const saved: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      const draft: any = {
        ...saved,
        id: 'some-id', // System field
        createdAt: new Date(), // System field
        updatedAt: new Date(), // System field
        sync: {
          ...saved.sync,
          maxArticles: 1000,
        },
      };

      const patch = buildPreferencesPatch(draft, saved);

      expect(patch).toEqual({
        sync: {
          maxArticles: 1000,
        },
      });
      expect(patch).not.toHaveProperty('id');
      expect(patch).not.toHaveProperty('createdAt');
      expect(patch).not.toHaveProperty('updatedAt');
    });

    it('should exclude hasApiKey from patch', () => {
      const saved: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      const draft: PreferencesData = {
        ...saved,
        ai: {
          ...saved.ai,
          hasApiKey: true, // Should not be in patch
          model: 'claude-3-sonnet-20240229',
        },
      };

      const patch = buildPreferencesPatch(draft, saved);

      expect(patch).toEqual({
        ai: {
          model: 'claude-3-sonnet-20240229',
        },
      });
      expect(patch.ai).not.toHaveProperty('hasApiKey');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined saved preferences', () => {
      const draft: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      const patch = buildPreferencesPatch(draft, undefined as any);

      // Should return all fields when no saved state
      expect(patch).toEqual({
        ai: {
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      });
    });

    it('should handle deeply nested changes', () => {
      const saved: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      const draft: PreferencesData = {
        ...saved,
        ai: {
          ...saved.ai,
          summaryStyle: 'analytical',
          contentFocus: 'technical',
        },
      };

      const patch = buildPreferencesPatch(draft, saved);

      expect(patch).toEqual({
        ai: {
          summaryStyle: 'analytical',
          contentFocus: 'technical',
        },
      });
    });

    it('should handle multiple nested changes', () => {
      const saved: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      const draft: PreferencesData = {
        ai: {
          ...saved.ai,
          model: 'claude-3-opus-20240229',
          summaryLengthMin: 150,
          summaryLengthMax: 400,
        },
        sync: {
          maxArticles: 1000,
          retentionCount: 60,
        },
      };

      const patch = buildPreferencesPatch(draft, saved);

      expect(patch).toEqual({
        ai: {
          model: 'claude-3-opus-20240229',
          summaryLengthMin: 150,
          summaryLengthMax: 400,
        },
        sync: {
          maxArticles: 1000,
          retentionCount: 60,
        },
      });
    });

    it('should handle null value changes', () => {
      const saved: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'technical',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      const draft: PreferencesData = {
        ...saved,
        ai: {
          ...saved.ai,
          contentFocus: null,
        },
      };

      const patch = buildPreferencesPatch(draft, saved);

      expect(patch).toEqual({
        ai: {
          contentFocus: null,
        },
      });
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety with patch output', () => {
      const saved: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      const draft: PreferencesData = {
        ...saved,
        ai: {
          ...saved.ai,
          summaryStyle: 'analytical',
        },
      };

      const patch = buildPreferencesPatch(draft, saved);

      // Type checking (compile-time)
      const _aiPatch: Partial<typeof saved.ai> | undefined = patch.ai;
      const _syncPatch: Partial<typeof saved.sync> | undefined = patch.sync;

      expect(patch.ai?.summaryStyle).toBe('analytical');
    });
  });
});