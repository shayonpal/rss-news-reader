import 'fake-indexeddb/auto';
import { vi, expect, beforeEach, afterEach, afterAll } from 'vitest'

// Mock environment - ensure NODE_ENV is set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// RR-183: Global test cleanup hooks for resource management
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset fetch mock
  if (global.fetch) {
    (global.fetch as any).mockClear();
  }
  
  // Clear storage mocks
  if (window.localStorage) {
    window.localStorage.clear();
  }
  if (window.sessionStorage) {
    window.sessionStorage.clear();
  }
});

afterEach(() => {
  // Restore all mocks after each test
  vi.restoreAllMocks();
  
  // Clear any pending timers
  vi.clearAllTimers();
});

// Global cleanup after all tests
afterAll(() => {
  // Final cleanup of any resources
  vi.resetAllMocks();
});

// Mock fetch globally
global.fetch = vi.fn()

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: ''
  },
  writable: true
})

// Mock localStorage and sessionStorage
const createStorage = () => {
  const storage = new Map()
  return {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    get length() { return storage.size },
    key: (index: number) => Array.from(storage.keys())[index] || null
  }
}

// Only define if not already present
if (!window.localStorage) {
  Object.defineProperty(window, 'localStorage', { 
    value: createStorage(),
    writable: true,
    configurable: true
  })
}
if (!window.sessionStorage) {
  Object.defineProperty(window, 'sessionStorage', { 
    value: createStorage(),
    writable: true,
    configurable: true
  })
}

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root = null
  rootMargin = '0px'
  thresholds = [0]
  
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() { return [] }
} as any

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Extend Vitest expect with custom matchers
expect.extend({
  /**
   * Custom matcher to check if a value is one of several possible values
   * @param received - The value to test
   * @param expected - Array of possible values
   * @returns AssertionResult
   */
  toBeOneOf(received: any, expected: any[]) {
    if (!Array.isArray(expected)) {
      throw new Error('Expected value must be an array')
    }
    
    const pass = expected.includes(received)
    
    if (pass) {
      return {
        message: () => `expected ${this.utils.printReceived(received)} not to be one of ${this.utils.printExpected(expected)}`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${this.utils.printReceived(received)} to be one of ${this.utils.printExpected(expected)}`,
        pass: false,
      }
    }
  },
})