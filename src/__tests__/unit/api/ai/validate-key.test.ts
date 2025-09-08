import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/ai/validate-key/route";
import { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/services/ai/validation";
import {
  createAuthenticatedRequest,
  createUnauthenticatedRequest,
} from "@/__tests__/helpers/api-test-utils";
import { clearRateLimitStore } from "@/lib/services/ai/rate-limit";

vi.mock("@/lib/services/ai/validation", () => ({
  validateApiKey: vi.fn(),
}));

describe("POST /api/ai/validate-key", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearRateLimitStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("Successful validation", () => {
    it("should validate Anthropic API key with provider context", async () => {
      vi.mocked(validateApiKey).mockResolvedValue({ valid: true });

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/validate-key",
        {
          method: "POST",
          body: {
            provider: "anthropic",
            apiKey: "sk-ant-test-key-123",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ valid: true });
      expect(validateApiKey).toHaveBeenCalledWith(
        "anthropic",
        "sk-ant-test-key-123"
      );
    });

    it("should return generic response for invalid key", async () => {
      vi.mocked(validateApiKey).mockResolvedValue({ valid: false });

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/validate-key",
        {
          method: "POST",
          body: {
            provider: "anthropic",
            apiKey: "invalid-key",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ valid: false });
      expect(data.details).toBeUndefined(); // No detailed error info
    });
  });

  describe("Authentication requirements", () => {
    it("should require authentication", async () => {
      // No referer header - should fail auth
      const request = createUnauthenticatedRequest(
        "http://localhost:3000/api/ai/validate-key",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: "anthropic",
            apiKey: "sk-ant-test-key-123",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toMatch(/Invalid request origin|Unauthorized/);
      expect(validateApiKey).not.toHaveBeenCalled();
    });
  });

  describe("Input validation", () => {
    it("should reject missing provider", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/validate-key",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            referer: "http://localhost:3000/reader/settings",
          },
          body: JSON.stringify({
            apiKey: "sk-ant-test-key-123",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(
        /Invalid request|Missing provider|Bad request|Invalid JSON/
      );
      expect(validateApiKey).not.toHaveBeenCalled();
    });

    it("should reject missing API key", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/validate-key",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            referer: "http://localhost:3000/reader/settings",
          },
          body: JSON.stringify({
            provider: "anthropic",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(
        /Invalid request|Missing provider|Bad request|Invalid JSON/
      );
      expect(validateApiKey).not.toHaveBeenCalled();
    });

    it("should reject unsupported provider", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/validate-key",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            referer: "http://localhost:3000/reader/settings",
          },
          body: JSON.stringify({
            provider: "unsupported-ai",
            apiKey: "some-key",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/Invalid provider|Bad request|Rate limit/);
      expect(validateApiKey).not.toHaveBeenCalled();
    });
  });

  describe("Timeout enforcement", () => {
    it.skip("should enforce 3-second timeout", async () => {
      // Mock validateApiKey to never resolve (simulating timeout)
      (validateApiKey as any).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/validate-key",
        {
          method: "POST",
          body: {
            provider: "anthropic",
            apiKey: "sk-ant-test-key-123",
          },
        }
      );

      // Use real timers for this test since AbortController doesn't work with fake timers
      vi.useRealTimers();

      const startTime = Date.now();
      const response = await POST(request);
      const endTime = Date.now();
      const data = await response.json();

      // Should timeout after ~3 seconds
      expect(endTime - startTime).toBeGreaterThanOrEqual(2900);
      expect(endTime - startTime).toBeLessThan(3500);

      expect(response.status).toBe(504);
      expect(data.error).toMatch(/Validation timeout|Request timeout/);

      // Reset to fake timers for other tests
      vi.useFakeTimers();
    });

    it("should complete successfully within timeout", async () => {
      vi.mocked(validateApiKey).mockResolvedValue({ valid: true });

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/validate-key",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            referer: "http://localhost:3000/reader/settings",
          },
          body: JSON.stringify({
            provider: "anthropic",
            apiKey: "sk-ant-test-key-123",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should handle service errors gracefully", async () => {
      (validateApiKey as any).mockRejectedValue(new Error("Network error"));

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/validate-key",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            referer: "http://localhost:3000/reader/settings",
          },
          body: JSON.stringify({
            provider: "anthropic",
            apiKey: "sk-ant-test-key-123",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Validation failed");
      expect(data.valid ?? false).toBe(false);
      expect(data.details).toBeUndefined(); // No error details exposed
    });

    it("should handle malformed JSON", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/validate-key",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            referer: "http://localhost:3000/reader/settings",
          },
          body: "invalid-json",
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(
        /Invalid request|Missing provider|Bad request|Invalid JSON/
      );
      expect(validateApiKey).not.toHaveBeenCalled();
    });
  });

  describe("Security requirements", () => {
    it("should not expose API key in error responses", async () => {
      (validateApiKey as any).mockRejectedValue(
        new Error("Invalid API key: sk-ant-test-key-123")
      );

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/validate-key",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            referer: "http://localhost:3000/reader/settings",
          },
          body: JSON.stringify({
            provider: "anthropic",
            apiKey: "sk-ant-test-key-123",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Validation failed");
      expect(JSON.stringify(data)).not.toContain("sk-ant-test-key-123");
    });

    it("should sanitize provider input", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/validate-key",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            referer: "http://localhost:3000/reader/settings",
          },
          body: JSON.stringify({
            provider: '<script>alert("xss")</script>',
            apiKey: "test-key",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/Invalid provider|Bad request|Rate limit/);
      expect(JSON.stringify(data)).not.toContain("<script>");
    });
  });
});
