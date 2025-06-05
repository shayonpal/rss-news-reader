# Testing & Quality Assurance Plan - Shayon's News

## Overview

This comprehensive testing strategy ensures the RSS Reader PWA meets high quality standards across functionality, performance, accessibility, and user experience. The plan covers unit testing, integration testing, end-to-end testing, and performance benchmarking.

## Testing Framework & Tools

### Core Testing Stack

- **Unit Testing**: Vitest with React Testing Library
- **Integration Testing**: Vitest with MSW (Mock Service Worker)
- **E2E Testing**: Playwright for cross-browser testing
- **Performance Testing**: Lighthouse CI and WebPageTest
- **Accessibility Testing**: axe-core with jest-axe
- **Visual Regression**: Percy or Chromatic for UI consistency

### Development Testing Tools

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "playwright": "^1.40.0",
    "msw": "^2.0.0",
    "jest-axe": "^8.0.0",
    "@axe-core/playwright": "^4.8.0",
    "lighthouse": "^11.0.0"
  }
}
```

## Unit Testing Strategy

### Component Testing Approach

```typescript
// Test utilities for consistent component testing
// tests/utils/test-utils.tsx
export const renderWithProviders = (
  ui: ReactElement,
  options: {
    initialState?: Partial<AppState>
    theme?: 'light' | 'dark'
  } = {}
) => {
  const { initialState = {}, theme = 'light' } = options

  const mockStore = createMockStore({
    articles: { articles: new Map(), isLoading: false },
    feeds: { feeds: [], folders: [] },
    settings: { theme, apiUsage: {} },
    ...initialState
  })

  return render(
    <StoreProvider store={mockStore}>
      <ThemeProvider theme={theme}>
        {ui}
      </ThemeProvider>
    </StoreProvider>
  )
}
```

### Key Component Test Cases

#### Article List Component

```typescript
// components/ArticleList.test.tsx
describe('ArticleList', () => {
  it('displays articles with correct metadata', () => {
    const mockArticles = [
      createMockArticle({ title: 'Test Article', isRead: false }),
      createMockArticle({ title: 'Read Article', isRead: true })
    ]

    renderWithProviders(<ArticleList articles={mockArticles} />)

    expect(screen.getByText('Test Article')).toBeInTheDocument()
    expect(screen.getByText('Read Article')).toHaveClass('read')
  })

  it('handles marking articles as read', async () => {
    const user = userEvent.setup()
    const mockMarkAsRead = vi.fn()

    renderWithProviders(<ArticleList onMarkAsRead={mockMarkAsRead} />)

    await user.click(screen.getByTestId('article-123'))
    expect(mockMarkAsRead).toHaveBeenCalledWith('123')
  })

  it('shows loading state correctly', () => {
    renderWithProviders(<ArticleList />, {
      initialState: { articles: { isLoading: true } }
    })

    expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument()
  })

  it('handles empty state', () => {
    renderWithProviders(<ArticleList articles={[]} />)

    expect(screen.getByText('No articles to display')).toBeInTheDocument()
    expect(screen.getByText('Pull down to refresh')).toBeInTheDocument()
  })
})
```

#### Summary Generation Component

```typescript
// components/SummaryGenerator.test.tsx
describe('SummaryGenerator', () => {
  it('generates summary on button click', async () => {
    const user = userEvent.setup()
    const mockGenerateSummary = vi.fn().mockResolvedValue('Mock summary')

    renderWithProviders(
      <SummaryGenerator
        articleId="123"
        onGenerate={mockGenerateSummary}
      />
    )

    await user.click(screen.getByText('Summarize'))

    expect(screen.getByText('Generating...')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('Mock summary')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup()
    const mockGenerateSummary = vi.fn().mockRejectedValue(new Error('API Error'))

    renderWithProviders(
      <SummaryGenerator onGenerate={mockGenerateSummary} />
    )

    await user.click(screen.getByText('Summarize'))

    await waitFor(() => {
      expect(screen.getByText('Summary generation failed')).toBeInTheDocument()
      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })
  })
})
```

### Utility Function Testing

```typescript
// lib/utils/article-utils.test.ts
describe("Article Utilities", () => {
  describe("parseArticleContent", () => {
    it("removes HTML tags correctly", () => {
      const htmlContent = "<p>Test <strong>content</strong> with tags</p>";
      const result = parseArticleContent(htmlContent);

      expect(result.plainText).toBe("Test content with tags");
      expect(result.wordCount).toBe(4);
    });

    it("preserves important media elements", () => {
      const htmlWithMedia =
        '<p>Text</p><img src="test.jpg" /><video>Video</video>';
      const result = parseArticleContent(htmlWithMedia);

      expect(result.hasImages).toBe(true);
      expect(result.hasVideos).toBe(true);
      expect(result.mediaElements).toHaveLength(2);
    });
  });

  describe("calculateReadingTime", () => {
    it("estimates reading time correctly", () => {
      const shortText = "Short text here";
      const longText = "Lorem ipsum ".repeat(100);

      expect(calculateReadingTime(shortText)).toBe(1);
      expect(calculateReadingTime(longText)).toBeGreaterThan(2);
    });
  });
});
```

### Store Testing

```typescript
// lib/stores/article-store.test.ts
describe("Article Store", () => {
  it("adds new articles correctly", () => {
    const store = createTestStore();
    const newArticles = [createMockArticle({ id: "1" })];

    store.getState().articles.addArticles(newArticles);

    const state = store.getState();
    expect(state.articles.articles.has("1")).toBe(true);
  });

  it("handles duplicate articles", () => {
    const store = createTestStore();
    const article = createMockArticle({ id: "1", title: "Original" });
    const duplicate = createMockArticle({ id: "1", title: "Updated" });

    store.getState().articles.addArticles([article]);
    store.getState().articles.addArticles([duplicate]);

    const finalArticle = store.getState().articles.articles.get("1");
    expect(finalArticle?.title).toBe("Updated");
  });

  it("maintains article limit", () => {
    const store = createTestStore();
    const manyArticles = Array.from({ length: 600 }, (_, i) =>
      createMockArticle({ id: String(i) })
    );

    store.getState().articles.addArticles(manyArticles);

    expect(store.getState().articles.articles.size).toBe(500);
  });
});
```

## Integration Testing

### API Service Testing with MSW

```typescript
// tests/api/inoreader.test.ts
describe("Inoreader API Service", () => {
  beforeEach(() => {
    server.use(
      rest.get("*/subscription/list", (req, res, ctx) => {
        return res(ctx.json(mockSubscriptionResponse));
      }),

      rest.get("*/stream/contents/*", (req, res, ctx) => {
        return res(ctx.json(mockStreamContentsResponse));
      })
    );
  });

  it("fetches subscription list successfully", async () => {
    const result = await inoreaderApi.getSubscriptions();

    expect(result.subscriptions).toHaveLength(3);
    expect(result.subscriptions[0].title).toBe("Test Feed");
  });

  it("handles API rate limits", async () => {
    server.use(
      rest.get("*/subscription/list", (req, res, ctx) => {
        return res(ctx.status(429), ctx.json({ error: "Rate limit exceeded" }));
      })
    );

    await expect(inoreaderApi.getSubscriptions()).rejects.toThrow(
      "API_RATE_LIMIT"
    );
  });

  it("retries failed requests", async () => {
    let callCount = 0;
    server.use(
      rest.get("*/subscription/list", (req, res, ctx) => {
        callCount++;
        if (callCount < 3) {
          return res(ctx.status(500));
        }
        return res(ctx.json(mockSubscriptionResponse));
      })
    );

    const result = await inoreaderApi.getSubscriptions();
    expect(result.subscriptions).toBeDefined();
    expect(callCount).toBe(3);
  });
});
```

### Sync Manager Testing

```typescript
// lib/sync/sync-manager.test.ts
describe("Sync Manager", () => {
  it("performs complete sync successfully", async () => {
    const mockDb = createMockDatabase();
    const syncManager = new SyncManager(mockDb);

    const result = await syncManager.performFullSync();

    expect(result.success).toBe(true);
    expect(result.newArticles).toBeGreaterThan(0);
    expect(result.apiCallsUsed).toBeLessThanOrEqual(6);
  });

  it("handles partial sync failures", async () => {
    server.use(
      rest.get("*/unread-count", (req, res, ctx) => {
        return res(ctx.status(500));
      })
    );

    const result = await syncManager.performFullSync();

    expect(result.success).toBe(true); // Partial success
    expect(result.errors).toContain("UNREAD_COUNT_FAILED");
    expect(result.newArticles).toBeGreaterThan(0); // Still got articles
  });
});
```

## End-to-End Testing

### Critical User Flows

```typescript
// e2e/auth-flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("complete OAuth flow with Inoreader", async ({ page }) => {
    await page.goto("/");

    // Should show welcome screen for new users
    await expect(page.getByText("Connect to Inoreader")).toBeVisible();

    // Click connect button
    await page.getByRole("button", { name: "Connect to Inoreader" }).click();

    // Should redirect to Inoreader OAuth
    await expect(page).toHaveURL(/inoreader\.com\/oauth2\/auth/);

    // Mock successful OAuth return
    await page.goto("/?code=test_auth_code&state=test_state");

    // Should show article list after successful auth
    await expect(page.getByText("All Articles")).toBeVisible();
    await expect(page.getByTestId("article-list")).toBeVisible();
  });

  test("handles OAuth errors gracefully", async ({ page }) => {
    await page.goto("/?error=access_denied");

    await expect(page.getByText("Authorization was cancelled")).toBeVisible();
    await expect(page.getByText("Try Again")).toBeVisible();
  });
});
```

```typescript
// e2e/reading-flow.spec.ts
test.describe("Reading Experience", () => {
  test("complete article reading flow", async ({ page }) => {
    await page.goto("/");

    // Assume user is authenticated
    await mockAuthentication(page);

    // Load article list
    await expect(page.getByTestId("article-list")).toBeVisible();

    // Click on first article
    const firstArticle = page.getByTestId("article-item").first();
    await firstArticle.click();

    // Should open article detail
    await expect(page.getByTestId("article-detail")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Article should be marked as read
    await page.goBack();
    await expect(firstArticle).toHaveClass(/read/);
  });

  test("AI summary generation", async ({ page }) => {
    await page.goto("/article/123");
    await mockAuthentication(page);

    // Click summarize button
    await page.getByRole("button", { name: "Summarize" }).click();

    // Should show loading state
    await expect(page.getByText("Generating summary...")).toBeVisible();

    // Mock API response
    await page.route("**/api/summarize", (route) => {
      route.fulfill({
        json: { summary: "This is a test summary of the article content." },
      });
    });

    // Should show summary
    await expect(page.getByText("This is a test summary")).toBeVisible();

    // Summary should persist on reload
    await page.reload();
    await expect(page.getByText("This is a test summary")).toBeVisible();
  });
});
```

### Offline Functionality Testing

```typescript
// e2e/offline.spec.ts
test.describe("Offline Functionality", () => {
  test("works offline with cached content", async ({ page, context }) => {
    await page.goto("/");
    await mockAuthentication(page);

    // Load some articles first
    await expect(page.getByTestId("article-list")).toBeVisible();
    await page.getByTestId("article-item").first().click();
    await expect(page.getByTestId("article-detail")).toBeVisible();

    // Go offline
    await context.setOffline(true);

    // Navigate back to list
    await page.goBack();

    // Should show offline banner
    await expect(page.getByText("Offline")).toBeVisible();

    // Should still display cached articles
    await expect(page.getByTestId("article-list")).toBeVisible();

    // Should be able to read cached article
    await page.getByTestId("article-item").first().click();
    await expect(page.getByTestId("article-detail")).toBeVisible();
  });

  test("queues actions when offline", async ({ page, context }) => {
    await page.goto("/");
    await mockAuthentication(page);

    // Go offline
    await context.setOffline(true);

    // Mark article as read
    await page.getByTestId("article-item").first().click();

    // Should show queued indicator
    await expect(page.getByText("Queued for sync")).toBeVisible();

    // Go back online
    await context.setOffline(false);

    // Should sync automatically
    await expect(page.getByText("Synced")).toBeVisible();
  });
});
```

## Performance Testing

### Lighthouse CI Configuration

```yaml
# .lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/', 'http://localhost:3000/article/123'],
      numberOfRuns: 3
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'categories:pwa': ['error', { minScore: 0.9 }]
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
}
```

### Performance Benchmarks

```typescript
// tests/performance/benchmarks.test.ts
describe('Performance Benchmarks', () => {
  test('article list renders within performance budget', async () => {
    const startTime = performance.now()

    renderWithProviders(<ArticleList articles={generateLargeArticleList()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('article-item')).toHaveLength(100)
    })

    const endTime = performance.now()
    const renderTime = endTime - startTime

    expect(renderTime).toBeLessThan(1000) // < 1 second
  })

  test('IndexedDB operations are performant', async () => {
    const db = await openTestDatabase()
    const articles = generateLargeArticleList(1000)

    const startTime = performance.now()
    await db.articles.bulkAdd(articles)
    const endTime = performance.now()

    expect(endTime - startTime).toBeLessThan(2000) // < 2 seconds for 1000 articles
  })
})
```

## Accessibility Testing

### Automated A11y Testing

```typescript
// tests/accessibility/a11y.test.ts
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

