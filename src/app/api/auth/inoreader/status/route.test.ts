/**
 * Unit Tests for RR-117: Auth Status Endpoint Implementation
 * 
 * Test suite for the new /api/auth/inoreader/status endpoint that provides
 * OAuth authentication status information for monitoring and client use.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { GET } from './route';

// Mock fs module
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

// Mock environment variables
const mockEnv = {
  HOME: '/Users/shayon',
  TOKEN_ENCRYPTION_KEY: 'test-key-32-chars-long-for-aes256',
};

describe('RR-117: Auth Status Endpoint Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset environment variables
    Object.keys(mockEnv).forEach(key => {
      process.env[key] = mockEnv[key as keyof typeof mockEnv];
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Token File Existence Checks', () => {
    it('should return authenticated: false when token file does not exist', async () => {
      // Arrange
      mockFs.access.mockRejectedValue(new Error('ENOENT: no such file or directory'));
      
      const request = new NextRequest('http://localhost:3000/api/auth/inoreader/status');
      
      // Act
      const response = await GET(request);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data).toEqual({
        authenticated: false,
        status: 'no_tokens',
        message: 'OAuth token file not found',
        timestamp: expect.any(String),
        tokenAge: null,
        daysRemaining: null
      });
    });

    it('should handle file system errors gracefully', async () => {
      // Arrange
      mockFs.access.mockRejectedValue(new Error('Permission denied'));
      
      const request = new NextRequest('http://localhost:3000/api/auth/inoreader/status');
      
      // Act
      const response = await GET(request);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data).toEqual({
        authenticated: false,
        status: 'error',
        message: 'Unable to check token file: Permission denied',
        timestamp: expect.any(String),
        tokenAge: null,
        daysRemaining: null
      });
    });
  });

  describe('Token File Content Validation', () => {
    beforeEach(() => {
      // Token file exists
      mockFs.access.mockResolvedValue(undefined);
    });

    it('should return authenticated: false for invalid JSON in token file', async () => {
      // Arrange
      mockFs.readFile.mockResolvedValue('invalid json content' as any);
      
      const request = new NextRequest('http://localhost:3000/api/auth/inoreader/status');
      
      // Act
      const response = await GET(request);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data).toEqual({
        authenticated: false,
        status: 'invalid_format',
        message: 'Token file contains invalid JSON',
        timestamp: expect.any(String),
        tokenAge: null,
        daysRemaining: null
      });
    });

    it('should return authenticated: false for unencrypted tokens', async () => {
      // Arrange
      const unencryptedTokens = JSON.stringify({
        access_token: 'plain-text-token',
        refresh_token: 'plain-text-refresh'
      });
      mockFs.readFile.mockResolvedValue(unencryptedTokens as any);
      
      const request = new NextRequest('http://localhost:3000/api/auth/inoreader/status');
      
      // Act
      const response = await GET(request);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data).toEqual({
        authenticated: false,
        status: 'unencrypted',
        message: 'OAuth tokens are not properly encrypted',
        timestamp: expect.any(String),
        tokenAge: null,
        daysRemaining: null
      });
    });

    it('should return authenticated: false for empty encrypted field', async () => {
      // Arrange
      const tokensWithEmptyEncrypted = JSON.stringify({
        encrypted: ''
      });
      mockFs.readFile.mockResolvedValue(tokensWithEmptyEncrypted as any);
      
      const request = new NextRequest('http://localhost:3000/api/auth/inoreader/status');
      
      // Act
      const response = await GET(request);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data).toEqual({
        authenticated: false,
        status: 'empty_tokens',
        message: 'OAuth tokens are empty or missing',
        timestamp: expect.any(String),
        tokenAge: null,
        daysRemaining: null
      });
    });
  });

  describe('Token Age Calculation', () => {
    beforeEach(() => {
      mockFs.access.mockResolvedValue(undefined);
      
      const validEncryptedTokens = JSON.stringify({
        encrypted: 'encrypted-token-data-here'
      });
      mockFs.readFile.mockResolvedValue(validEncryptedTokens as any);
    });

    it('should calculate token age correctly for recent tokens', async () => {
      // Arrange
      const recentTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      mockFs.stat.mockResolvedValue({
        mtime: recentTime
      } as any);
      
      const request = new NextRequest('http://localhost:3000/api/auth/inoreader/status');
      
      // Act
      const response = await GET(request);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(true);
      expect(data.status).toBe('valid');
      expect(data.tokenAge).toBe(30);
      expect(data.daysRemaining).toBe(335); // 365 - 30
      expect(data.message).toContain('335 days remaining');
    });

    it('should return degraded status for tokens expiring soon (< 30 days)', async () => {
      // Arrange
      const oldTime = new Date(Date.now() - 340 * 24 * 60 * 60 * 1000); // 340 days ago
      mockFs.stat.mockResolvedValue({
        mtime: oldTime
      } as any);
      
      const request = new NextRequest('http://localhost:3000/api/auth/inoreader/status');
      
      // Act
      const response = await GET(request);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(true);
      expect(data.status).toBe('expiring_soon');
      expect(data.tokenAge).toBe(340);
      expect(data.daysRemaining).toBe(25); // 365 - 340
      expect(data.message).toContain('expiring soon');
      expect(data.message).toContain('25 days');
    });

    it('should return expired status for tokens older than 365 days', async () => {
      // Arrange
      const expiredTime = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000); // 400 days ago
      mockFs.stat.mockResolvedValue({
        mtime: expiredTime
      } as any);
      
      const request = new NextRequest('http://localhost:3000/api/auth/inoreader/status');
      
      // Act
      const response = await GET(request);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(false);
      expect(data.status).toBe('expired');
      expect(data.tokenAge).toBe(400);
      expect(data.daysRemaining).toBe(0);
      expect(data.message).toContain('OAuth tokens have expired');
    });
  });

  describe('Response Format Consistency', () => {
    it('should always return consistent response structure', async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);
      const validTokens = JSON.stringify({ encrypted: 'valid-data' });
      mockFs.readFile.mockResolvedValue(validTokens as any);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
      } as any);
      
      const request = new NextRequest('http://localhost:3000/api/auth/inoreader/status');
      
      // Act
      const response = await GET(request);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data).toEqual({
        authenticated: expect.any(Boolean),
        status: expect.any(String),
        message: expect.any(String),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        tokenAge: expect.any(Number),
        daysRemaining: expect.any(Number)
      });
    });

    it('should include proper Content-Type header', async () => {
      // Arrange
      mockFs.access.mockRejectedValue(new Error('File not found'));
      
      const request = new NextRequest('http://localhost:3000/api/auth/inoreader/status');
      
      // Act
      const response = await GET(request);
      
      // Assert
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should handle missing environment variables gracefully', async () => {
      // Arrange
      delete process.env.HOME;
      delete process.env.TOKEN_ENCRYPTION_KEY;
      
      const request = new NextRequest('http://localhost:3000/api/auth/inoreader/status');
      
      // Act
      const response = await GET(request);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(false);
      expect(data.status).toBe('config_error');
      expect(data.message).toContain('configuration');
    });
  });

  describe('Security Considerations', () => {
    it('should never expose actual token values in response', async () => {
      // Arrange
      const tokensWithPlainText = JSON.stringify({
        access_token: 'secret-access-token',
        refresh_token: 'secret-refresh-token',
        encrypted: 'encrypted-data'
      });
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(tokensWithPlainText as any);
      mockFs.stat.mockResolvedValue({
        mtime: new Date()
      } as any);
      
      const request = new NextRequest('http://localhost:3000/api/auth/inoreader/status');
      
      // Act
      const response = await GET(request);
      const responseText = await response.text();
      
      // Assert
      expect(responseText).not.toContain('secret-access-token');
      expect(responseText).not.toContain('secret-refresh-token');
      expect(responseText).not.toContain('encrypted-data');
    });

    it('should not expose file system paths in error messages', async () => {
      // Arrange
      mockFs.access.mockRejectedValue(new Error('ENOENT: no such file or directory, open \'/Users/shayon/.rss-reader/tokens.json\''));
      
      const request = new NextRequest('http://localhost:3000/api/auth/inoreader/status');
      
      // Act
      const response = await GET(request);
      const data = await response.json();
      
      // Assert
      expect(data.message).not.toContain('/Users/shayon');
      expect(data.message).not.toContain('.rss-reader');
      expect(data.message).not.toContain('tokens.json');
    });
  });

  describe('Caching and Performance', () => {
    it('should complete within reasonable time limit', async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({ encrypted: 'data' }) as any);
      mockFs.stat.mockResolvedValue({ mtime: new Date() } as any);
      
      const request = new NextRequest('http://localhost:3000/api/auth/inoreader/status');
      
      // Act
      const start = Date.now();
      await GET(request);
      const duration = Date.now() - start;
      
      // Assert
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent requests without race conditions', async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({ encrypted: 'data' }) as any);
      mockFs.stat.mockResolvedValue({ mtime: new Date() } as any);
      
      const request = new NextRequest('http://localhost:3000/api/auth/inoreader/status');
      
      // Act
      const promises = Array(5).fill(null).map(() => GET(request));
      const responses = await Promise.all(promises);
      
      // Assert
      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});