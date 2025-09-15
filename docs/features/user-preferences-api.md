# User Preferences API Integration Guide (RR-272)

**Created**: September 7, 2025  
**Status**: Implemented  
**API Version**: v1.0  
**Related Features**: RR-270 (state management), RR-271 (encryption)

## Overview

The User Preferences API provides secure, encrypted storage and retrieval of user preferences with comprehensive validation, caching, and error handling. This guide covers integration patterns, request/response schemas, and best practices.

### Key Features

- **Encrypted API Key Storage**: AES-256-GCM encryption for sensitive data
- **User-Scoped Access**: Per-user preference isolation via route parameters
- **Schema Validation**: Comprehensive input/output validation with Zod
- **Intelligent Caching**: TTL-based caching with user-specific keys
- **ETag Support**: HTTP caching with conditional requests
- **Error Handling**: Detailed error responses with sanitized messages

## API Endpoints

### Base URL Pattern

```
/reader/api/users/[id]/preferences
```

**Route Parameters:**

- `id`: User ID (string, required) - Identifies the user for preference isolation

**Access Requirements:**

- **Network**: Tailscale VPN access to 100.96.166.53:3000
- **Authentication**: Server-side service role key (handled automatically)

## GET - Retrieve User Preferences

### Request

```http
GET /reader/api/users/{userId}/preferences
Accept: application/json
If-None-Match: "etag-value" (optional)
```

### Response Schema

```typescript
interface PreferencesResponse {
  ai: {
    hasApiKey: boolean; // Boolean flag, never actual key
    model: string; // AI model identifier
    summaryLengthMin: number; // Min summary length (50-500)
    summaryLengthMax: number; // Max summary length (50-500)
    summaryStyle: "objective" | "analytical" | "concise" | "detailed";
    contentFocus: "general" | "technical" | "business" | "educational" | null;
  };
  sync: {
    maxArticles: number; // Max articles per sync (10-5000)
    retentionCount: number; // Article retention days (1-365)
  };
}
```

### Response Examples

**Default Preferences (New User):**

```json
{
  "ai": {
    "hasApiKey": false,
    "model": "claude-3-haiku-20240307",
    "summaryLengthMin": 100,
    "summaryLengthMax": 300,
    "summaryStyle": "objective",
    "contentFocus": "general"
  },
  "sync": {
    "maxArticles": 500,
    "retentionCount": 30
  }
}
```

**User with Custom Preferences:**

```json
{
  "ai": {
    "hasApiKey": true,
    "model": "claude-3-sonnet-20240229",
    "summaryLengthMin": 150,
    "summaryLengthMax": 400,
    "summaryStyle": "analytical",
    "contentFocus": "technical"
  },
  "sync": {
    "maxArticles": 1000,
    "retentionCount": 90
  }
}
```

### Error Responses

```json
// 400 - Bad Request
{
  "error": "User ID is required"
}

// 404 - User Not Found
{
  "error": "User not found"
}

// 500 - Server Error
{
  "error": "Failed to retrieve preferences",
  "details": "Database connection timeout"
}
```

### HTTP Status Codes

| Code | Description           | Use Case                              |
| ---- | --------------------- | ------------------------------------- |
| 200  | OK                    | Preferences retrieved successfully    |
| 304  | Not Modified          | ETag match, cached version is current |
| 400  | Bad Request           | Invalid user ID or request format     |
| 404  | Not Found             | User does not exist                   |
| 500  | Internal Server Error | Database or server error              |

## PUT - Update User Preferences

### Request Schema

```typescript
interface PreferencesUpdateRequest {
  ai?: {
    model?: string; // Must exist in ai_models table
    summaryLengthMin?: number; // Range: 50-500
    summaryLengthMax?: number; // Range: 50-500, >= summaryLengthMin
    summaryStyle?: "objective" | "analytical" | "concise" | "detailed";
    contentFocus?: "general" | "technical" | "business" | "educational" | null;

    // API Key Management
    apiKeyChange?: "replace" | "clear";
    apiKey?: string | EncryptedData; // Plain text or pre-encrypted
  };
  sync?: {
    maxArticles?: number; // Range: 10-5000
    retentionCount?: number; // Range: 1-365
  };
}

interface EncryptedData {
  encrypted: string; // Hex-encoded encrypted data
  iv: string; // Hex-encoded initialization vector
  authTag: string; // Hex-encoded authentication tag
}
```

### Request Examples

**Update AI Preferences:**

```json
{
  "ai": {
    "model": "claude-3-opus-20240229",
    "summaryLengthMin": 200,
    "summaryLengthMax": 400,
    "summaryStyle": "detailed",
    "contentFocus": "technical"
  }
}
```

**Add/Replace API Key:**

```json
{
  "ai": {
    "apiKeyChange": "replace",
    "apiKey": "sk-ant-api-123456789..."
  }
}
```

