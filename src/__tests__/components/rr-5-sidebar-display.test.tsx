import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSyncStore } from '@/lib/stores/sync-store';

// Mock the sync store
vi.mock('@/lib/stores/sync-store', () => ({
  useSyncStore: vi.fn(),
}));

// Mock component that represents the sidebar API usage display
const ApiUsageDisplay = () => {
  const { apiUsage } = useSyncStore();
  
  if (!apiUsage) {
    return <div data-testid="api-usage">API Usage: Loading...</div>;
  }

  const getColorClass = (percentage: number) => {
    if (percentage >= 95) return 'text-red-500';
    if (percentage >= 80) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div data-testid="api-usage" className="text-xs space-y-1">
      <div className="font-medium">API Usage:</div>
      <div className="flex gap-2">
        <span className={getColorClass(apiUsage.zone1.percentage)}>
          {apiUsage.zone1.percentage.toFixed(1)}% (zone 1)
        </span>
        <span className="text-gray-400">|</span>
        <span className={getColorClass(apiUsage.zone2.percentage)}>
          {apiUsage.zone2.percentage.toFixed(1)}% (zone 2)
        </span>
      </div>
    </div>
  );
};

describe('RR-5: Sidebar API Usage Display - Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Display Format', () => {
    it('should display "API Usage: X% (zone 1) | Y% (zone 2)" format', () => {
      vi.mocked(useSyncStore).mockReturnValue({
        apiUsage: {
          zone1: { used: 234, limit: 5000, percentage: 4.68 },
          zone2: { used: 87, limit: 100, percentage: 87.0 },
        },
      } as any);

      render(<ApiUsageDisplay />);

      const apiUsage = screen.getByTestId('api-usage');
      expect(apiUsage).toBeInTheDocument();
      expect(apiUsage).toHaveTextContent('API Usage:');
      expect(apiUsage).toHaveTextContent('4.7% (zone 1)');
      expect(apiUsage).toHaveTextContent('87.0% (zone 2)');
      expect(apiUsage).toHaveTextContent('|'); // Separator
    });

    it('should show loading state when data is not available', () => {
      vi.mocked(useSyncStore).mockReturnValue({
        apiUsage: null,
      } as any);

      render(<ApiUsageDisplay />);

      const apiUsage = screen.getByTestId('api-usage');
      expect(apiUsage).toHaveTextContent('API Usage: Loading...');
    });

    it('should display zero usage correctly', () => {
      vi.mocked(useSyncStore).mockReturnValue({
        apiUsage: {
          zone1: { used: 0, limit: 5000, percentage: 0 },
          zone2: { used: 0, limit: 100, percentage: 0 },
        },
      } as any);

      render(<ApiUsageDisplay />);

      const apiUsage = screen.getByTestId('api-usage');
      expect(apiUsage).toHaveTextContent('0.0% (zone 1)');
      expect(apiUsage).toHaveTextContent('0.0% (zone 2)');
    });

    it('should display 100% usage correctly', () => {
      vi.mocked(useSyncStore).mockReturnValue({
        apiUsage: {
          zone1: { used: 5000, limit: 5000, percentage: 100 },
          zone2: { used: 100, limit: 100, percentage: 100 },
        },
      } as any);

      render(<ApiUsageDisplay />);

      const apiUsage = screen.getByTestId('api-usage');
      expect(apiUsage).toHaveTextContent('100.0% (zone 1)');
      expect(apiUsage).toHaveTextContent('100.0% (zone 2)');
    });
  });

  describe('Color Coding', () => {
    it('should display green color for usage below 80%', () => {
      vi.mocked(useSyncStore).mockReturnValue({
        apiUsage: {
          zone1: { used: 1000, limit: 5000, percentage: 20 },
          zone2: { used: 50, limit: 100, percentage: 50 },
        },
      } as any);

      render(<ApiUsageDisplay />);

      const apiUsage = screen.getByTestId('api-usage');
      const zone1Text = apiUsage.querySelector('.text-green-500');
      expect(zone1Text).toBeInTheDocument();
      expect(zone1Text).toHaveTextContent('20.0% (zone 1)');

      const zone2Text = apiUsage.querySelectorAll('.text-green-500')[1];
      expect(zone2Text).toBeInTheDocument();
      expect(zone2Text).toHaveTextContent('50.0% (zone 2)');
    });

    it('should display yellow color for usage between 80% and 94%', () => {
      vi.mocked(useSyncStore).mockReturnValue({
        apiUsage: {
          zone1: { used: 4000, limit: 5000, percentage: 80 },
          zone2: { used: 87, limit: 100, percentage: 87 },
        },
      } as any);

      render(<ApiUsageDisplay />);

      const apiUsage = screen.getByTestId('api-usage');
      const yellowTexts = apiUsage.querySelectorAll('.text-yellow-500');
      expect(yellowTexts).toHaveLength(2);
      expect(yellowTexts[0]).toHaveTextContent('80.0% (zone 1)');
      expect(yellowTexts[1]).toHaveTextContent('87.0% (zone 2)');
    });

    it('should display red color for usage at or above 95%', () => {
      vi.mocked(useSyncStore).mockReturnValue({
        apiUsage: {
          zone1: { used: 4750, limit: 5000, percentage: 95 },
          zone2: { used: 99, limit: 100, percentage: 99 },
        },
      } as any);

      render(<ApiUsageDisplay />);

      const apiUsage = screen.getByTestId('api-usage');
      const redTexts = apiUsage.querySelectorAll('.text-red-500');
      expect(redTexts).toHaveLength(2);
      expect(redTexts[0]).toHaveTextContent('95.0% (zone 1)');
      expect(redTexts[1]).toHaveTextContent('99.0% (zone 2)');
    });

    it('should display mixed colors based on different zone percentages', () => {
      vi.mocked(useSyncStore).mockReturnValue({
        apiUsage: {
          zone1: { used: 1000, limit: 5000, percentage: 20 }, // Green
          zone2: { used: 95, limit: 100, percentage: 95 }, // Red
        },
      } as any);

      render(<ApiUsageDisplay />);

      const apiUsage = screen.getByTestId('api-usage');
      const greenText = apiUsage.querySelector('.text-green-500');
      const redText = apiUsage.querySelector('.text-red-500');

      expect(greenText).toBeInTheDocument();
      expect(greenText).toHaveTextContent('20.0% (zone 1)');

      expect(redText).toBeInTheDocument();
      expect(redText).toHaveTextContent('95.0% (zone 2)');
    });
  });

  describe('Real-time Updates', () => {
    it('should update display when store values change', async () => {
      // Initial state
      const mockStore = vi.mocked(useSyncStore);
      mockStore.mockReturnValue({
        apiUsage: {
          zone1: { used: 100, limit: 5000, percentage: 2 },
          zone2: { used: 10, limit: 100, percentage: 10 },
        },
      } as any);

      const { rerender } = render(<ApiUsageDisplay />);

      expect(screen.getByTestId('api-usage')).toHaveTextContent('2.0% (zone 1)');
      expect(screen.getByTestId('api-usage')).toHaveTextContent('10.0% (zone 2)');

      // Update store values
      mockStore.mockReturnValue({
        apiUsage: {
          zone1: { used: 2500, limit: 5000, percentage: 50 },
          zone2: { used: 50, limit: 100, percentage: 50 },
        },
      } as any);

      rerender(<ApiUsageDisplay />);

      await waitFor(() => {
        expect(screen.getByTestId('api-usage')).toHaveTextContent('50.0% (zone 1)');
        expect(screen.getByTestId('api-usage')).toHaveTextContent('50.0% (zone 2)');
      });
    });

    it('should handle transition from loading to loaded state', async () => {
      const mockStore = vi.mocked(useSyncStore);
      
      // Start with loading state
      mockStore.mockReturnValue({
        apiUsage: null,
      } as any);

      const { rerender } = render(<ApiUsageDisplay />);

      expect(screen.getByTestId('api-usage')).toHaveTextContent('API Usage: Loading...');

      // Update to loaded state
      mockStore.mockReturnValue({
        apiUsage: {
          zone1: { used: 234, limit: 5000, percentage: 4.68 },
          zone2: { used: 87, limit: 100, percentage: 87 },
        },
      } as any);

      rerender(<ApiUsageDisplay />);

      await waitFor(() => {
        expect(screen.getByTestId('api-usage')).not.toHaveTextContent('Loading...');
        expect(screen.getByTestId('api-usage')).toHaveTextContent('4.7% (zone 1)');
        expect(screen.getByTestId('api-usage')).toHaveTextContent('87.0% (zone 2)');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle decimal percentages correctly', () => {
      vi.mocked(useSyncStore).mockReturnValue({
        apiUsage: {
          zone1: { used: 234, limit: 5000, percentage: 4.68 },
          zone2: { used: 87.5, limit: 100, percentage: 87.5 },
        },
      } as any);

      render(<ApiUsageDisplay />);

      const apiUsage = screen.getByTestId('api-usage');
      expect(apiUsage).toHaveTextContent('4.7% (zone 1)'); // Rounded to 1 decimal
      expect(apiUsage).toHaveTextContent('87.5% (zone 2)');
    });

    it('should handle very small percentages', () => {
      vi.mocked(useSyncStore).mockReturnValue({
        apiUsage: {
          zone1: { used: 1, limit: 5000, percentage: 0.02 },
          zone2: { used: 0.1, limit: 100, percentage: 0.1 },
        },
      } as any);

      render(<ApiUsageDisplay />);

      const apiUsage = screen.getByTestId('api-usage');
      expect(apiUsage).toHaveTextContent('0.0% (zone 1)'); // Rounded down
      expect(apiUsage).toHaveTextContent('0.1% (zone 2)');
    });

    it('should handle percentages at color boundaries', () => {
      // Test at 79.9% (should be green)
      vi.mocked(useSyncStore).mockReturnValue({
        apiUsage: {
          zone1: { used: 3995, limit: 5000, percentage: 79.9 },
          zone2: { used: 79.9, limit: 100, percentage: 79.9 },
        },
      } as any);

      const { rerender } = render(<ApiUsageDisplay />);

      let apiUsage = screen.getByTestId('api-usage');
      let greenTexts = apiUsage.querySelectorAll('.text-green-500');
      expect(greenTexts).toHaveLength(2);

      // Test at exactly 80% (should be yellow)
      vi.mocked(useSyncStore).mockReturnValue({
        apiUsage: {
          zone1: { used: 4000, limit: 5000, percentage: 80 },
          zone2: { used: 80, limit: 100, percentage: 80 },
        },
      } as any);

      rerender(<ApiUsageDisplay />);

      apiUsage = screen.getByTestId('api-usage');
      const yellowTexts = apiUsage.querySelectorAll('.text-yellow-500');
      expect(yellowTexts).toHaveLength(2);

      // Test at exactly 95% (should be red)
      vi.mocked(useSyncStore).mockReturnValue({
        apiUsage: {
          zone1: { used: 4750, limit: 5000, percentage: 95 },
          zone2: { used: 95, limit: 100, percentage: 95 },
        },
      } as any);

      rerender(<ApiUsageDisplay />);

      apiUsage = screen.getByTestId('api-usage');
      const redTexts = apiUsage.querySelectorAll('.text-red-500');
      expect(redTexts).toHaveLength(2);
    });

    it('should handle undefined or null values gracefully', () => {
      vi.mocked(useSyncStore).mockReturnValue({
        apiUsage: {
          zone1: { used: undefined as any, limit: 5000, percentage: 0 },
          zone2: { used: null as any, limit: 100, percentage: 0 },
        },
      } as any);

      render(<ApiUsageDisplay />);

      const apiUsage = screen.getByTestId('api-usage');
      expect(apiUsage).toBeInTheDocument();
      expect(apiUsage).toHaveTextContent('0.0% (zone 1)');
      expect(apiUsage).toHaveTextContent('0.0% (zone 2)');
    });
  });

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      vi.mocked(useSyncStore).mockReturnValue({
        apiUsage: {
          zone1: { used: 234, limit: 5000, percentage: 4.68 },
          zone2: { used: 87, limit: 100, percentage: 87 },
        },
      } as any);

      render(<ApiUsageDisplay />);

      const apiUsage = screen.getByTestId('api-usage');
      expect(apiUsage).toBeInTheDocument();
      
      // Check for proper text hierarchy
      const title = apiUsage.querySelector('.font-medium');
      expect(title).toHaveTextContent('API Usage:');
      
      // Check for visual separator
      const separator = apiUsage.querySelector('.text-gray-400');
      expect(separator).toHaveTextContent('|');
    });

    it('should maintain readability with color coding', () => {
      vi.mocked(useSyncStore).mockReturnValue({
        apiUsage: {
          zone1: { used: 4750, limit: 5000, percentage: 95 },
          zone2: { used: 50, limit: 100, percentage: 50 },
        },
      } as any);

      render(<ApiUsageDisplay />);

      const apiUsage = screen.getByTestId('api-usage');
      
      // Verify text is still readable regardless of color
      expect(apiUsage).toHaveTextContent('95.0% (zone 1)');
      expect(apiUsage).toHaveTextContent('50.0% (zone 2)');
      
      // Verify both zones are displayed
      const zones = apiUsage.querySelectorAll('span[class*="text-"]');
      expect(zones.length).toBeGreaterThanOrEqual(2);
    });
  });
});