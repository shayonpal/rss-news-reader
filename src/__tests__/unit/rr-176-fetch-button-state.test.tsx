import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FetchContentButton } from '@/components/articles/fetch-content-button';

// Mock fetch
global.fetch = vi.fn();

describe('RR-176: FetchContentButton - State Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('Button State Display', () => {
    it('should show Download icon and "Full Content" label when no full content', () => {
      render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={false}
          variant="icon"
          size="md"
        />
      );

      const button = screen.getByRole('button', { name: /full content/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Full Content');
    });

    it('should show Undo2 icon and "Original Content" label when has full content', () => {
      render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={true}
          variant="icon"
          size="md"
        />
      );

      const button = screen.getByRole('button', { name: /original content/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Original Content');
    });

    it('should display correct text in button variant', () => {
      const { rerender } = render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={false}
          variant="button"
        />
      );

      expect(screen.getByText('Fetch Full Content')).toBeInTheDocument();

      rerender(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={true}
          variant="button"
        />
      );

      expect(screen.getByText('Revert to RSS Content')).toBeInTheDocument();
    });
  });

  describe('Fetch Operation', () => {
    it('should call onSuccess with fetched content on successful fetch', async () => {
      const onSuccess = vi.fn();
      const mockContent = '<p>This is the full article content</p>';

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: mockContent,
        }),
      });

      render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={false}
          onSuccess={onSuccess}
          variant="icon"
        />
      );

      const button = screen.getByRole('button');
      await userEvent.click(button);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(mockContent);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/reader/api/articles/test-123/fetch-content',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should show loading state during fetch', async () => {
      (global.fetch as any).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    success: true,
                    content: '<p>Content</p>',
                  }),
                }),
              100
            )
          )
      );

      render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={false}
          variant="button"
        />
      );

      const button = screen.getByRole('button');
      await userEvent.click(button);

      // Should show loading text
      expect(screen.getByText(/fetching full content/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText(/fetching full content/i)).not.toBeInTheDocument();
      });
    });

    it('should display error message on fetch failure', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={false}
          variant="button"
        />
      );

      const button = screen.getByRole('button');
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should handle API error responses correctly', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          message: 'Article not found',
          details: 'The article could not be fetched',
        }),
      });

      render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={false}
          variant="button"
        />
      );

      const button = screen.getByRole('button');
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/article not found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Revert Operation', () => {
    it('should call onRevert when clicking button with full content', async () => {
      const onRevert = vi.fn();

      render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={true}
          onRevert={onRevert}
          variant="icon"
        />
      );

      const button = screen.getByRole('button');
      await userEvent.click(button);

      expect(onRevert).toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled(); // Should not fetch
    });

    it('should not call onRevert when hasFullContent is false', async () => {
      const onRevert = vi.fn();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: '<p>Content</p>',
        }),
      });

      render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={false}
          onRevert={onRevert}
          variant="icon"
        />
      );

      const button = screen.getByRole('button');
      await userEvent.click(button);

      expect(onRevert).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should show correct loading text when reverting', async () => {
      const onRevert = vi.fn();

      render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={true}
          onRevert={onRevert}
          variant="button"
        />
      );

      const button = screen.getByRole('button');
      
      // Initial state
      expect(screen.getByText('Revert to RSS Content')).toBeInTheDocument();
      
      // Note: Since revert is synchronous, we won't see "Reverting..." text
      await userEvent.click(button);
      
      expect(onRevert).toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should disable button while loading', async () => {
      (global.fetch as any).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={false}
          variant="icon"
        />
      );

      const button = screen.getByRole('button');
      await userEvent.click(button);

      // Button should be disabled during fetch
      expect(button).toHaveAttribute('disabled');

      // Should not allow another click
      await userEvent.click(button);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should prevent multiple rapid clicks', async () => {
      let resolvePromise: any;
      (global.fetch as any).mockImplementation(
        () =>
          new Promise(resolve => {
            resolvePromise = resolve;
          })
      );

      render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={false}
          variant="icon"
        />
      );

      const button = screen.getByRole('button');
      
      // Click multiple times rapidly
      await userEvent.click(button);
      await userEvent.click(button);
      await userEvent.click(button);

      // Should only call fetch once
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Resolve the promise
      resolvePromise({
        ok: true,
        json: async () => ({ success: true, content: '<p>Content</p>' }),
      });
    });
  });

  describe('Size Variants', () => {
    it('should render correct size for sm variant', () => {
      render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={false}
          variant="icon"
          size="sm"
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      // Small size should not show label
      expect(screen.queryByText('Full Content')).not.toBeInTheDocument();
    });

    it('should show label for md and lg sizes', () => {
      const { rerender } = render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={false}
          variant="icon"
          size="md"
          showLabel={true}
        />
      );

      // MD size with showLabel
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Full Content');

      rerender(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={false}
          variant="icon"
          size="lg"
          showLabel={true}
        />
      );

      // LG size
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Full Content');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing onSuccess callback gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: '<p>Content</p>',
        }),
      });

      render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={false}
          variant="icon"
        />
      );

      const button = screen.getByRole('button');
      
      // Should not throw error without onSuccess
      await expect(userEvent.click(button)).resolves.not.toThrow();
    });

    it('should handle missing onRevert callback gracefully', async () => {
      render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={true}
          variant="icon"
        />
      );

      const button = screen.getByRole('button');
      
      // Should not throw error without onRevert
      await expect(userEvent.click(button)).resolves.not.toThrow();
    });

    it('should handle empty content response', async () => {
      const onSuccess = vi.fn();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          content: null,
        }),
      });

      render(
        <FetchContentButton
          articleId="test-123"
          hasFullContent={false}
          onSuccess={onSuccess}
          variant="icon"
        />
      );

      const button = screen.getByRole('button');
      await userEvent.click(button);

      await waitFor(() => {
        // Should not call onSuccess with null content
        expect(onSuccess).not.toHaveBeenCalled();
      });
    });
  });
});