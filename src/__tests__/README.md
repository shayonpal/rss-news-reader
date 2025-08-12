# Test Directory Structure

This directory contains all tests for the RSS News Reader application. Tests are organized by type to ensure proper isolation and environment configuration.

## Directory Structure

```
src/__tests__/
├── unit/           # Unit tests (components, utilities, hooks)
├── integration/    # Integration tests (API endpoints, database operations)
├── e2e/           # End-to-end tests (full user workflows)
├── scripts/       # Tests for build scripts and tooling
├── acceptance/    # Acceptance criteria validation tests
├── test-configuration/  # Tests for test infrastructure itself
└── README.md      # This file
```

## Test Environment Configuration

### Unit Tests (Default)

- **Environment**: `jsdom` (browser-like environment)
- **Config**: `vitest.config.ts`
- **Setup**: `src/test-setup.ts`
- **Features**:
  - Global fetch is mocked via `vi.fn()`
  - DOM APIs available
  - React component testing
  - Fast execution

### Integration Tests

- **Environment**: `node` (server environment)
- **Config**: `vitest.config.integration.ts`
- **Setup**: `src/test-setup-integration.ts`
- **Features**:
  - Real HTTP requests (fetch NOT mocked)
  - Database operations
  - API endpoint testing
  - External service communication

## Running Tests

```bash
# Run all tests (unit + integration)
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run integration tests safely (stops/starts PM2 services)
npm run test:integration:safe

# Watch mode for development
npm run test:watch

# Run specific test file
npm test -- path/to/test.test.ts
```

## Key Differences

| Feature       | Unit Tests | Integration Tests      |
| ------------- | ---------- | ---------------------- |
| Environment   | jsdom      | node                   |
| Fetch API     | Mocked     | Real                   |
| Database      | Mocked     | Real (test DB)         |
| External APIs | Mocked     | Real or test endpoints |
| Speed         | Fast       | Slower                 |
| Isolation     | Complete   | Requires services      |

## Writing Tests

### Unit Test Example

```typescript
// src/__tests__/unit/components/ArticleCard.test.tsx
import { render, screen } from '@testing-library/react';
import { ArticleCard } from '@/components/ArticleCard';

test('renders article title', () => {
  render(<ArticleCard title="Test Article" />);
  expect(screen.getByText('Test Article')).toBeInTheDocument();
});
```

### Integration Test Example

```typescript
// src/__tests__/integration/api-health.test.ts
import { describe, it, expect } from "vitest";

describe("Health API", () => {
  it("should return 200 from health endpoint", async () => {
    const response = await fetch("http://localhost:3000/reader/api/health");
    expect(response.status).toBe(200);
  });
});
```

## Best Practices

1. **Test Placement**: Place tests close to the code they test when possible
2. **Naming**: Use descriptive test names that explain what is being tested
3. **Isolation**: Each test should be independent and not rely on others
4. **Mocking**: Mock external dependencies in unit tests, use real services in integration tests
5. **Coverage**: Aim for high coverage but focus on critical paths
6. **Performance**: Keep unit tests fast (<100ms), integration tests can be slower

## Troubleshooting

### Common Issues

1. **"fetch is not defined" in integration tests**
   - Ensure test is in `src/__tests__/integration/` directory
   - Check that `vitest.config.integration.ts` is being used

2. **"Cannot find module" errors**
   - Verify path aliases are configured in both vitest configs
   - Check that TypeScript paths match vitest aliases

3. **Tests timing out**
   - Integration tests may need longer timeouts for API calls
   - Use `test.timeout(10000)` for specific slow tests

4. **Database connection errors**
   - Ensure test database is running
   - Check environment variables are loaded

## Related Documentation

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Project Testing Strategy](../../docs/tech/testing-strategy.md)