**Remove API Key:**

```json
{
  "ai": {
    "apiKeyChange": "clear"
  }
}
```

**Update Sync Configuration:**

```json
{
  "sync": {
    "maxArticles": 1000,
    "retentionCount": 90
  }
}
```

### Request Headers

```http
PUT /reader/api/users/{userId}/preferences
Content-Type: application/json
Content-Length: {size}
If-Match: "etag-value" (optional, for optimistic concurrency)
```

### Response

**Success Response:**

```json
// 200 OK
// ETag: "computed-etag-value"
{
  "ai": {
    "hasApiKey": true,
    "model": "claude-3-opus-20240229",
    "summaryLengthMin": 200,
    "summaryLengthMax": 400,
    "summaryStyle": "detailed",
    "contentFocus": "technical"
  },
  "sync": {
    "maxArticles": 1000,
    "retentionCount": 90
  }
}
```

### Error Responses

**Validation Errors:**

```json
// 422 - Unprocessable Entity
{
  "error": "UNPROCESSABLE_ENTITY",
  "message": "Invalid preferences data",
  "details": [
    {
      "code": "too_big",
      "maximum": 500,
      "type": "number",
      "inclusive": true,
      "exact": false,
      "message": "Number must be less than or equal to 500",
      "path": ["ai", "summaryLengthMin"]
    }
  ]
}
```

**Invalid Model:**

```json
// 422 - Unprocessable Entity
{
  "error": "INVALID_MODEL",
  "message": "Invalid AI model specified"
}
```

**Concurrency Conflict:**

```json
// 409 - Conflict
{
  "error": "ETAG_MISMATCH",
  "message": "Resource has been modified. Please reload and retry."
}
```

**Request Too Large:**

```json
// 413 - Payload Too Large
{
  "error": "Request too large",
  "details": "Preferences data must be less than 10KB"
}
```

## Integration Patterns

### 1. Basic Usage (Fetch and Display)

```typescript
const fetchUserPreferences = async (
  userId: string
): Promise<PreferencesResponse> => {
  const response = await fetch(`/reader/api/users/${userId}/preferences`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

// Usage
try {
  const preferences = await fetchUserPreferences("user-123");
  console.log("Current AI model:", preferences.ai.model);
  console.log("Has API key:", preferences.ai.hasApiKey);
} catch (error) {
  console.error("Failed to fetch preferences:", error);
}
```

### 2. ETag-Based Caching

```typescript
class PreferencesClient {
  private etag: string | null = null;
  private cachedPreferences: PreferencesResponse | null = null;

  async getPreferences(
    userId: string,
    forceRefresh = false
  ): Promise<PreferencesResponse> {
    const headers: HeadersInit = {
      Accept: "application/json",
    };

    // Add If-None-Match header for caching
    if (this.etag && !forceRefresh) {
      headers["If-None-Match"] = this.etag;
    }

    const response = await fetch(`/reader/api/users/${userId}/preferences`, {
      method: "GET",
      headers,
    });

    if (response.status === 304) {
      // Not modified, return cached version
      return this.cachedPreferences!;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Store new ETag and preferences
    this.etag = response.headers.get("ETag");
    this.cachedPreferences = await response.json();

    return this.cachedPreferences;
  }
}
```

### 3. Update with Optimistic Concurrency

```typescript
class PreferencesManager {
  async updatePreferences(
    userId: string,
    updates: Partial<PreferencesUpdateRequest>,
    currentEtag?: string
  ): Promise<PreferencesResponse> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Add If-Match for optimistic concurrency control
    if (currentEtag) {
      headers["If-Match"] = currentEtag;
    }

    const response = await fetch(`/reader/api/users/${userId}/preferences`, {
      method: "PUT",
      headers,
      body: JSON.stringify(updates),
    });

    if (response.status === 409) {
      throw new ConflictError(
        "Preferences were modified by another request. Please refresh and retry."
      );
    }

    if (!response.ok) {
      const error = await response.json();
      throw new PreferencesError(error.message, error.details);
    }

    return response.json();
  }
}

class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

class PreferencesError extends Error {
  details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = "PreferencesError";
    this.details = details;
  }
}
```

### 4. API Key Management

```typescript
class SecureApiKeyManager {
  async setApiKey(userId: string, apiKey: string): Promise<void> {
    const updateRequest = {
      ai: {
        apiKeyChange: "replace" as const,
        apiKey: apiKey,
      },
    };

    const response = await this.updatePreferences(userId, updateRequest);

    if (!response.ai.hasApiKey) {
      throw new Error("API key was not stored successfully");
    }
  }

  async clearApiKey(userId: string): Promise<void> {
    const updateRequest = {
      ai: {
        apiKeyChange: "clear" as const,
      },
    };

    const response = await this.updatePreferences(userId, updateRequest);

    if (response.ai.hasApiKey) {
      throw new Error("API key was not cleared successfully");
    }
  }

  async hasApiKey(userId: string): Promise<boolean> {
    const preferences = await this.getPreferences(userId);
    return preferences.ai.hasApiKey;
  }
}
```

