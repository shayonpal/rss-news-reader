import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// Create a mock Supabase instance
const createMockSupabase = () => {
  const mockSupabase = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    ilike: vi.fn(),
    gt: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    insert: vi.fn(),
  };
  
  // Chain methods return themselves
  const methods = ['from', 'select', 'eq', 'single', 'ilike', 'gt', 'order', 'range', 'insert'];
  methods.forEach(method => {
    (mockSupabase as any)[method].mockReturnValue(mockSupabase);
  });
  
  return mockSupabase;
};

const mockSupabase = createMockSupabase();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe('Tags API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/tags', () => {
    it('should return tags for authenticated user', async () => {
      // Mock user lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'user-id' },
        error: null,
      });

      // Mock tags query
      mockSupabase.order.mockResolvedValueOnce({
        data: [
          {
            id: 'tag1',
            name: 'Gaming',
            slug: 'gaming',
            color: null,
            description: null,
            article_count: 1,
            user_id: 'user-id',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        ],
        error: null,
        count: 1,
      });

      const request = new NextRequest('http://localhost:3000/api/tags');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toHaveLength(1);
      expect(data.tags[0].name).toBe('Gaming');
    });

    it('should filter by search query', async () => {
      // Mock user lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'user-id' },
        error: null,
      });

      // Mock tags query
      mockSupabase.order.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      const request = new NextRequest('http://localhost:3000/api/tags?search=gaming');
      await GET(request);

      expect(mockSupabase.ilike).toHaveBeenCalledWith('name', '%gaming%');
    });

    it('should exclude empty tags by default', async () => {
      // Mock user lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'user-id' },
        error: null,
      });

      // Mock tags query
      mockSupabase.order.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      const request = new NextRequest('http://localhost:3000/api/tags');
      await GET(request);

      expect(mockSupabase.gt).toHaveBeenCalledWith('article_count', 0);
    });

    it('should include empty tags when requested', async () => {
      // Mock user lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'user-id' },
        error: null,
      });

      // Mock tags query
      mockSupabase.order.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      const request = new NextRequest('http://localhost:3000/api/tags?includeEmpty=true');
      await GET(request);

      expect(mockSupabase.gt).not.toHaveBeenCalled();
    });

    it('should return 404 when user not found', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: new Error('User not found'),
      });

      const request = new NextRequest('http://localhost:3000/api/tags');
      const response = await GET(request);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/tags', () => {
    it('should create a new tag', async () => {
      // Mock user lookup
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'user-id' },
          error: null,
        })
        // Mock existing tag check
        .mockResolvedValueOnce({
          data: null,
          error: null,
        });

      // Mock tag creation
      mockSupabase.select.mockReturnValueOnce(mockSupabase);
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'new-tag-id',
          name: 'New Tag',
          slug: 'new-tag',
          color: null,
          description: null,
          user_id: 'user-id',
          article_count: 0,
        },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Tag' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('New Tag');
      expect(data.slug).toBe('new-tag');
    });

    it('should return 400 for empty tag name', async () => {
      const request = new NextRequest('http://localhost:3000/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 409 for duplicate tag', async () => {
      // Mock user lookup
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'user-id' },
          error: null,
        })
        // Mock existing tag check - found
        .mockResolvedValueOnce({
          data: { id: 'existing-tag-id' },
          error: null,
        });

      const request = new NextRequest('http://localhost:3000/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Existing Tag' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(409);
    });

    it('should handle user not found in POST', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: new Error('User not found'),
      });

      const request = new NextRequest('http://localhost:3000/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Tag' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(404);
    });
  });
});