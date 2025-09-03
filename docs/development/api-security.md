# API Security Development Guide

This document provides developers with practical guidance on implementing and maintaining security measures for API endpoints in the RSS News Reader application.

## Overview

The RSS News Reader application implements multiple layers of API security to protect against common attacks and ensure data integrity. This guide covers implementation patterns, validation middleware, and security best practices.

## UUID Validation Middleware (RR-202)

### Purpose

The UUID validation middleware provides runtime parameter validation for API routes that accept UUID parameters, preventing malformed UUIDs from reaching route handlers and potential database queries.

### Implementation

**Location**: `src/lib/utils/uuid-validation-middleware.ts`

**Core Functions**:

```typescript
// Validate a single UUID
validateUUID(uuid: string): { isValid: boolean; error?: string }

// Validate multiple UUID parameters
validateUUIDParams(params: Record<string, string>, uuidFields: string[]): NextResponse | null

// Higher-order function wrapper
withUUIDValidation(uuidFields: string[], handler: Function)

// Convenience wrappers
withArticleIdValidation(handler: Function)
withTagIdValidation(handler: Function)
```

### Usage Examples

**Basic Route Handler Wrapper**:

```typescript
// src/app/api/articles/[id]/tags/route.ts
import { withArticleIdValidation } from "@/lib/utils/uuid-validation-middleware";

const getHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const articleId = params.id; // Already validated as UUID
  // ... route logic
};

export const GET = withArticleIdValidation(getHandler);
```

**Multiple UUID Parameters**:

```typescript
import { withUUIDValidation } from "@/lib/utils/uuid-validation-middleware";

const handler = async (
  request: NextRequest,
  { params }: { params: { articleId: string; tagId: string } }
) => {
  // Both parameters validated as UUIDs
  // ... route logic
};

export const POST = withUUIDValidation(["articleId", "tagId"], handler);
```

**Manual Validation**:

```typescript
import { validateUUID } from "@/lib/utils/uuid-validation-middleware";

const handler = async (request: NextRequest) => {
  const id = request.nextUrl.searchParams.get("id");
  const validation = validateUUID(id);

  if (!validation.isValid) {
    return NextResponse.json(
      { error: "Invalid parameter", message: validation.error },
      { status: 400 }
    );
  }

  // ... route logic
};
```

### Error Responses

**Invalid UUID Format**:

```json
{
  "error": "Invalid parameter format",
  "message": "Invalid UUID format: abc123",
  "details": "Parameter 'id' must be a valid UUID"
}
```

**Missing Required Parameter**:

```json
{
  "error": "Missing required parameter",
  "message": "Parameter 'id' is required",
  "details": "Expected UUID format for id"
}
```

## Protected API Endpoints

### Current Implementation

**Articles API**:

- `POST /api/articles/{id}/fetch-content` - UUID validation for article ID
- `POST /api/articles/{id}/summarize` - UUID validation for article ID
- `GET /api/articles/{id}/tags` - UUID validation for article ID

**Tags API**:

- `GET /api/tags/{id}` - UUID validation for tag ID
- `PATCH /api/tags/{id}` - UUID validation for tag ID
- `DELETE /api/tags/{id}` - UUID validation for tag ID

### Adding UUID Validation to New Endpoints

When creating new API endpoints that accept UUID parameters:

1. **Import the appropriate validator**:

```typescript
import { withArticleIdValidation } from "@/lib/utils/uuid-validation-middleware";
// or
import { withUUIDValidation } from "@/lib/utils/uuid-validation-middleware";
```

2. **Wrap your route handler**:

```typescript
const handler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  // Your route logic here
  // params.id is guaranteed to be a valid UUID
};

export const GET = withArticleIdValidation(handler);
```

3. **Update tests** to verify validation:

```typescript
// Test invalid UUID
const response = await request(app).get("/api/articles/invalid-uuid/tags");
expect(response.status).toBe(400);
expect(response.body.error).toBe("Invalid parameter format");
```

## Security Testing

### Unit Tests

Create comprehensive tests for UUID validation:

```typescript
// src/__tests__/unit/uuid-validation-middleware.test.ts
import {
  validateUUID,
  validateUUIDParams,
} from "@/lib/utils/uuid-validation-middleware";

describe("UUID Validation", () => {
  test("validates correct UUID format", () => {
    const result = validateUUID("550e8400-e29b-41d4-a716-446655440000");
    expect(result.isValid).toBe(true);
  });

  test("rejects invalid UUID format", () => {
    const result = validateUUID("invalid-uuid");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Invalid UUID format");
  });

  test("validates required parameters", () => {
    const result = validateUUIDParams({ id: "invalid" }, ["id"]);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(400);
  });
});
```