### 5. React Hook Integration

```typescript
import { useCallback, useEffect, useState } from "react";

interface UsePreferencesResult {
  preferences: PreferencesResponse | null;
  loading: boolean;
  error: string | null;
  updatePreferences: (
    updates: Partial<PreferencesUpdateRequest>
  ) => Promise<void>;
  refetch: () => Promise<void>;
}

export const useUserPreferences = (userId: string): UsePreferencesResult => {
  const [preferences, setPreferences] = useState<PreferencesResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/reader/api/users/${userId}/preferences`);
      if (!response.ok) {
        throw new Error(`Failed to fetch preferences: ${response.statusText}`);
      }

      const data = await response.json();
      setPreferences(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const updatePreferences = useCallback(
    async (updates: Partial<PreferencesUpdateRequest>) => {
      try {
        setError(null);

        const response = await fetch(
          `/reader/api/users/${userId}/preferences`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to update preferences");
        }

        const updatedPreferences = await response.json();
        setPreferences(updatedPreferences);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
        throw err;
      }
    },
    [userId]
  );

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    refetch: fetchPreferences,
  };
};
```

## Validation Rules

### AI Preferences

```typescript
const AI_VALIDATION_RULES = {
  model: {
    type: "string",
    validation: "Must exist in ai_models table",
    examples: [
      "claude-3-haiku-20240307",
      "claude-3-sonnet-20240229",
      "claude-3-opus-20240229",
    ],
  },
  summaryLengthMin: {
    type: "number",
    range: [50, 500],
    constraint: "Must be <= summaryLengthMax",
  },
  summaryLengthMax: {
    type: "number",
    range: [50, 500],
    constraint: "Must be >= summaryLengthMin",
  },
  summaryStyle: {
    type: "enum",
    values: ["objective", "analytical", "concise", "detailed"],
  },
  contentFocus: {
    type: "enum",
    values: ["general", "technical", "business", "educational", null],
  },
};
```

### Sync Preferences

```typescript
const SYNC_VALIDATION_RULES = {
  maxArticles: {
    type: "number",
    range: [10, 5000],
    description: "Maximum articles to sync per operation",
  },
  retentionCount: {
    type: "number",
    range: [1, 365],
    description: "Days to retain articles",
  },
};
```

### API Key Validation

```typescript
const API_KEY_VALIDATION = {
  format: /^sk-ant-[a-zA-Z0-9_-]+$/,
  minLength: 20,
  maxLength: 200,
  encryption: "AES-256-GCM with PBKDF2 key derivation",
};
```

## Error Handling Best Practices

### 1. Comprehensive Error Handling

```typescript
class PreferencesApiClient {
  async handleApiCall<T>(apiCall: () => Promise<Response>): Promise<T> {
    try {
      const response = await apiCall();

      // Handle specific status codes
      switch (response.status) {
        case 400:
          const badRequestError = await response.json();
          throw new ValidationError(badRequestError.error);

        case 404:
          throw new NotFoundError("User not found");

        case 409:
          throw new ConflictError("Preferences modified by another request");

        case 413:
          throw new PayloadTooLargeError("Request too large");

        case 422:
          const validationError = await response.json();
          throw new ValidationError(
            validationError.message,
            validationError.details
          );

        case 500:
          const serverError = await response.json();
          throw new ServerError(serverError.error, serverError.details);
      }

      if (!response.ok) {
        throw new ApiError(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      // Log error for monitoring
      console.error("Preferences API error:", {
        error: error.message,
        timestamp: new Date().toISOString(),
        userId: this.userId,
      });

      throw error;
    }
  }
}
```

### 2. Custom Error Classes

```typescript
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export class ValidationError extends ApiError {
  details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ServerError extends ApiError {
  details?: string;

  constructor(message: string, details?: string) {
    super(message);
    this.name = "ServerError";
    this.details = details;
  }
}

export class PayloadTooLargeError extends ApiError {
  constructor(message: string) {
    super(message);
    this.name = "PayloadTooLargeError";
  }
}
```

## Performance Considerations

### 1. Caching Strategy

```typescript
interface CacheEntry {
  data: PreferencesResponse;
  etag: string;
  expires: number;
  lastAccessed: number;
}

class PreferencesCache {
  private cache = new Map<string, CacheEntry>();
  private readonly ttl = 5 * 60 * 1000; // 5 minutes
  private readonly maxSize = 100;

  get(userId: string): CacheEntry | null {
    const entry = this.cache.get(userId);

    if (!entry || entry.expires < Date.now()) {
      this.cache.delete(userId);
      return null;
    }

    entry.lastAccessed = Date.now();
    return entry;
  }

  set(userId: string, data: PreferencesResponse, etag: string): void {
    // Evict LRU entries if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(userId, {
      data,
      etag,
      expires: Date.now() + this.ttl,
      lastAccessed: Date.now(),
    });
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruKey = key;
        lruTime = entry.lastAccessed;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }
}
```

### 2. Request Batching

```typescript
class BatchedPreferencesClient {
  private pendingRequests = new Map<string, Promise<PreferencesResponse>>();

