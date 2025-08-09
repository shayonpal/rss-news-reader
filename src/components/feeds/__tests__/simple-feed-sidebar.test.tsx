/**
 * RR-170: Component Tests for SimpleFeedSidebar Tag Rendering
 * 
 * These tests verify that the SimpleFeedSidebar component correctly
 * decodes and displays tag names with HTML entities.
 * 
 * Test Scope:
 * 1. Tag names are decoded for display
 * 2. Security: HTML is properly escaped after decoding
 * 3. Tag selection works with decoded names
 * 4. Visual elements (colors, counts) display correctly
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SimpleFeedSidebar } from '../simple-feed-sidebar';
import { COMPONENT_TEST_CASES } from '@/__tests__/contracts/rr-170-tag-html-entities.contract';

// Mock the required hooks and utilities
vi.mock('@/lib/utils/html-decoder', () => ({
  decodeHtmlEntities: vi.fn((text: string) => {
    if (!text) return '';
    
    // Simple mock implementation for testing
    return text
      .replace(/&#x2F;/g, '/')
      .replace(/&amp;/g, '&')
      .replace(/&#8211;/g, '–')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  })
}));

vi.mock('@/lib/utils/html-escape', () => ({
  escapeHtml: vi.fn((text: string) => {
    if (!text) return '';
    
    // Simple mock implementation for testing
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  })
}));

// Mock the CollapsibleFilterSection component
vi.mock('../collapsible-filter-section', () => ({
  default: ({ title, children, defaultOpen }: any) => (
    <div data-testid="collapsible-section">
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  )
}));

describe('RR-170: SimpleFeedSidebar Tag Display Tests', () => {
  const mockProps = {
    feeds: [],
    folders: [],
    selectedFeedId: null,
    selectedFolderId: null,
    selectedFilter: 'all' as const,
    onFeedSelect: vi.fn(),
    onFolderSelect: vi.fn(),
    onFilterSelect: vi.fn(),
    isReading: false,
    readingArticleId: null,
    unreadCounts: {},
    tags: [],
    selectedTagId: null,
    onTagSelect: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tag Name Display', () => {
    COMPONENT_TEST_CASES.forEach((testCase: any) => {
      it(`should display: ${testCase.description}`, () => {
        const props = {
          ...mockProps,
          tags: [testCase.tag]
        };

        render(<SimpleFeedSidebar {...props} />);

        // Find the Topics section
        const topicsSection = screen.getByTestId('collapsible-section');
        expect(topicsSection).toBeInTheDocument();

        // The tag should be rendered with decoded entities
        // Note: The actual implementation will use decodeHtmlEntities + escapeHtml
        const tagElement = within(topicsSection).getByText((content, element) => {
          // Check if the element contains the expected display text
          return element?.textContent?.includes(testCase.expectedDisplay) || false;
        });

        expect(tagElement).toBeInTheDocument();
      });
    });
  });

  describe('Multiple Tags Display', () => {
    it('should display multiple tags with various HTML entities', () => {
      const multipleTags = [
        {
          id: 'tag-1',
          name: 'India&#x2F;Canada',
          slug: 'india-canada',
          articleCount: 42,
          color: '#FF5733'
        },
        {
          id: 'tag-2',
          name: 'Tech &amp; Science',
          slug: 'tech-science',
          articleCount: 156,
          color: '#3366CC'
        },
        {
          id: 'tag-3',
          name: 'Q&amp;A &#8211; Daily',
          slug: 'qa-daily',
          articleCount: 23
        }
      ];

      const props = {
        ...mockProps,
        tags: multipleTags
      };

      render(<SimpleFeedSidebar {...props} />);

      // Check that all tags are displayed with decoded names
      expect(screen.getByText(/India\/Canada/)).toBeInTheDocument();
      expect(screen.getByText(/Tech & Science/)).toBeInTheDocument();
      expect(screen.getByText(/Q&A – Daily/)).toBeInTheDocument();
    });
  });

  describe('Tag Selection', () => {
    it('should handle tag selection with decoded names', () => {
      const tag = {
        id: 'tag-1',
        name: 'India&#x2F;Canada',
        slug: 'india-canada',
        articleCount: 42
      };

      const props = {
        ...mockProps,
        tags: [tag]
      };

      render(<SimpleFeedSidebar {...props} />);

      // Find and click the tag
      const tagButton = screen.getByRole('button', { name: /India\/Canada/ });
      fireEvent.click(tagButton);

      // Should call onTagSelect with the tag ID
      expect(props.onTagSelect).toHaveBeenCalledWith('tag-1');
      
      // Should clear feed selection
      expect(props.onFeedSelect).toHaveBeenCalledWith(null);
    });

    it('should toggle tag selection on second click', () => {
      const tag = {
        id: 'tag-1',
        name: 'Tech &amp; Science',
        slug: 'tech-science',
        articleCount: 100
      };

      const props = {
        ...mockProps,
        tags: [tag],
        selectedTagId: 'tag-1' // Already selected
      };

      render(<SimpleFeedSidebar {...props} />);

      // Find and click the selected tag
      const tagButton = screen.getByRole('button', { name: /Tech & Science/ });
      fireEvent.click(tagButton);

      // Should deselect the tag
      expect(props.onTagSelect).toHaveBeenCalledWith(null);
    });
  });

  describe('Visual Elements', () => {
    it('should display tag color indicator', () => {
      const tag = {
        id: 'tag-1',
        name: 'News &amp; Updates',
        slug: 'news-updates',
        articleCount: 50,
        color: '#FF5733'
      };

      const props = {
        ...mockProps,
        tags: [tag]
      };

      render(<SimpleFeedSidebar {...props} />);

      // Check for color indicator
      const colorIndicator = document.querySelector('[style*="background-color: #FF5733"]');
      expect(colorIndicator).toBeInTheDocument();
    });

    it('should display article count badge', () => {
      const tag = {
        id: 'tag-1',
        name: 'Tech &amp; AI',
        slug: 'tech-ai',
        articleCount: 1500
      };

      const props = {
        ...mockProps,
        tags: [tag]
      };

      render(<SimpleFeedSidebar {...props} />);

      // Should show "999+" for counts over 999
      expect(screen.getByText('999+')).toBeInTheDocument();
    });

    it('should not display color indicator when color is null', () => {
      const tag = {
        id: 'tag-1',
        name: 'General',
        slug: 'general',
        articleCount: 10,
        color: null
      };

      const props = {
        ...mockProps,
        tags: [tag]
      };

      render(<SimpleFeedSidebar {...props} />);

      // Should not have any color indicators
      const colorIndicators = document.querySelectorAll('[style*="background-color"]');
      expect(colorIndicators).toHaveLength(0);
    });
  });

  describe('Security: XSS Prevention', () => {
    it('should escape HTML tags in tag names after decoding', () => {
      const maliciousTag = {
        id: 'tag-evil',
        name: '&lt;script&gt;alert("xss")&lt;/script&gt;',
        slug: 'malicious',
        articleCount: 0
      };

      const props = {
        ...mockProps,
        tags: [maliciousTag]
      };

      render(<SimpleFeedSidebar {...props} />);

      // Should not execute script
      expect(document.querySelector('script')).not.toBeInTheDocument();
      
      // Should display escaped version
      const tagText = screen.getByText(/script/);
      expect(tagText.innerHTML).toContain('&lt;');
      expect(tagText.innerHTML).toContain('&gt;');
    });

    it('should handle onclick injection attempts', () => {
      const injectionTag = {
        id: 'tag-inject',
        name: 'Normal" onclick="alert(1)',
        slug: 'injection',
        articleCount: 5
      };

      const props = {
        ...mockProps,
        tags: [injectionTag]
      };

      render(<SimpleFeedSidebar {...props} />);

      // Should not have onclick attribute injected
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button.getAttribute('onclick')).toBeNull();
      });
    });
  });

  describe('Empty States', () => {
    it('should not render Topics section when no tags exist', () => {
      const props = {
        ...mockProps,
        tags: []
      };

      render(<SimpleFeedSidebar {...props} />);

      // Topics section should not be rendered
      expect(screen.queryByText('Topics')).not.toBeInTheDocument();
    });

    it('should handle tags with empty names gracefully', () => {
      const emptyTag = {
        id: 'tag-empty',
        name: '',
        slug: 'empty',
        articleCount: 0
      };

      const props = {
        ...mockProps,
        tags: [emptyTag]
      };

      render(<SimpleFeedSidebar {...props} />);

      // Should render without crashing
      expect(screen.getByTestId('collapsible-section')).toBeInTheDocument();
    });
  });

  describe('Styling and Interaction', () => {
    it('should apply selected styles to selected tag', () => {
      const tag = {
        id: 'tag-1',
        name: 'Selected &amp; Active',
        slug: 'selected',
        articleCount: 25
      };

      const props = {
        ...mockProps,
        tags: [tag],
        selectedTagId: 'tag-1'
      };

      render(<SimpleFeedSidebar {...props} />);

      const tagButton = screen.getByRole('button', { name: /Selected & Active/ });
      
      // Should have selected class
      expect(tagButton.className).toContain('bg-muted');
    });

    it('should apply hover styles to tags', () => {
      const tag = {
        id: 'tag-1',
        name: 'Hover &amp; Test',
        slug: 'hover',
        articleCount: 10
      };

      const props = {
        ...mockProps,
        tags: [tag]
      };

      render(<SimpleFeedSidebar {...props} />);

      const tagButton = screen.getByRole('button', { name: /Hover & Test/ });
      
      // Should have hover class
      expect(tagButton.className).toContain('hover:bg-muted');
    });
  });

  describe('Performance', () => {
    it('should efficiently render large number of tags', () => {
      const manyTags = Array(50).fill(null).map((_, i) => ({
        id: `tag-${i}`,
        name: `Tag ${i} &amp; Content &#x2F; More`,
        slug: `tag-${i}`,
        articleCount: i * 10
      }));

      const props = {
        ...mockProps,
        tags: manyTags
      };

      const startTime = performance.now();
      render(<SimpleFeedSidebar {...props} />);
      const endTime = performance.now();

      // Should render within reasonable time
      expect(endTime - startTime).toBeLessThan(500); // 500ms for 50 tags

      // All tags should be rendered
      const topicsSection = screen.getByTestId('collapsible-section');
      const tagButtons = within(topicsSection).getAllByRole('button');
      expect(tagButtons).toHaveLength(50);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for tags', () => {
      const tag = {
        id: 'tag-1',
        name: 'Accessible &amp; Usable',
        slug: 'accessible',
        articleCount: 30
      };

      const props = {
        ...mockProps,
        tags: [tag]
      };

      render(<SimpleFeedSidebar {...props} />);

      const tagButton = screen.getByRole('button', { name: /Accessible & Usable/ });
      
      // Should be a button with proper role
      expect(tagButton).toHaveAttribute('role', 'button');
      
      // Should be keyboard accessible
      expect(tagButton).toHaveAttribute('tabIndex');
    });

    it('should show article count in accessible format', () => {
      const tag = {
        id: 'tag-1',
        name: 'Articles &amp; Posts',
        slug: 'articles',
        articleCount: 42
      };

      const props = {
        ...mockProps,
        tags: [tag]
      };

      render(<SimpleFeedSidebar {...props} />);

      // Article count should be visible
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });
});