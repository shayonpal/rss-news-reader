import { vi } from "vitest";

/**
 * Mock window.location.reload to prevent JSdom navigation errors
 * Call this in beforeEach hooks of tests that trigger reload
 */
export function mockWindowReload() {
  if (typeof window !== "undefined" && window.location) {
    // Store the original if not already stored
    if (!(window as any).__originalReload) {
      (window as any).__originalReload = window.location.reload;
    }
    
    // Override with mock
    window.location.reload = vi.fn();
  }
}

/**
 * Restore window.location.reload to original
 * Call this in afterEach hooks
 */
export function restoreWindowReload() {
  if (typeof window !== "undefined" && window.location && (window as any).__originalReload) {
    window.location.reload = (window as any).__originalReload;
  }
}

/**
 * Mock environment for consistent test environment
 */
export function mockEnvironment(env: Partial<typeof process.env> = {}) {
  const originalEnv = { ...process.env };
  
  Object.assign(process.env, {
    NODE_ENV: "test",
    ...env
  });
  
  return () => {
    process.env = originalEnv;
  };
}

/**
 * Create mock fetch response
 */
export function createMockFetchResponse(data: any, options: Partial<Response> = {}) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    blob: vi.fn().mockResolvedValue(new Blob([JSON.stringify(data)])),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    headers: new Headers({ "Content-Type": "application/json" }),
    ...options
  });
}

/**
 * Create mock error response
 */
export function createMockErrorResponse(status: number, message: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: message,
    json: vi.fn().mockResolvedValue({ error: message }),
    text: vi.fn().mockResolvedValue(message),
    headers: new Headers({ "Content-Type": "application/json" })
  });
}