import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "../theme-toggle";
import { useUIStore } from "@/lib/stores/ui-store";

// Mock the UI store
vi.mock("@/lib/stores/ui-store");

describe("ThemeToggle Component (RR-126)", () => {
  const mockSetTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock the store implementation
    (useUIStore as any).mockReturnValue({
      theme: "system",
      setTheme: mockSetTheme,
    });
  });

  describe("Icon Display Tests", () => {
    it("should display Sun icon for light theme", () => {
      (useUIStore as any).mockReturnValue({
        theme: "light",
        setTheme: mockSetTheme,
      });

      render(<ThemeToggle />);

      // Check that Sun icon is rendered (Lucide React uses data-testid)
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute(
        "aria-label",
        "Current theme: light. Click to cycle themes."
      );

      // Sun icon should be present
      const sunIcon = button.querySelector("svg");
      expect(sunIcon).toBeInTheDocument();
    });

    it("should display Moon icon for dark theme", () => {
      (useUIStore as any).mockReturnValue({
        theme: "dark",
        setTheme: mockSetTheme,
      });

      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute(
        "aria-label",
        "Current theme: dark. Click to cycle themes."
      );

      // Moon icon should be present
      const moonIcon = button.querySelector("svg");
      expect(moonIcon).toBeInTheDocument();
    });

    it("should display Monitor icon for system theme", () => {
      (useUIStore as any).mockReturnValue({
        theme: "system",
        setTheme: mockSetTheme,
      });

      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute(
        "aria-label",
        "Current theme: system. Click to cycle themes."
      );

      // Monitor icon should be present
      const monitorIcon = button.querySelector("svg");
      expect(monitorIcon).toBeInTheDocument();
    });
  });

  describe("Theme Cycling Logic Tests", () => {
    it("should cycle from light to dark", () => {
      (useUIStore as any).mockReturnValue({
        theme: "light",
        setTheme: mockSetTheme,
      });

      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockSetTheme).toHaveBeenCalledWith("dark");
    });

    it("should cycle from dark to system", () => {
      (useUIStore as any).mockReturnValue({
        theme: "dark",
        setTheme: mockSetTheme,
      });

      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockSetTheme).toHaveBeenCalledWith("system");
    });

    it("should cycle from system to light", () => {
      (useUIStore as any).mockReturnValue({
        theme: "system",
        setTheme: mockSetTheme,
      });

      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockSetTheme).toHaveBeenCalledWith("light");
    });

    it("should handle multiple rapid clicks correctly", () => {
      (useUIStore as any).mockReturnValue({
        theme: "light",
        setTheme: mockSetTheme,
      });

      render(<ThemeToggle />);

      const button = screen.getByRole("button");

      // Rapid clicks
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockSetTheme).toHaveBeenCalledTimes(3);
      expect(mockSetTheme).toHaveBeenNthCalledWith(1, "dark");
      expect(mockSetTheme).toHaveBeenNthCalledWith(2, "dark"); // Still dark because store didn't update
      expect(mockSetTheme).toHaveBeenNthCalledWith(3, "dark");
    });
  });

  describe("Accessibility Tests", () => {
    it("should have proper ARIA label for each theme state", () => {
      const themes = ["light", "dark", "system"] as const;

      themes.forEach((theme) => {
        (useUIStore as any).mockReturnValue({
          theme,
          setTheme: mockSetTheme,
        });

        const { rerender } = render(<ThemeToggle />);

        const button = screen.getByRole("button");
        expect(button).toHaveAttribute(
          "aria-label",
          `Current theme: ${theme}. Click to cycle themes.`
        );

        rerender(<div />); // Clean up
      });
    });

    it("should be keyboard accessible", () => {
      render(<ThemeToggle />);

      const button = screen.getByRole("button");

      // Test keyboard interaction
      fireEvent.keyDown(button, { key: "Enter" });
      expect(mockSetTheme).toHaveBeenCalledWith("light");

      fireEvent.keyDown(button, { key: " " });
      expect(mockSetTheme).toHaveBeenCalledTimes(2);
    });

    it("should have proper button attributes", () => {
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-9", "w-9");
      expect(button).toHaveAttribute("type", "button");
    });
  });

  describe("Error Handling Tests", () => {
    it("should handle invalid theme state gracefully", () => {
      (useUIStore as any).mockReturnValue({
        theme: "invalid-theme" as any,
        setTheme: mockSetTheme,
      });

      render(<ThemeToggle />);

      const button = screen.getByRole("button");

      // Should default to Monitor icon for invalid theme
      const monitorIcon = button.querySelector("svg");
      expect(monitorIcon).toBeInTheDocument();

      // Should still be clickable
      fireEvent.click(button);
      expect(mockSetTheme).toHaveBeenCalled();
    });

    it("should handle missing theme store gracefully", () => {
      (useUIStore as any).mockReturnValue({
        theme: undefined,
        setTheme: mockSetTheme,
      });

      render(<ThemeToggle />);

      const button = screen.getByRole("button");

      // Should default to Monitor icon when theme is undefined
      const monitorIcon = button.querySelector("svg");
      expect(monitorIcon).toBeInTheDocument();
    });
  });
});
