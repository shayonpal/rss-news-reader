import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { ThemeProvider } from '../theme-provider';
import { useUIStore } from '@/lib/stores/ui-store';

// Mock the UI store
vi.mock('@/lib/stores/ui-store', () => ({
  useUIStore: vi.fn()
}));

// Mock console methods to avoid noise in tests
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

// Mock window.matchMedia
const mockMatchMedia = vi.fn();

// Helper to mock the UI store with a specific theme
const mockTheme = (theme: string | undefined) => {
  (useUIStore as any).mockImplementation((selector: any) => {
    if (typeof selector === 'function') {
      return selector({ theme });
    }
    return theme;
  });
};

describe('ThemeProvider Component (RR-126)', () => {
  let mockMediaQuery: {
    matches: boolean;
    addEventListener: vi.Mock;
    removeEventListener: vi.Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset DOM
    document.documentElement.className = '';
    
    // Setup matchMedia mock
    mockMediaQuery = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    
    mockMatchMedia.mockReturnValue(mockMediaQuery);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });

    // Don't use fake timers by default - they conflict with React Testing Library
  });

  afterEach(() => {
    vi.useRealTimers();
    mockConsoleLog.mockClear();
  });

  describe('CSS Class Application Tests', () => {
    it('should apply light theme class when theme is light', async () => {
      mockTheme('light');

      render(<ThemeProvider />);

      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });
    });

    it('should apply dark theme class when theme is dark', async () => {
      mockTheme('dark');

      render(<ThemeProvider />);

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.classList.contains('light')).toBe(false);
      });
    });

    it('should apply system theme class based on media query', async () => {
      mockTheme('system');
      mockMediaQuery.matches = true; // Dark mode preferred

      render(<ThemeProvider />);

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.classList.contains('light')).toBe(false);
      });
    });

    it('should apply light system theme when prefers-color-scheme is light', async () => {
      mockTheme('system');
      mockMediaQuery.matches = false; // Light mode preferred

      render(<ThemeProvider />);

      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });
    });

    it('should remove existing theme classes before applying new ones', async () => {
      // Start with dark class already applied
      document.documentElement.classList.add('dark');
      
      mockTheme('light');

      render(<ThemeProvider />);

      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });
    });
  });

  describe('Theme Change Handling Tests', () => {
    it('should update theme classes when theme store changes', async () => {
      let currentTheme = 'light';
      mockTheme(currentTheme);

      const { rerender } = render(<ThemeProvider />);

      // Initially light
      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true);
      });

      // Change to dark
      currentTheme = 'dark';
      mockTheme(currentTheme);
      rerender(<ThemeProvider />);

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.classList.contains('light')).toBe(false);
      });
    });

    it('should apply theme after hydration delay', async () => {
      vi.useFakeTimers();
      mockTheme('dark');

      render(<ThemeProvider />);

      // Theme should be applied immediately
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // Fast-forward the timeout
      act(() => {
        vi.advanceTimersByTime(10);
      });

      // Theme should still be applied
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      
      vi.useRealTimers();
    });
  });

  describe('System Theme Media Query Tests', () => {
    it('should listen for system theme changes', async () => {
      mockTheme('system');

      render(<ThemeProvider />);

      expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
      expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should update theme when system preference changes', async () => {
      mockTheme('system');
      mockMediaQuery.matches = false; // Initially light

      render(<ThemeProvider />);

      // Initially should be light
      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true);
      });

      // Simulate system theme change to dark
      mockMediaQuery.matches = true;
      const changeHandler = mockMediaQuery.addEventListener.mock.calls.find(
        call => call[0] === 'change'
      )?.[1];
      
      if (changeHandler) {
        changeHandler();
      }

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.classList.contains('light')).toBe(false);
      });
    });

    it('should not respond to system changes when theme is not system', async () => {
      mockTheme('light');

      render(<ThemeProvider />);

      // Should be light initially
      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true);
      });

      // Simulate system theme change - should not affect anything
      mockMediaQuery.matches = true;
      const changeHandler = mockMediaQuery.addEventListener.mock.calls.find(
        call => call[0] === 'change'
      )?.[1];
      
      if (changeHandler) {
        changeHandler();
      }

      // Should still be light (not affected by system change)
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should clean up media query listener on unmount', async () => {
      mockTheme('system');

      const { unmount } = render(<ThemeProvider />);

      expect(mockMediaQuery.addEventListener).toHaveBeenCalled();

      unmount();

      expect(mockMediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('Debug Logging Tests', () => {
    it('should log mount and unmount events', async () => {
      mockTheme('light');

      const { unmount } = render(<ThemeProvider />);

      expect(mockConsoleLog).toHaveBeenCalledWith('[ThemeProvider] Mounted with theme:', 'light');

      unmount();

      expect(mockConsoleLog).toHaveBeenCalledWith('[ThemeProvider] Unmounted');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined theme gracefully', async () => {
      mockTheme(undefined);

      render(<ThemeProvider />);

      // Should not crash and should apply some default behavior
      await waitFor(() => {
        // Should not have thrown an error
        expect(document.documentElement).toBeDefined();
      });
    });

    it('should handle invalid theme values', async () => {
      mockTheme('invalid-theme' as any);

      render(<ThemeProvider />);

      // Should not crash
      await waitFor(() => {
        expect(document.documentElement).toBeDefined();
      });
    });

    it('should handle missing matchMedia', async () => {
      // Remove matchMedia
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: undefined,
      });

      mockTheme('system');

      // Should not crash even without matchMedia
      expect(() => render(<ThemeProvider />)).not.toThrow();
    });

    it('should handle multiple rapid theme changes', async () => {
      let currentTheme = 'light';
      mockTheme(currentTheme);

      const { rerender } = render(<ThemeProvider />);

      // Rapid theme changes
      const themes = ['light', 'dark', 'system', 'light', 'dark'];
      for (const theme of themes) {
        currentTheme = theme;
        mockTheme(currentTheme);
        rerender(<ThemeProvider />);
        vi.advanceTimersByTime(5); // Advance less than the 10ms timeout
      }

      // Final advancement
      vi.advanceTimersByTime(10);

      // Should end up with the last theme
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });
  });

  describe('Integration with CSS Variables', () => {
    it('should work with Tailwind CSS class-based theming', async () => {
      mockTheme('dark');

      render(<ThemeProvider />);

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      // Check that CSS custom properties would be available
      // (This would be tested in E2E tests for actual visual changes)
      const computedStyle = getComputedStyle(document.documentElement);
      expect(computedStyle).toBeDefined();
    });
  });
});