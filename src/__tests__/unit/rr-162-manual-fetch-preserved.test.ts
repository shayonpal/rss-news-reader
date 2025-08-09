/**
 * Unit Tests for RR-162: Manual Fetch Preservation
 * 
 * These tests verify that manual content fetching remains fully functional
 * after auto-fetch removal. Manual fetch is critical for user-initiated
 * content extraction.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  FetchContentResponse,
  TestDataGenerators,
} from '../contracts/rr-162-remove-autofetch.contract';

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('@mozilla/readability', () => ({
  Readability: vi.fn().mockImplementation(() => ({
    parse: vi.fn(() => ({
      title: 'Parsed Article Title',
      content: '<p>Full parsed content from Readability</p>',
      textContent: 'Full parsed content from Readability',
      length: 1000,
      excerpt: 'Article excerpt',
    })),
  })),
}));

vi.mock('jsdom', () => ({
  JSDOM: vi.fn().mockImplementation((html) => ({
    window: {
      document: {
        documentElement: {
          innerHTML: html,
        },
      },
    },
  })),
}));

vi.mock('@/lib/api/log-api-call', () => ({
  logInoreaderApiCall: vi.fn(),
}));

vi.mock('@/lib/services/content-parsing-service', () => ({
  ContentParsingService: {
    extractContent: vi.fn(async (url: string) => ({
      success: true,
      content: '<p>Extracted content</p>',
      title: 'Extracted Title',
      error: null,
    })),
  },
}));

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  single: vi.fn(() => Promise.resolve({ data: null, error: null })),
};

// Mock Next.js
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: ResponseInit) => ({
      body,
      status: init?.status || 200,
      headers: init?.headers || {},
      ok: (init?.status || 200) < 400,
    }),
  },
  NextRequest: class {
    constructor(public url: string, public init?: RequestInit) {}
    json() { return Promise.resolve(this.init?.body || {}); }
  },
}));

describe('RR-162: Manual Fetch Preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Contract: Manual Fetch Endpoint Functionality', () => {
    it('should successfully fetch and parse content for an article', async () => {
      const testArticle = TestDataGenerators.createTestArticle();
      
      // Mock article exists in database
      mockSupabase.single.mockResolvedValueOnce({
        data: testArticle,
        error: null,
      });

      // Mock successful content fetch
      mockSupabase.update.mockReturnValueOnce({
        ...mockSupabase,
        eq: () => ({
          single: () => Promise.resolve({
            data: {
              ...testArticle,
              has_full_content: true,
              parsed_at: new Date().toISOString(),
              content: '<p>Full parsed content from Readability</p>',
            },
            error: null,
          }),
        }),
      });

      // Mock fetch log insertion
      mockSupabase.insert.mockResolvedValueOnce({
        data: {
          id: 'log-123',
          article_id: testArticle.id,
          fetch_type: 'manual',
          status: 'success',
          duration_ms: 500,
        },
        error: null,
      });

      // Import and test the route
      const { POST } = await import(
        '@/app/api/articles/[id]/fetch-content/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/articles/${testArticle.id}/fetch-content`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: { id: testArticle.id } });

      // Verify response
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('successfully'),
      });

      // Verify fetch log was created with type 'manual'
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          fetch_type: 'manual',
          status: 'success',
        })
      );

      // Verify article was updated
      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it('should handle article not found error', async () => {
      // Mock article not found
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Article not found' },
      });

      // Try with inoreader_id as well
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Article not found' },
      });

      const { POST } = await import(
        '@/app/api/articles/[id]/fetch-content/route'
      );

      const request = new NextRequest(
        'http://localhost:3000/api/articles/non-existent/fetch-content',
        { method: 'POST' }
      );

      const response = await POST(request, { params: { id: 'non-existent' } });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        error: 'article_not_found',
        message: expect.stringContaining('not found'),
      });
    });

    it('should handle rate limiting for concurrent requests', async () => {
      const { POST } = await import(
        '@/app/api/articles/[id]/fetch-content/route'
      );

      // Create multiple concurrent requests
      const requests = [];
      for (let i = 0; i < 10; i++) {
        const req = new NextRequest(
          `http://localhost:3000/api/articles/article-${i}/fetch-content`,
          { method: 'POST' }
        );
        requests.push(POST(req, { params: { id: `article-${i}` } }));
      }

      const responses = await Promise.all(requests);

      // Some requests should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);

      // Rate limited responses should have proper error
      rateLimited.forEach(response => {
        expect(response.body).toMatchObject({
          error: 'rate_limit',
          message: expect.stringContaining('concurrent'),
        });
      });
    });

    it('should log fetch attempts correctly', async () => {
      const { logInoreaderApiCall } = await import('@/lib/api/log-api-call');
      const testArticle = TestDataGenerators.createTestArticle();

      mockSupabase.single.mockResolvedValueOnce({
        data: testArticle,
        error: null,
      });

      const { POST } = await import(
        '@/app/api/articles/[id]/fetch-content/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/articles/${testArticle.id}/fetch-content`,
        { method: 'POST' }
      );

      await POST(request, { params: { id: testArticle.id } });

      // Verify API call was logged
      expect(logInoreaderApiCall).toHaveBeenCalledWith(
        expect.stringContaining(testArticle.id),
        'manual-fetch',
        'POST'
      );
    });
  });

  describe('Contract: Fetch Log Entry Creation', () => {
    it('should create fetch_logs entry with type "manual" on success', async () => {
      const testArticle = TestDataGenerators.createTestArticle();
      
      mockSupabase.single.mockResolvedValueOnce({
        data: testArticle,
        error: null,
      });

      // Track insert calls
      const insertCalls: any[] = [];
      mockSupabase.insert.mockImplementation((data) => {
        insertCalls.push(data);
        return Promise.resolve({ data, error: null });
      });

      const { POST } = await import(
        '@/app/api/articles/[id]/fetch-content/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/articles/${testArticle.id}/fetch-content`,
        { method: 'POST' }
      );

      await POST(request, { params: { id: testArticle.id } });

      // Find fetch_logs insert
      const fetchLogInsert = insertCalls.find(
        call => call.article_id === testArticle.id
      );

      expect(fetchLogInsert).toBeDefined();
      expect(fetchLogInsert).toMatchObject({
        article_id: testArticle.id,
        fetch_type: 'manual',
        status: expect.stringMatching(/success|failure/),
        duration_ms: expect.any(Number),
      });

      // Should NEVER be 'auto'
      expect(fetchLogInsert.fetch_type).not.toBe('auto');
    });

    it('should create fetch_logs entry with type "manual" on failure', async () => {
      const testArticle = TestDataGenerators.createTestArticle();
      
      mockSupabase.single.mockResolvedValueOnce({
        data: testArticle,
        error: null,
      });

      // Mock content extraction failure
      const { ContentParsingService } = await import(
        '@/lib/services/content-parsing-service'
      );
      vi.mocked(ContentParsingService.extractContent).mockResolvedValueOnce({
        success: false,
        content: null,
        title: null,
        error: 'Failed to extract content',
      });

      const insertCalls: any[] = [];
      mockSupabase.insert.mockImplementation((data) => {
        insertCalls.push(data);
        return Promise.resolve({ data, error: null });
      });

      const { POST } = await import(
        '@/app/api/articles/[id]/fetch-content/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/articles/${testArticle.id}/fetch-content`,
        { method: 'POST' }
      );

      await POST(request, { params: { id: testArticle.id } });

      const fetchLogInsert = insertCalls.find(
        call => call.article_id === testArticle.id
      );

      expect(fetchLogInsert).toMatchObject({
        fetch_type: 'manual',
        status: 'failure',
        error_message: expect.any(String),
      });
    });
  });

  describe('Contract: Content Extraction Pipeline', () => {
    it('should use Readability for content parsing', async () => {
      const { Readability } = await import('@mozilla/readability');
      const testArticle = TestDataGenerators.createTestArticle();

      mockSupabase.single.mockResolvedValueOnce({
        data: testArticle,
        error: null,
      });

      // Mock HTML fetch
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('<html><body>Article content</body></html>'),
        } as Response)
      );

      const { POST } = await import(
        '@/app/api/articles/[id]/fetch-content/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/articles/${testArticle.id}/fetch-content`,
        { method: 'POST' }
      );

      await POST(request, { params: { id: testArticle.id } });

      // Verify Readability was used
      expect(Readability).toHaveBeenCalled();
    });

    it('should update article with parsed content', async () => {
      const testArticle = TestDataGenerators.createTestArticle();
      
      mockSupabase.single.mockResolvedValueOnce({
        data: testArticle,
        error: null,
      });

      let updateData: any = null;
      mockSupabase.update.mockImplementation((data) => {
        updateData = data;
        return {
          ...mockSupabase,
          eq: () => ({
            single: () => Promise.resolve({
              data: { ...testArticle, ...data },
              error: null,
            }),
          }),
        };
      });

      const { POST } = await import(
        '@/app/api/articles/[id]/fetch-content/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/articles/${testArticle.id}/fetch-content`,
        { method: 'POST' }
      );

      await POST(request, { params: { id: testArticle.id } });

      // Verify article update
      expect(updateData).toMatchObject({
        has_full_content: true,
        parsed_at: expect.any(String),
        content: expect.any(String),
      });
    });
  });

  describe('Contract: Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const testArticle = TestDataGenerators.createTestArticle();
      
      mockSupabase.single.mockResolvedValueOnce({
        data: testArticle,
        error: null,
      });

      // Mock network error
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network error'))
      );

      const { POST } = await import(
        '@/app/api/articles/[id]/fetch-content/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/articles/${testArticle.id}/fetch-content`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: { id: testArticle.id } });

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('error'),
      });
    });

    it('should handle parsing errors gracefully', async () => {
      const testArticle = TestDataGenerators.createTestArticle();
      
      mockSupabase.single.mockResolvedValueOnce({
        data: testArticle,
        error: null,
      });

      // Mock Readability parse failure
      const { Readability } = await import('@mozilla/readability');
      vi.mocked(Readability).mockImplementationOnce(() => ({
        parse: () => null,
      } as any));

      const { POST } = await import(
        '@/app/api/articles/[id]/fetch-content/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/articles/${testArticle.id}/fetch-content`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: { id: testArticle.id } });

      // Should handle parse failure
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Contract: No Auto-Fetch References', () => {
    it('should not contain any auto-fetch code or comments', async () => {
      // This test would check the actual file in a real scenario
      // For unit tests, we verify the behavior doesn't trigger auto-fetch

      const testArticle = TestDataGenerators.createTestArticle();
      
      mockSupabase.single.mockResolvedValueOnce({
        data: testArticle,
        error: null,
      });

      // Track all database operations
      const dbOperations: string[] = [];
      mockSupabase.from.mockImplementation((table: string) => {
        dbOperations.push(table);
        return mockSupabase;
      });

      const { POST } = await import(
        '@/app/api/articles/[id]/fetch-content/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/articles/${testArticle.id}/fetch-content`,
        { method: 'POST' }
      );

      await POST(request, { params: { id: testArticle.id } });

      // Should only interact with articles and fetch_logs tables
      expect(dbOperations).toContain('articles');
      expect(dbOperations).toContain('fetch_logs');
      
      // Should NOT interact with any auto-fetch related tables/configs
      expect(dbOperations).not.toContain('auto_fetch_config');
      expect(dbOperations).not.toContain('auto_fetch_queue');
    });
  });
});