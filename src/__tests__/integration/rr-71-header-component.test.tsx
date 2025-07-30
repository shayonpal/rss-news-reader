import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Integration tests for RR-71: Header Component
 * Tests the Linear requirements for header updates
 */

describe('RR-71: Header Component Tests', () => {
  const headerPath = join(process.cwd(), 'src/components/layout/header.tsx');

  describe('Header Component Code Analysis', () => {
    it('should not import AuthStatus component', () => {
      const headerContent = readFileSync(headerPath, 'utf-8');
      
      // Should not contain AuthStatus import
      expect(headerContent).not.toMatch(/import.*AuthStatus.*from/);
      expect(headerContent).not.toMatch(/@\/components\/auth\/auth-status/);
    });

    it('should not render AuthStatus component', () => {
      const headerContent = readFileSync(headerPath, 'utf-8');
      
      // Should not contain AuthStatus JSX
      expect(headerContent).not.toMatch(/<AuthStatus/);
    });

    it('should show RSS Reader branding', () => {
      const headerContent = readFileSync(headerPath, 'utf-8');
      
      // Should contain RSS Reader text
      expect(headerContent).toMatch(/RSS Reader/);
    });

    it('should preserve sync button functionality', () => {
      const headerContent = readFileSync(headerPath, 'utf-8');
      
      // Should contain refresh functionality
      expect(headerContent).toMatch(/RefreshCw|refresh|sync/i);
      expect(headerContent).toMatch(/performFullSync/);
    });

    it('should preserve health status widget', () => {
      const headerContent = readFileSync(headerPath, 'utf-8');
      
      // Should import and render HealthStatusWidget
      expect(headerContent).toMatch(/HealthStatusWidget/);
    });

    it('should preserve menu button', () => {
      const headerContent = readFileSync(headerPath, 'utf-8');
      
      // Should contain menu functionality
      expect(headerContent).toMatch(/Menu.*className|toggleSidebar/);
    });

    it('should show article count display', () => {
      const headerContent = readFileSync(headerPath, 'utf-8');
      
      // Should show some kind of count display (article count in parentheses)
      expect(headerContent).toMatch(/\(\d+\)|All Articles/);
    });
  });
});