describe('Accessibility', () => {
  test('article list has no accessibility violations', async () => {
    const { container } = renderWithProviders(<ArticleList />)
    const results = await axe(container)

    expect(results).toHaveNoViolations()
  })

  test('navigation is keyboard accessible', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />)

    // Tab through navigation
    await user.tab()
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Refresh' })).toHaveFocus()

    // Enter should activate buttons
    await user.keyboard('{Enter}')
    // Assert appropriate action was taken
  })

  test('screen reader announcements work correctly', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ArticleList />)

    // Mark article as read
    await user.click(screen.getByTestId('article-123'))

    // Should announce the change
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Article marked as read')
    })
  })
})
```

### Manual A11y Testing Checklist

```markdown
## Manual Accessibility Testing Checklist

### Keyboard Navigation

- [ ] All interactive elements are keyboard accessible
- [ ] Tab order is logical and follows visual flow
- [ ] Focus indicators are visible and clear
- [ ] No keyboard traps exist
- [ ] Skip links work correctly

### Screen Reader Testing

- [ ] All content is announced correctly
- [ ] Headings provide proper structure
- [ ] Images have appropriate alt text
- [ ] Form labels are associated correctly
- [ ] Status changes are announced

### Visual Accessibility

- [ ] Color contrast meets WCAG AA standards
- [ ] Content is readable at 200% zoom
- [ ] Focus indicators are visible
- [ ] No content relies solely on color
- [ ] Text is readable in both light and dark modes
```

## Visual Regression Testing

### Percy Configuration

```typescript
// tests/visual/percy.test.ts
import percySnapshot from "@percy/playwright";

