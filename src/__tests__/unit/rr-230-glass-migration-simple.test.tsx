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
  test("GlassToolbarButton defaults to transparent styling", () => {
    render(
      <GlassToolbarButton data-testid="toolbar-btn">Test</GlassToolbarButton>
    );
    const button = screen.getByTestId("toolbar-btn");

    // Key requirement: should be transparent for container glass
    expect(button.className).toContain("bg-transparent");
    expect(button.className).toContain("border-none");
    expect(button.className).toContain("backdrop-blur-none");
  });

  test("GlassIconButton has standalone glass styling", () => {
    render(<GlassIconButton data-testid="icon-btn">Icon</GlassIconButton>);
    const button = screen.getByTestId("icon-btn");

    // Key requirement: should use CSS variables for standalone glass
    expect(button.className).toContain("bg-[var(--glass-nav-bg)]");
    expect(button.className).toContain("backdrop-blur-[var(--glass-blur)]");
    expect(button.className).toContain("border-[var(--glass-nav-border)]");
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
    render(
      <GlassIconButton data-testid="appearance-test">Test</GlassIconButton>
    );
    const button = screen.getByTestId("appearance-test");

    expect(button.className).toContain("appearance-none");
    expect(button.className).toContain("-webkit-appearance-none");
  });
});
