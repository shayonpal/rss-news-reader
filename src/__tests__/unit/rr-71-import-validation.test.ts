import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Unit tests for RR-71: Authentication Components Removal
 * Tests that deleted files do not exist and remaining files still exist
 */

describe('RR-71: File System Validation Tests', () => {
  const srcPath = join(process.cwd(), 'src');

  describe('Deleted Auth Components Should Not Exist', () => {
    const deletedComponents = [
      'components/auth/auth-status.tsx',
      'components/auth/login-button.tsx', 
      'components/auth/logout-button.tsx',
      'components/auth/user-profile.tsx',
      'components/auth/auth-guard.tsx',
      'lib/stores/auth-store.ts',
    ];

    deletedComponents.forEach(componentPath => {
      it(`should not have file: ${componentPath}`, () => {
        const fullPath = join(srcPath, componentPath);
        expect(existsSync(fullPath)).toBe(false);
      });
    });

    it('should not have auth components directory', () => {
      const authDir = join(srcPath, 'components/auth');
      expect(existsSync(authDir)).toBe(false);
    });
  });

  describe('Deleted OAuth Utilities Should Not Exist', () => {
    const deletedUtilities = [
      'lib/api/oauth-config.ts',
      'lib/api/oauth-utils.ts',
    ];

    deletedUtilities.forEach(utilityPath => {
      it(`should not have file: ${utilityPath}`, () => {
        const fullPath = join(srcPath, utilityPath);
        expect(existsSync(fullPath)).toBe(false);
      });
    });
  });

  describe('Deleted Feed Components Should Not Exist', () => {
    it('should not have FeedSidebar component', () => {
      const feedSidebarPath = join(srcPath, 'components/feeds/feed-sidebar.tsx');
      expect(existsSync(feedSidebarPath)).toBe(false);
    });
  });

  describe('Preserved Components Should Still Exist', () => {
    const preservedComponents = [
      'components/feeds/simple-feed-sidebar.tsx',
      'components/articles/article-header.tsx',
      'components/layout/header.tsx',
      'lib/api/client.ts',
    ];

    preservedComponents.forEach(componentPath => {
      it(`should still have file: ${componentPath}`, () => {
        const fullPath = join(srcPath, componentPath);
        expect(existsSync(fullPath)).toBe(true);
      });
    });
  });
});