test.describe("Visual Regression Tests", () => {
  test("article list appearance", async ({ page }) => {
    await page.goto("/");
    await mockAuthentication(page);

    // Wait for articles to load
    await expect(page.getByTestId("article-list")).toBeVisible();

    await percySnapshot(page, "Article List - Light Mode");

    // Switch to dark mode
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await percySnapshot(page, "Article List - Dark Mode");
  });

  test("article detail responsive design", async ({ page }) => {
    await page.goto("/article/123");
    await mockAuthentication(page);

    // Test different viewport sizes
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone
    await percySnapshot(page, "Article Detail - Mobile");

    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await percySnapshot(page, "Article Detail - Tablet");

    await page.setViewportSize({ width: 1200, height: 800 }); // Desktop
    await percySnapshot(page, "Article Detail - Desktop");
  });
});
```

## Test Data Management

### Mock Data Factories

```typescript
// tests/factories/article-factory.ts
export const createMockArticle = (
  overrides: Partial<Article> = {}
): Article => ({
  id: faker.string.uuid(),
  title: faker.lorem.sentence(),
  content: faker.lorem.paragraphs(3),
  author: faker.person.fullName(),
  source: faker.company.name(),
  publishedAt: faker.date.recent(),
  url: faker.internet.url(),
  isRead: false,
  hasFullContent: true,
  summary: null,
  ...overrides,
});

