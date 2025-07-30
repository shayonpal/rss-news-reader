import "@testing-library/jest-dom";
import "fake-indexeddb/auto";

// Mock navigator.onLine
Object.defineProperty(navigator, "onLine", {
  writable: true,
  value: true,
});

// Mock fetch globally
global.fetch = vi.fn();

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
