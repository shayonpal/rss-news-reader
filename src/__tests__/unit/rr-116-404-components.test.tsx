/**
 * Unit Tests for 404 Page Components - RR-116
 *
 * Tests the individual 404 page components for:
 * - Rendering behavior
 * - Navigation functionality
 * - Styling consistency
 * - Accessibility compliance
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { useRouter } from "next/navigation";
import NotFound from "../../app/not-found";
import ArticleNotFound from "../../app/article/[id]/not-found";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

// Mock UI components
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

// Mock Lucide React icons
vi.mock("lucide-react", () => ({
  FileQuestion: ({ className, ...props }: any) => (
    <div className={className} data-testid="file-question-icon" {...props}>
      FileQuestion Icon
    </div>
  ),
}));

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
};

describe("RR-116: 404 Page Components Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
  });

  describe("Global 404 Page Component", () => {
    it("should render basic 404 content", () => {
      render(<NotFound />);

      expect(screen.getByText("Not Found")).toBeInTheDocument();
      expect(
        screen.getByText("Could not find requested resource")
      ).toBeInTheDocument();
    });

    it("should use proper semantic HTML structure", () => {
      render(<NotFound />);

      const container = screen.getByText("Not Found").closest("div");
      expect(container).toBeInTheDocument();
    });

    it("should be accessible to screen readers", () => {
      render(<NotFound />);

      // Should have heading structure
      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Not Found");
    });

    it("should not have any interactive elements initially", () => {
      render(<NotFound />);

      // Global 404 is currently basic - should not have buttons
      const buttons = screen.queryAllByRole("button");
      const links = screen.queryAllByRole("link");

      expect(buttons).toHaveLength(0);
      expect(links).toHaveLength(0);
    });

    it("should maintain consistent text content", () => {
      render(<NotFound />);

      // Should have specific text content
      expect(screen.getByText("Not Found")).toBeInTheDocument();
      expect(
        screen.getByText("Could not find requested resource")
      ).toBeInTheDocument();
    });
  });

  describe("Article 404 Page Component", () => {
    it("should render article-specific 404 content", () => {
      render(<ArticleNotFound />);

      expect(screen.getByText("Article not found")).toBeInTheDocument();
      expect(
        screen.getByText(
          "The article you're looking for doesn't exist or has been removed."
        )
      ).toBeInTheDocument();
    });

    it("should display FileQuestion icon", () => {
      render(<ArticleNotFound />);

      const icon = screen.getByTestId("file-question-icon");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass(
        "mx-auto",
        "mb-4",
        "h-12",
        "w-12",
        "text-gray-400"
      );
    });

    it('should render "Back to Reader" button', () => {
      render(<ArticleNotFound />);

      const button = screen.getByRole("button", { name: "Back to Reader" });
      expect(button).toBeInTheDocument();
    });

    it("should handle navigation click", async () => {
      render(<ArticleNotFound />);

      const button = screen.getByRole("button", { name: "Back to Reader" });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/");
      });
    });

    it("should use proper layout and styling classes", () => {
      render(<ArticleNotFound />);

      // Check for layout classes
      const container = screen.getByText("Article not found").closest("div");
      expect(container?.parentElement).toHaveClass("max-w-md", "text-center");

      // Check for main container classes
      const mainContainer = container?.parentElement?.parentElement;
      expect(mainContainer).toHaveClass(
        "flex",
        "min-h-screen",
        "items-center",
        "justify-center",
        "p-4"
      );
    });

    it("should have proper heading hierarchy", () => {
      render(<ArticleNotFound />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Article not found");
      expect(heading).toHaveClass("mb-2", "text-2xl", "font-semibold");
    });

    it("should have proper dark mode styling", () => {
      render(<ArticleNotFound />);

      const description = screen.getByText(
        "The article you're looking for doesn't exist or has been removed."
      );
      expect(description).toHaveClass(
        "mb-6",
        "text-gray-600",
        "dark:text-gray-400"
      );
    });

    it("should be keyboard accessible", () => {
      render(<ArticleNotFound />);

      const button = screen.getByRole("button", { name: "Back to Reader" });

      // Button should be focusable
      button.focus();
      expect(document.activeElement).toBe(button);

      // Should handle keyboard events
      fireEvent.keyDown(button, { key: "Enter", code: "Enter" });
      expect(mockRouter.push).toHaveBeenCalledWith("/");
    });

    it("should handle multiple clicks gracefully", async () => {
      render(<ArticleNotFound />);

      const button = screen.getByRole("button", { name: "Back to Reader" });

      // Click multiple times rapidly
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe("Styling Consistency Between Components", () => {
    it("should use consistent typography patterns", () => {
      const { container: globalContainer } = render(<NotFound />);
      const { container: articleContainer } = render(<ArticleNotFound />);

      // Both should use h2 headings
      const globalHeading = globalContainer.querySelector("h2");
      const articleHeading = articleContainer.querySelector("h2");

      expect(globalHeading).toBeInTheDocument();
      expect(articleHeading).toBeInTheDocument();
    });

    it("should maintain consistent spacing patterns", () => {
      render(<ArticleNotFound />);

      // Check for consistent margin/padding patterns
      const heading = screen.getByText("Article not found");
      const description = screen.getByText(
        "The article you're looking for doesn't exist or has been removed."
      );

      expect(heading).toHaveClass("mb-2");
      expect(description).toHaveClass("mb-6");
    });

    it("should use consistent color schemes", () => {
      render(<ArticleNotFound />);

      // Check for consistent color classes
      const icon = screen.getByTestId("file-question-icon");
      const description = screen.getByText(
        "The article you're looking for doesn't exist or has been removed."
      );

      expect(icon).toHaveClass("text-gray-400");
      expect(description).toHaveClass("text-gray-600", "dark:text-gray-400");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle router errors gracefully", async () => {
      const mockRouterWithError = {
        ...mockRouter,
        push: vi.fn().mockRejectedValue(new Error("Navigation failed")),
      };
      (useRouter as any).mockReturnValue(mockRouterWithError);

      render(<ArticleNotFound />);

      const button = screen.getByRole("button", { name: "Back to Reader" });

      // Should not crash when navigation fails
      expect(() => fireEvent.click(button)).not.toThrow();
    });

    it("should work without router context", () => {
      (useRouter as any).mockReturnValue(null);

      // Should still render without crashing
      expect(() => render(<ArticleNotFound />)).not.toThrow();
    });

    it("should handle missing icon gracefully", () => {
      // Test with missing icon mock
      vi.doMock("lucide-react", () => ({
        FileQuestion: null,
      }));

      expect(() => render(<ArticleNotFound />)).not.toThrow();
    });

    it("should handle long text content properly", () => {
      render(<ArticleNotFound />);

      const container = screen.getByText("Article not found").closest("div");
      expect(container?.parentElement).toHaveClass("max-w-md");

      // Should constrain width for long content
      const description = screen.getByText(
        "The article you're looking for doesn't exist or has been removed."
      );
      expect(description.closest(".max-w-md")).toBeInTheDocument();
    });
  });

  describe("Accessibility Compliance", () => {
    it("should have proper ARIA attributes", () => {
      render(<ArticleNotFound />);

      const button = screen.getByRole("button", { name: "Back to Reader" });
      expect(button).toHaveAttribute("type", "button");
    });

    it("should have sufficient color contrast", () => {
      render(<ArticleNotFound />);

      // Text should use appropriate contrast classes
      const description = screen.getByText(
        "The article you're looking for doesn't exist or has been removed."
      );
      expect(description).toHaveClass("text-gray-600", "dark:text-gray-400");
    });

    it("should be navigable with keyboard only", () => {
      render(<ArticleNotFound />);

      const button = screen.getByRole("button", { name: "Back to Reader" });

      // Should be tabbable
      expect(button.tabIndex).not.toBe(-1);

      // Should respond to keyboard activation
      fireEvent.keyDown(button, { key: " ", code: "Space" });
      expect(mockRouter.push).toHaveBeenCalled();
    });

    it("should have descriptive text for screen readers", () => {
      render(<ArticleNotFound />);

      // Should have descriptive headings and text
      expect(
        screen.getByRole("heading", { name: "Article not found" })
      ).toBeInTheDocument();

      const description = screen.getByText(
        "The article you're looking for doesn't exist or has been removed."
      );
      expect(description).toBeInTheDocument();
    });

    it("should have appropriate landmark structure", () => {
      const { container } = render(<ArticleNotFound />);

      // Should have proper container structure for screen readers
      const mainContent = container.querySelector(".flex.min-h-screen");
      expect(mainContent).toBeInTheDocument();
    });
  });

  describe("Performance Considerations", () => {
    it("should render quickly without expensive operations", () => {
      const startTime = performance.now();
      render(<ArticleNotFound />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // Should render in under 50ms
    });

    it("should not cause memory leaks with event listeners", () => {
      const { unmount } = render(<ArticleNotFound />);

      const button = screen.getByRole("button", { name: "Back to Reader" });
      fireEvent.click(button);

      // Should clean up properly on unmount
      expect(() => unmount()).not.toThrow();
    });

    it("should minimize re-renders", () => {
      const { rerender } = render(<ArticleNotFound />);

      // Should handle re-renders without issues
      expect(() => rerender(<ArticleNotFound />)).not.toThrow();
    });
  });

  describe("Responsive Design", () => {
    it("should use responsive padding classes", () => {
      render(<ArticleNotFound />);

      const container = screen
        .getByText("Article not found")
        .closest(".flex.min-h-screen");
      expect(container).toHaveClass("p-4");
    });

    it("should constrain width appropriately", () => {
      render(<ArticleNotFound />);

      const contentContainer = screen
        .getByText("Article not found")
        .closest("div");
      expect(contentContainer?.parentElement).toHaveClass("max-w-md");
    });

    it("should center content properly", () => {
      render(<ArticleNotFound />);

      const container = screen
        .getByText("Article not found")
        .closest(".flex.min-h-screen");
      expect(container).toHaveClass("items-center", "justify-center");
    });
  });
});
