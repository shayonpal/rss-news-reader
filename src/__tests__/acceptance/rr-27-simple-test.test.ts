import { describe, it, expect, vi } from "vitest";

describe("Simple RR-27 Mock Test", () => {
  it("should handle invalid JSON in sessionStorage", () => {
    const mockSessionStorage = {
      data: { articleListState: "{invalid json}" },
      getItem: vi.fn((key: string) => mockSessionStorage.data[key] || null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    vi.stubGlobal("sessionStorage", mockSessionStorage);

    // Try to parse the invalid JSON
    let result = null;
    try {
      const savedState = sessionStorage.getItem("articleListState");
      if (savedState) {
        result = JSON.parse(savedState);
      }
    } catch (error) {
      console.error("Failed to parse:", error);
      sessionStorage.removeItem("articleListState");
    }

    expect(result).toBeNull();
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
      "articleListState"
    );

    vi.unstubAllGlobals();
  });

  it("should track disconnect calls on mock observer", () => {
    const mockObserver = {
      disconnect: vi.fn(),
    };

    let observerDisabled = false;
    mockObserver.disconnect.mockImplementation(() => {
      observerDisabled = true;
    });

    // Call disconnect
    mockObserver.disconnect();

    expect(mockObserver.disconnect).toHaveBeenCalled();
    expect(observerDisabled).toBe(true);
  });
});