export const createMockFeed = (overrides: Partial<Feed> = {}): Feed => ({
  id: faker.string.uuid(),
  title: faker.company.name(),
  url: faker.internet.url(),
  category: faker.helpers.arrayElement(["Tech", "News", "Blogs"]),
  unreadCount: faker.number.int({ min: 0, max: 50 }),
  ...overrides,
});
```

### Test Database Utilities

```typescript
// tests/utils/test-db.ts
export const createTestDatabase = async (): Promise<TestDB> => {
  const db = new TestDB();
  await db.open();

  // Seed with test data
  await db.articles.bulkAdd([
    createMockArticle({ id: "1", title: "Test Article 1" }),
    createMockArticle({ id: "2", title: "Test Article 2", isRead: true }),
  ]);

  return db;
};

export const cleanupTestDatabase = async (db: TestDB) => {
  await db.articles.clear();
  await db.feeds.clear();
  await db.delete();
};
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"

      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run test:integration

      - name: Install Playwright
        run: npx playwright install --with-deps

      - run: npm run test:e2e

      - name: Run Lighthouse CI
        run: npm run lighthouse:ci

      - name: Upload test coverage
        uses: codecov/codecov-action@v3
```

## Quality Gates & Success Criteria

### Coverage Requirements

- **Unit Tests**: 90%+ code coverage
- **Integration Tests**: All API endpoints covered
- **E2E Tests**: All critical user flows covered

### Performance Requirements

- **Lighthouse Scores**: 90+ across all categories
- **Bundle Size**: < 500KB gzipped
- **Time to Interactive**: < 3 seconds on 3G

### Accessibility Requirements

- **WCAG 2.1 AA Compliance**: No violations
- **Keyboard Navigation**: 100% functional
- **Screen Reader**: All content accessible

### Browser Support

- **Desktop**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile**: iOS Safari 14+, Chrome Mobile 90+

This comprehensive testing strategy ensures the RSS Reader PWA meets high standards for functionality, performance, accessibility, and user experience across all supported platforms and devices.
