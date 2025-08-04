// Integration test setup - uses real fetch, not mocks
// Node 18+ has native fetch support

// Set test environment flag
process.env.IS_TEST_ENVIRONMENT = 'true';

// Ensure we're not using mocked fetch from unit tests
if ('vi' in global && (global as any).vi && (global as any).fetch?.mock) {
  delete (global as any).fetch;
}