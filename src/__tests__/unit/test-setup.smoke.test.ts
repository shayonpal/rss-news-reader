import { describe, it, expect } from 'vitest';

/**
 * Test Environment Smoke Test
 * 
 * This test runs first to validate that the test environment is properly configured.
 * If these tests fail, it indicates environment setup issues rather than application bugs.
 * 
 * Issue: RR-186
 */
describe('Test Environment Smoke Test', () => {
  it('should have IndexedDB available', () => {
    expect(global.indexedDB).toBeDefined();
    expect(global.IDBKeyRange).toBeDefined();
    expect(global.IDBDatabase).toBeDefined();
    expect(global.IDBTransaction).toBeDefined();
    expect(global.IDBObjectStore).toBeDefined();
  });

  it('should have localStorage available', () => {
    expect(window.localStorage).toBeDefined();
    expect(window.localStorage.clear).toBeDefined();
    expect(typeof window.localStorage.clear).toBe('function');
    expect(typeof window.localStorage.getItem).toBe('function');
    expect(typeof window.localStorage.setItem).toBe('function');
    expect(typeof window.localStorage.removeItem).toBe('function');
  });

  it('should have sessionStorage available', () => {
    expect(window.sessionStorage).toBeDefined();
    expect(window.sessionStorage.clear).toBeDefined();
    expect(typeof window.sessionStorage.clear).toBe('function');
    expect(typeof window.sessionStorage.getItem).toBe('function');
    expect(typeof window.sessionStorage.setItem).toBe('function');
    expect(typeof window.sessionStorage.removeItem).toBe('function');
  });

  it('should have fetch available', () => {
    expect(global.fetch).toBeDefined();
    expect(typeof global.fetch).toBe('function');
  });

  it('should have IntersectionObserver available', () => {
    expect(global.IntersectionObserver).toBeDefined();
  });

  it('should have ResizeObserver available', () => {
    expect(global.ResizeObserver).toBeDefined();
  });

  it('should have matchMedia available', () => {
    expect(window.matchMedia).toBeDefined();
    expect(typeof window.matchMedia).toBe('function');
  });

  it('should be able to use storage APIs', () => {
    // Test localStorage
    window.localStorage.setItem('test-key', 'test-value');
    expect(window.localStorage.getItem('test-key')).toBe('test-value');
    window.localStorage.removeItem('test-key');
    expect(window.localStorage.getItem('test-key')).toBeNull();
    
    // Test sessionStorage
    window.sessionStorage.setItem('test-key', 'test-value');
    expect(window.sessionStorage.getItem('test-key')).toBe('test-value');
    window.sessionStorage.removeItem('test-key');
    expect(window.sessionStorage.getItem('test-key')).toBeNull();
  });

  it('should be able to clear storage', () => {
    window.localStorage.setItem('key1', 'value1');
    window.localStorage.setItem('key2', 'value2');
    window.localStorage.clear();
    expect(window.localStorage.getItem('key1')).toBeNull();
    expect(window.localStorage.getItem('key2')).toBeNull();
    
    window.sessionStorage.setItem('key1', 'value1');
    window.sessionStorage.setItem('key2', 'value2');
    window.sessionStorage.clear();
    expect(window.sessionStorage.getItem('key1')).toBeNull();
    expect(window.sessionStorage.getItem('key2')).toBeNull();
  });
});