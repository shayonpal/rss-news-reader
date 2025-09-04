# Testing Documentation

Comprehensive testing strategy and guidelines for the RSS News Reader application.

## Quick Reference

```bash
# Fast testing commands
npm test              # Run tests (8-20 seconds)
npm run test:parallel # Parallel execution (8-12s)
npm run test:e2e      # Playwright E2E tests
npm run pre-commit    # All quality checks
```

## Testing Strategy

### Test Types

1. **Unit Tests** (`__tests__/unit/`)
   - Component and utility function testing
   - Mocked dependencies and isolated testing
   - Fast execution (<5 seconds)
   - Coverage: Core business logic, utilities, components

2. **Integration Tests** (`__tests__/integration/`)
   - API endpoint testing
   - Database interactions with test data
   - Service integration verification
   - Coverage: API routes, data flow, service boundaries

3. **End-to-End Tests** (`__tests__/e2e/`)
   - Full user workflow testing with Playwright
   - Cross-browser testing (Chrome, Firefox, Safari, Mobile)
   - Visual regression testing
   - Coverage: Critical user journeys

4. **Performance Tests**
   - Memory leak detection
   - Response time validation
   - Resource usage monitoring
   - Baseline comparison

## Test Environment

### Configuration

- **Test Database**: Isolated test environment
- **Mock Data**: Consistent fixtures for reproducible tests
- **Environment Variables**: Test-specific `.env.test`
- **Browser Testing**: Headless by default, UI mode available

### Requirements

```bash
# Required in .env for testing
INOREADER_TEST_USERNAME=test_user
INOREADER_TEST_PASSWORD=test_pass
SUPABASE_SERVICE_ROLE_KEY=your-test-key
```

## Writing Tests

### Unit Test Example

```typescript
// __tests__/unit/utils/format-date.test.ts
import { formatDate } from '@/lib/utils/format-date'

describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date('2024-01-01')
    expect(formatDate(date)).toBe('Jan 1, 2024')
  })
})
```

### Integration Test Example

```typescript
// __tests__/integration/api/health.test.ts
import { GET } from '@/app/api/health/route'

describe('Health API', () => {
  it('returns healthy status', async () => {
    const response = await GET()
    const data = await response.json()
    expect(data.status).toBe('healthy')
  })
})
```

### E2E Test Example

```typescript
// __tests__/e2e/reader-flow.spec.ts
import { test, expect } from '@playwright/test'

test('user can read articles', async ({ page }) => {
  await page.goto('/reader')
  await expect(page.locator('h1')).toContainText('Your Feeds')
  await page.click('[data-testid="article-1"]')
  await expect(page.locator('article')).toBeVisible()
})
```

## Test Commands

### Running Tests

```bash
# Unit and integration tests
npm test                    # Fast mode (8-20s)
npm run test:parallel       # Parallel execution
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only

# E2E tests
npm run test:e2e            # All browsers
npx playwright test --project=chromium  # Specific browser
npx playwright test --ui    # Interactive UI mode

# Coverage
npm run test:coverage       # Generate coverage report

# Watch mode
npm run test:watch          # Auto-run on changes
```

### Debugging Tests

```bash
# Debug mode
npx playwright test --debug           # E2E debug mode
npm run test:unit -- --inspect       # Node debugger

# Verbose output
npm test -- --reporter=verbose       # Detailed output
npx playwright test --trace on       # E2E with trace
```

## Best Practices

### Do's ✅

- Write descriptive test names
- Use proper setup/teardown
- Mock external dependencies
- Test edge cases
- Keep tests focused and isolated
- Use test fixtures for consistency
- Clean up after tests

### Don'ts ❌

- Don't test implementation details
- Avoid testing third-party libraries
- Don't use production data
- Avoid brittle selectors in E2E
- Don't skip cleanup
- Avoid interdependent tests

## CI/CD Integration

Tests run automatically on:
- Pull requests (PR validation)
- Pre-commit hooks (local validation)
- Manual trigger via `npm run pre-commit`

## Troubleshooting

### Common Issues

**Tests timing out:**
```bash
# Increase timeout
npm test -- --testTimeout=10000
```

**E2E tests failing locally:**
```bash
# Install browsers
npx playwright install
```

**Database connection errors:**
```bash
# Check test environment
cp .env.example .env.test
# Update with test credentials
```

**Flaky tests:**
- Check for async race conditions
- Ensure proper wait strategies
- Use stable test selectors

## Related Documentation

### In This Directory
- [Technical Implementation](./technical-implementation.md) - Deep dive into testing architecture
- [Safe Test Practices](./safe-test-practices.md) - Guidelines for safe testing
- [Test Consolidation](./rr-243-consolidation-methodology.md) - Test organization
- [Consolidation Verification](./rr-244-consolidation-verification.md) - Test verification
- [Validation Checklist](./validation-checklist.md) - Pre-release validation

### Related Tech Docs
- [E2E Testing Details](../tech/e2e-testing.md) - Playwright configuration

## Auto-Generated Files

These files are generated during testing and should NOT be committed:

- `performance-baseline.json` - Performance metrics
- `performance-report.json` - Current metrics
- `playwright-report/` - E2E test results
- `test-results/` - Test artifacts
- `coverage/` - Coverage reports
- `*.tsbuildinfo` - TypeScript cache

All configured in `.gitignore` and regenerated as needed.