### Integration Tests

Test endpoint behavior with invalid UUIDs:

```typescript
// src/__tests__/integration/uuid-validation.test.ts
describe("API UUID Validation", () => {
  test("POST /api/articles/[id]/fetch-content rejects invalid UUID", async () => {
    const response = await fetch("/api/articles/invalid-uuid/fetch-content", {
      method: "POST",
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid parameter format");
  });
});
```

### End-to-End Tests

Verify validation in full user workflows:

```typescript
// src/__tests__/e2e/uuid-validation.spec.ts
test("Invalid article ID shows proper error message", async ({ page }) => {
  await page.goto("/article/invalid-uuid");
  await expect(page.locator('[data-testid="error-message"]')).toContainText(
    "Invalid article ID"
  );
});
```

## Development Best Practices

### 1. Consistent Error Handling

Always use the same error format for validation failures:

```typescript
{
  "error": "error_type",
  "message": "Human-readable message",
  "details": "Additional context"
}
```

### 2. TypeScript Integration

Ensure proper typing for validated parameters:

```typescript
type ValidatedParams<T extends Record<string, string>> = T & {
  [K in keyof T]: string; // UUID string
};

const handler = async (
  request: NextRequest,
  { params }: { params: ValidatedParams<{ id: string }> }
) => {
  // params.id is guaranteed to be valid UUID
};
```

### 3. Logging and Monitoring

Log validation failures for security monitoring:

```typescript
import { logger } from "@/lib/utils/logger";

export function validateUUIDParams(
  params: Record<string, string>,
  uuidFields: string[]
) {
  for (const field of uuidFields) {
    const validation = validateUUID(params[field]);
    if (!validation.isValid) {
      logger.warn("UUID validation failed", {
        field,
        value: params[field],
        endpoint: process.env.NEXT_PUBLIC_VERCEL_URL || "local",
      });

      return NextResponse.json(/* error response */);
    }
  }
  return null;
}
```

### 4. Performance Considerations

UUID validation is lightweight but runs on every request:

- **Validation Time**: ~0.1ms per UUID using Zod
- **Memory Impact**: Minimal - validation is stateless
- **Caching**: Not needed due to low overhead

### 5. Security Guidelines

**DO**:

- ✅ Apply UUID validation to all ID-based API endpoints
- ✅ Use convenience wrappers (`withArticleIdValidation`, etc.) for consistency
- ✅ Test both valid and invalid UUID scenarios
- ✅ Log validation failures for security monitoring
- ✅ Provide clear error messages without exposing sensitive information

**DON'T**:

- ❌ Skip validation for "internal" or "admin" endpoints
- ❌ Expose raw database errors in validation responses
- ❌ Use UUID validation for non-UUID parameters (use appropriate Zod schemas)
- ❌ Bypass validation in development/test environments
- ❌ Include sensitive information in validation error messages

## Future Enhancements

### Planned Improvements

1. **Extended Parameter Validation**: Expand to other parameter types (emails, dates, etc.)
2. **Rate Limiting Integration**: Combine with rate limiting middleware
3. **Audit Trail**: Enhanced logging for security analysis
4. **Performance Monitoring**: Track validation performance metrics

### Extensibility Patterns

**Custom Validators**:

```typescript
// src/lib/utils/validation-middleware.ts
export const withEmailValidation = (fields: string[], handler: Function) =>
  withValidation(fields, z.string().email(), handler);

export const withDateValidation = (fields: string[], handler: Function) =>
  withValidation(fields, z.string().datetime(), handler);
```

**Middleware Composition**:

```typescript
// Combine multiple validations
export const GET = pipe(
  withUUIDValidation(["articleId"]),
  withAuthenticationCheck(),
  withRateLimit(100),
  handler
);
```

## Related Documentation

- **Security Overview**: `docs/tech/security.md`
- **API Endpoints**: `docs/api/server-endpoints.md`
- **Testing Strategy**: `docs/tech/testing-strategy.md`
- **Error Handling**: `docs/tech/error-handling.md`

---

_This guide is maintained to ensure consistent security implementation across all API endpoints. Update this document when adding new validation patterns or security measures._
