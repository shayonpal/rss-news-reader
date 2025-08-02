import "@testing-library/jest-dom";
import "fake-indexeddb/auto";

// Mock navigator.onLine
Object.defineProperty(navigator, "onLine", {
  writable: true,
  value: true,
});

// DO NOT mock fetch for integration tests - we need real HTTP requests!
// global.fetch = vi.fn();

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});