import { vi } from 'vitest';

/**
 * Supabase Mock Helper
 * 
 * Provides consistent Supabase client mocking with proper method chaining support.
 * This solves the "mockSupabase.from(...).update(...).eq is not a function" errors.
 * 
 * Issue: RR-186
 */

export interface MockSupabaseQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  like: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  contains: ReturnType<typeof vi.fn>;
  containedBy: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  throwOnError: ReturnType<typeof vi.fn>;
}

export function createMockSupabaseClient(defaultResponse = { data: [], error: null }) {
  const createQueryBuilder = (): MockSupabaseQueryBuilder => {
    const builder: any = {
      select: vi.fn(() => Promise.resolve(defaultResponse)),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      like: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      is: vi.fn(() => builder),
      in: vi.fn(() => builder),
      contains: vi.fn(() => builder),
      containedBy: vi.fn(() => builder),
      range: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(defaultResponse)),
      maybeSingle: vi.fn(() => Promise.resolve(defaultResponse)),
      throwOnError: vi.fn(() => builder),
    };
    
    // Make select return a promise but also chainable
    builder.select = vi.fn((columns?: string) => {
      const selectBuilder = { ...builder };
      // Add then/catch to make it promise-like
      selectBuilder.then = (onFulfilled: any) => {
        return Promise.resolve(defaultResponse).then(onFulfilled);
      };
      selectBuilder.catch = (onRejected: any) => {
        return Promise.resolve(defaultResponse).catch(onRejected);
      };
      return selectBuilder;
    });
    
    return builder;
  };

  const mockClient = {
    from: vi.fn((table: string) => createQueryBuilder()),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ 
        data: { user: { id: 'test-user-id' } }, 
        error: null 
      })),
      getSession: vi.fn(() => Promise.resolve({ 
        data: { session: null }, 
        error: null 
      })),
      signIn: vi.fn(() => Promise.resolve({ data: null, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
    storage: {
      from: vi.fn((bucket: string) => ({
        upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
        download: vi.fn(() => Promise.resolve({ data: null, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/file' } })),
        remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
        list: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    },
    realtime: {
      channel: vi.fn(() => ({
        on: vi.fn(() => ({ subscribe: vi.fn() })),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      })),
    },
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };

  return mockClient;
}

/**
 * Helper to create a mock Supabase response
 */
export function createMockResponse<T>(data: T | null, error: any = null) {
  return { data, error };
}

/**
 * Helper to mock specific table responses
 */
export function mockTableResponse(mockClient: any, table: string, response: any) {
  const queryBuilder = createMockSupabaseClient(response).from(table);
  mockClient.from.mockImplementation((t: string) => {
    if (t === table) {
      return queryBuilder;
    }
    return createMockSupabaseClient().from(t);
  });
}