/**
 * Unit tests for DualRangeSlider component
 * RR-272: User preferences API integration with Settings page
 *
 * Tests the dual-handle range slider for summary length selection
 * with proper validation, accessibility, and touch interactions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { DualRangeSlider } from "@/components/ui/dual-range-slider";

describe("DualRangeSlider", () => {
  const mockOnMinChange = vi.fn();
  const mockOnMaxChange = vi.fn();
  const defaultProps = {
    min: 50,
    max: 500,
    minValue: 100,
    maxValue: 300,
    step: 10,
    label: "Summary Length",
    onMinChange: mockOnMinChange,
    onMaxChange: mockOnMaxChange,
    formatValue: (v: number) => `${v} words`,
    testId: "summary-length-slider",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("should render with proper structure and accessibility attributes", () => {
      render(<DualRangeSlider {...defaultProps} />);

      // Check label rendering
      expect(screen.getByText("Summary Length")).toBeInTheDocument();

      // Check value display
      expect(screen.getByText("100 – 300 words")).toBeInTheDocument();

      // Check sliders exist with proper ARIA attributes
      const minSlider = screen.getByRole("slider", { name: /minimum/i });
      const maxSlider = screen.getByRole("slider", { name: /maximum/i });

      expect(minSlider).toHaveAttribute("aria-valuemin", "50");
      expect(minSlider).toHaveAttribute("aria-valuemax", "500");
      expect(minSlider).toHaveAttribute("aria-valuenow", "100");
      expect(minSlider).toHaveAttribute("aria-label", "Minimum summary length");

      expect(maxSlider).toHaveAttribute("aria-valuemin", "50");
      expect(maxSlider).toHaveAttribute("aria-valuemax", "500");
      expect(maxSlider).toHaveAttribute("aria-valuenow", "300");
      expect(maxSlider).toHaveAttribute("aria-label", "Maximum summary length");
    });

    it("should render with glass morphing styles", () => {
      const { container } = render(<DualRangeSlider {...defaultProps} />);

      const sliderContainer = container.querySelector(
        '[data-testid="summary-length-slider"]'
      );
      expect(sliderContainer).toHaveClass("glass-morphing");

      // Check for liquid glass UI classes
      const track = container.querySelector(".slider-track");
      expect(track).toHaveClass("bg-muted/20", "backdrop-blur-sm");

      const activeRange = container.querySelector(".slider-active-range");
      expect(activeRange).toHaveClass("bg-primary/80", "backdrop-blur-md");
    });

    it("should display help text when provided", () => {
      render(
        <DualRangeSlider
          {...defaultProps}
          helpText="Drag handles to set minimum and maximum summary length"
        />
      );

      expect(
        screen.getByText(
          "Drag handles to set minimum and maximum summary length"
        )
      ).toBeInTheDocument();
    });

    it("should handle disabled state", () => {
      render(<DualRangeSlider {...defaultProps} disabled />);

      const minSlider = screen.getByRole("slider", { name: /minimum/i });
      const maxSlider = screen.getByRole("slider", { name: /maximum/i });

      expect(minSlider).toBeDisabled();
      expect(maxSlider).toBeDisabled();
      expect(minSlider).toHaveClass("opacity-50", "cursor-not-allowed");
      expect(maxSlider).toHaveClass("opacity-50", "cursor-not-allowed");
    });
  });

  describe("Value Management", () => {
    it("should prevent min value from exceeding max value", async () => {
      render(<DualRangeSlider {...defaultProps} />);

      const minSlider = screen.getByRole("slider", { name: /minimum/i });

      // Try to set min value higher than current max (300)
      fireEvent.change(minSlider, { target: { value: "350" } });

      await waitFor(() => {
        // Min should be clamped to max value
        expect(mockOnChange).toHaveBeenCalledWith({
          min: 300,
          max: 300,
        });
      });
    });

    it("should prevent max value from going below min value", async () => {
      render(<DualRangeSlider {...defaultProps} />);

      const maxSlider = screen.getByRole("slider", { name: /maximum/i });

      // Try to set max value lower than current min (100)
      fireEvent.change(maxSlider, { target: { value: "80" } });

      await waitFor(() => {
        // Max should be clamped to min value
        expect(mockOnChange).toHaveBeenCalledWith({
          min: 100,
          max: 100,
        });
      });
    });

    it("should enforce step increments", async () => {
      render(<DualRangeSlider {...defaultProps} />);

      const minSlider = screen.getByRole("slider", { name: /minimum/i });

      // Try to set value not aligned with step
      fireEvent.change(minSlider, { target: { value: "123" } });

      await waitFor(() => {
        // Should round to nearest step (120)
        expect(mockOnChange).toHaveBeenCalledWith({
          min: 120,
          max: 300,
        });
      });
    });

    it("should handle boundary values correctly", async () => {
      render(<DualRangeSlider {...defaultProps} />);

      const minSlider = screen.getByRole("slider", { name: /minimum/i });
      const maxSlider = screen.getByRole("slider", { name: /maximum/i });

      // Test minimum boundary
      fireEvent.change(minSlider, { target: { value: "50" } });
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          min: 50,
          max: 300,
        });
      });

      // Test maximum boundary
      fireEvent.change(maxSlider, { target: { value: "500" } });
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          min: 50,
          max: 500,
        });
      });
    });

    it("should update value display in real-time", async () => {
      const { rerender } = render(<DualRangeSlider {...defaultProps} />);

      expect(screen.getByText("100 – 300 words")).toBeInTheDocument();

      // Update props with new values
      rerender(
        <DualRangeSlider {...defaultProps} minValue={150} maxValue={400} />
      );

      expect(screen.getByText("150 – 400 words")).toBeInTheDocument();
    });
  });

  describe("Touch Interactions", () => {
    it("should have minimum touch target size of 44x44px for iOS", () => {
      const { container } = render(<DualRangeSlider {...defaultProps} />);

      const handles = container.querySelectorAll(".slider-handle");

      handles.forEach((handle) => {
        const rect = handle.getBoundingClientRect();
        expect(rect.width).toBeGreaterThanOrEqual(44);
        expect(rect.height).toBeGreaterThanOrEqual(44);
      });
    });

    it("should handle touch events for mobile interaction", async () => {
      const { container } = render(<DualRangeSlider {...defaultProps} />);

      const minHandle = container.querySelector('[data-handle="min"]');

      // Simulate touch drag
      fireEvent.touchStart(minHandle!, {
        touches: [{ clientX: 100, clientY: 50 }],
      });

      fireEvent.touchMove(minHandle!, {
        touches: [{ clientX: 150, clientY: 50 }],
      });

      fireEvent.touchEnd(minHandle!, {});

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });

    it("should prevent scroll while dragging on mobile", () => {
      const { container } = render(<DualRangeSlider {...defaultProps} />);

      const minHandle = container.querySelector('[data-handle="min"]');

      const touchStartEvent = new TouchEvent("touchstart", {
        bubbles: true,
        cancelable: true,
        touches: [{ clientX: 100, clientY: 50 } as Touch],
      });

      const preventDefault = vi.spyOn(touchStartEvent, "preventDefault");

      fireEvent(minHandle!, touchStartEvent);

      expect(preventDefault).toHaveBeenCalled();
    });
  });

  describe("Keyboard Navigation", () => {
    it("should support keyboard navigation with arrow keys", async () => {
      render(<DualRangeSlider {...defaultProps} />);

      const minSlider = screen.getByRole("slider", { name: /minimum/i });

      minSlider.focus();

      // Press right arrow to increase value
      fireEvent.keyDown(minSlider, { key: "ArrowRight" });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          min: 110,
          max: 300,
        });
      });

      // Press left arrow to decrease value
      fireEvent.keyDown(minSlider, { key: "ArrowLeft" });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          min: 100,
          max: 300,
        });
      });
    });

    it("should support larger jumps with Page Up/Down", async () => {
      render(<DualRangeSlider {...defaultProps} />);

      const maxSlider = screen.getByRole("slider", { name: /maximum/i });

      maxSlider.focus();

      // Page Up should increase by larger increment (10% of range)
      fireEvent.keyDown(maxSlider, { key: "PageUp" });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          min: 100,
          max: 345, // 300 + 45 (10% of 450 range)
        });
      });
    });

    it("should support Home/End keys for min/max values", async () => {
      render(<DualRangeSlider {...defaultProps} />);

      const minSlider = screen.getByRole("slider", { name: /minimum/i });

      minSlider.focus();

      // Home key sets to minimum
      fireEvent.keyDown(minSlider, { key: "Home" });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          min: 50,
          max: 300,
        });
      });

      // End key sets to maximum (but not beyond max handle)
      fireEvent.keyDown(minSlider, { key: "End" });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          min: 300,
          max: 300,
        });
      });
    });
  });

  describe("Visual Feedback", () => {
    it("should show active state when handle is being dragged", async () => {
      const { container } = render(<DualRangeSlider {...defaultProps} />);

      const minHandle = container.querySelector('[data-handle="min"]');

      // Start dragging
      fireEvent.mouseDown(minHandle!);

      expect(minHandle).toHaveClass("scale-110", "shadow-lg");

      // Stop dragging
      fireEvent.mouseUp(minHandle!);

      await waitFor(() => {
        expect(minHandle).not.toHaveClass("scale-110");
      });
    });

    it("should show focus ring when focused via keyboard", () => {
      render(<DualRangeSlider {...defaultProps} />);

      const minSlider = screen.getByRole("slider", { name: /minimum/i });

      minSlider.focus();

      expect(minSlider.parentElement).toHaveClass(
        "ring-2",
        "ring-primary",
        "ring-offset-2"
      );
    });

    it("should update active range visual dynamically", () => {
      const { container, rerender } = render(
        <DualRangeSlider {...defaultProps} />
      );

      const activeRange = container.querySelector(".slider-active-range");

      // Initial state: 100-300 out of 50-500 range
      // Left position: (100-50)/(500-50) = 50/450 = 11.11%
      // Right position: (500-300)/(500-50) = 200/450 = 44.44%
      expect(activeRange).toHaveStyle({
        left: "11.11%",
        right: "44.44%",
      });

      // Update values
      rerender(
        <DualRangeSlider {...defaultProps} minValue={200} maxValue={400} />
      );

      // New state: 200-400
      // Left: (200-50)/450 = 33.33%
      // Right: (500-400)/450 = 22.22%
      expect(activeRange).toHaveStyle({
        left: "33.33%",
        right: "22.22%",
      });
    });
  });

  describe("Integration with Form", () => {
    it("should work with controlled form state", async () => {
      const FormWrapper = () => {
        const [values, setValues] = React.useState({ min: 100, max: 300 });

        return (
          <form>
            <DualRangeSlider
              {...defaultProps}
              minValue={values.min}
              maxValue={values.max}
              onChange={(newValues) => setValues(newValues)}
            />
            <span data-testid="form-values">
              {values.min}-{values.max}
            </span>
          </form>
        );
      };

      render(<FormWrapper />);

      expect(screen.getByTestId("form-values")).toHaveTextContent("100-300");

      const minSlider = screen.getByRole("slider", { name: /minimum/i });
      fireEvent.change(minSlider, { target: { value: "150" } });

      await waitFor(() => {
        expect(screen.getByTestId("form-values")).toHaveTextContent("150-300");
      });
    });

    it("should validate against form constraints", async () => {
      const mockValidate = vi.fn((values) => {
        // Ensure min is at least 50 words apart from max
        if (values.max - values.min < 50) {
          return { error: "Range must be at least 50 words" };
        }
        return { valid: true };
      });

      render(
        <DualRangeSlider
          {...defaultProps}
          onChange={(values) => {
            const result = mockValidate(values);
            mockOnChange(values, result);
          }}
        />
      );

      const minSlider = screen.getByRole("slider", { name: /minimum/i });

      // Try to set min too close to max
      fireEvent.change(minSlider, { target: { value: "280" } });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          { min: 280, max: 300 },
          { error: "Range must be at least 50 words" }
        );
      });
    });
  });

  describe("Performance", () => {
    it("should debounce rapid value changes", async () => {
      vi.useFakeTimers();

      render(<DualRangeSlider {...defaultProps} debounceMs={300} />);

      const minSlider = screen.getByRole("slider", { name: /minimum/i });

      // Rapidly change values
      fireEvent.change(minSlider, { target: { value: "110" } });
      fireEvent.change(minSlider, { target: { value: "120" } });
      fireEvent.change(minSlider, { target: { value: "130" } });
      fireEvent.change(minSlider, { target: { value: "140" } });

      // Should not have called onChange yet
      expect(mockOnChange).not.toHaveBeenCalled();

      // Fast-forward debounce timer
      vi.advanceTimersByTime(300);

      await waitFor(() => {
        // Should only call with final value
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith({
          min: 140,
          max: 300,
        });
      });

      vi.useRealTimers();
    });

    it("should render efficiently without unnecessary re-renders", () => {
      const renderSpy = vi.fn();

      const TestComponent = (props: any) => {
        renderSpy();
        return <DualRangeSlider {...props} />;
      };

      const { rerender } = render(<TestComponent {...defaultProps} />);

      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Props that don't affect rendering shouldn't trigger re-render
      rerender(<TestComponent {...defaultProps} />);

      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Only value changes should trigger re-render
      rerender(<TestComponent {...defaultProps} minValue={150} />);

      expect(renderSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid prop values gracefully", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Min greater than max
      render(<DualRangeSlider {...defaultProps} min={500} max={100} />);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid range configuration")
      );

      consoleSpy.mockRestore();
    });

    it("should handle NaN values", async () => {
      render(<DualRangeSlider {...defaultProps} />);

      const minSlider = screen.getByRole("slider", { name: /minimum/i });

      // Simulate invalid input
      fireEvent.change(minSlider, { target: { value: "not-a-number" } });

      await waitFor(() => {
        // Should not call onChange with invalid value
        expect(mockOnChange).not.toHaveBeenCalled();
      });
    });

    it("should recover from error state", async () => {
      const { rerender } = render(
        <DualRangeSlider {...defaultProps} minValue={NaN} />
      );

      // Should show fallback value
      expect(
        screen.getByText(`${defaultProps.min} – ${defaultProps.maxValue} words`)
      ).toBeInTheDocument();

      // Recover with valid values
      rerender(<DualRangeSlider {...defaultProps} minValue={150} />);

      expect(screen.getByText("150 – 300 words")).toBeInTheDocument();
    });
  });
});
