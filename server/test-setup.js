// Mock environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.INOREADER_CLIENT_ID = 'test-client-id';
process.env.INOREADER_CLIENT_SECRET = 'test-client-secret';
process.env.TOKEN_ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// Clear all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after tests
afterAll(() => {
  vi.restoreAllMocks();
});
EOF < /dev/null