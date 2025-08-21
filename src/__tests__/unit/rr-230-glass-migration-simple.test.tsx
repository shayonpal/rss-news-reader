/**
 * RR-230: Simplified Glass Migration Validation
 * Focus on core functionality without complex setup
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  GlassIconButton,
  GlassToolbarButton,
} from "@/components/ui/glass-button";

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    matches: false,
    media: "",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe("RR-230: Core Glass Migration", () => {
  test("GlassToolbarButton defaults to toolbarChild variant", () => {
    render(<GlassToolbarButton>Test</GlassToolbarButton>);
    const button = screen.getByRole("button");

    // Key requirement: should be transparent for container glass
    expect(button.className).toContain("bg-transparent");
    expect(button.className).toContain("glass-toolbar-btn");
  });

  test("GlassIconButton defaults to nav variant", () => {
    render(<GlassIconButton>Icon</GlassIconButton>);
    const button = screen.getByRole("button");

    // Key requirement: should use CSS variables for standalone glass
    expect(button.className).toContain("bg-[var(--glass-nav-bg)]");
    expect(button.className).toContain("glass-icon-btn");
  });

  test("size constraints maintained for unified design", () => {
    render(
      <div>
        <GlassToolbarButton data-testid="toolbar">Toolbar</GlassToolbarButton>
        <GlassIconButton data-testid="icon">Icon</GlassIconButton>
      </div>
    );

    const toolbarButton = screen.getByTestId("toolbar");
    const iconButton = screen.getByTestId("icon");

    // Toolbar: 44px (within container totaling 48px), Icon: 48px standalone
    expect(toolbarButton.className).toContain("h-[44px]");
    expect(iconButton.className).toContain("h-[48px]");
  });

  test("UA appearance normalization applied", () => {
    render(<GlassIconButton>Test</GlassIconButton>);
    const button = screen.getByRole("button");

    expect(button.className).toContain("appearance-none");
    expect(button.className).toContain("-webkit-appearance-none");
  });
});
