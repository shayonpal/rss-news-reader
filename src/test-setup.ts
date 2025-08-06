import { vi } from 'vitest'

// Mock environment
process.env.NODE_ENV = 'test';

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

Object.defineProperty(window, 'localStorage', { value: createStorage() })
Object.defineProperty(window, 'sessionStorage', { value: createStorage() })

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}