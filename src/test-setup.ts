import "@testing-library/jest-dom";
import "fake-indexeddb/auto";
import { vi, beforeEach } from "vitest";

// Set test environment
process.env.NODE_ENV = "test";

// Ensure global objects exist in test environment
if (typeof global.navigator === "undefined") {
  global.navigator = {} as Navigator;
}

if (typeof global.window === "undefined") {
  global.window = {} as Window & typeof globalThis;
}

// Mock navigator.onLine
Object.defineProperty(global.navigator, "onLine", {
  writable: true,
  value: true,
  configurable: true
});

// Mock window.location.reload to prevent JSdom navigation errors
// We'll use a global beforeEach to override this for specific tests
(global as any).__originalReload = typeof window !== "undefined" && window.location ? window.location.reload : undefined;

// Mock fetch globally
global.fetch = vi.fn();

// Mock IntersectionObserver which is not available in jsdom
global.IntersectionObserver = vi.fn().mockImplementation((callback, options) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  
  // Reset navigator.onLine to true for each test
  if (global.navigator && "onLine" in global.navigator) {
    (global.navigator as any).onLine = true;
  }
});