  async getPreferences(userId: string): Promise<PreferencesResponse> {
    // Return existing request if already pending
    const existing = this.pendingRequests.get(userId);
    if (existing) {
      return existing;
    }

    // Create new request
    const request = this.fetchPreferences(userId);
    this.pendingRequests.set(userId, request);

    try {
      const result = await request;
      return result;
    } finally {
      this.pendingRequests.delete(userId);
    }
  }

  private async fetchPreferences(userId: string): Promise<PreferencesResponse> {
    const response = await fetch(`/reader/api/users/${userId}/preferences`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}
```

### 3. Debounced Updates

```typescript
class DebouncedPreferencesManager {
  private updateTimeouts = new Map<string, NodeJS.Timeout>();
  private pendingUpdates = new Map<string, Partial<PreferencesUpdateRequest>>();

  updatePreferences(
    userId: string,
    updates: Partial<PreferencesUpdateRequest>,
    debounceMs = 1000
  ): void {
    // Clear existing timeout
    const existingTimeout = this.updateTimeouts.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Merge with pending updates
    const existing = this.pendingUpdates.get(userId) || {};
    const merged = this.mergeUpdates(existing, updates);
    this.pendingUpdates.set(userId, merged);

    // Set new timeout
    const timeout = setTimeout(() => {
      this.flushUpdates(userId);
    }, debounceMs);

    this.updateTimeouts.set(userId, timeout);
  }

  private async flushUpdates(userId: string): Promise<void> {
    const updates = this.pendingUpdates.get(userId);
    if (!updates) return;

    this.pendingUpdates.delete(userId);
    this.updateTimeouts.delete(userId);

    try {
      await this.sendUpdate(userId, updates);
    } catch (error) {
      console.error("Failed to flush preference updates:", error);
      // Could implement retry logic here
    }
  }

  private mergeUpdates(
    existing: Partial<PreferencesUpdateRequest>,
    updates: Partial<PreferencesUpdateRequest>
  ): Partial<PreferencesUpdateRequest> {
    return {
      ai: { ...existing.ai, ...updates.ai },
      sync: { ...existing.sync, ...updates.sync },
    };
  }
}
```

## Security Considerations

### 1. API Key Security

- ✅ **Never log API keys**: All error messages sanitized
- ✅ **Encrypted storage**: AES-256-GCM encryption in database
- ✅ **Secure transport**: HTTPS-only communication
- ✅ **No client exposure**: API keys never sent to client

### 2. Access Control

```typescript
// Middleware for user access validation
const validateUserAccess = async (userId: string, requestUserId: string) => {
  if (userId !== requestUserId) {
    throw new Error("Access denied: Cannot modify other user preferences");
  }
};
```

### 3. Input Sanitization

```typescript
const sanitizeInput = (input: any): any => {
  if (typeof input === "string") {
    return input
      .trim()
      .replace(/[<>]/g, "") // Remove potential HTML
      .substring(0, 1000); // Limit length
  }
  return input;
};
```

## Monitoring and Observability

### 1. Metrics Collection

```typescript
interface ApiMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  cacheHitRate: number;
  encryptionOperations: number;
}

class MetricsCollector {
  recordRequest(method: string, status: number, responseTime: number): void {
    // Increment counters
    // Record timing
    // Track error rates
  }

  recordCacheHit(userId: string): void {
    // Track cache effectiveness
  }

  recordEncryption(operation: "encrypt" | "decrypt", duration: number): void {
    // Monitor encryption performance
  }
}
```

### 2. Health Checks

```typescript
export const checkPreferencesHealth = async (): Promise<HealthStatus> => {
  try {
    // Test database connectivity
    await testDbConnection();

    // Test encryption functionality
    await testEncryption();

    // Check cache status
    const cacheStats = getCacheStats();

    return {
      status: "healthy",
      timestamp: Date.now(),
      checks: {
        database: "ok",
        encryption: "ok",
        cache: `${cacheStats.size}/${cacheStats.maxSize} entries`,
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      timestamp: Date.now(),
      error: error.message,
    };
  }
};
```

---

This comprehensive API integration guide provides all the necessary information for working with the User Preferences API, including security best practices, performance optimizations, and comprehensive error handling patterns.
