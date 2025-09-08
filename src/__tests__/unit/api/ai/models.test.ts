import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/ai/models/route";
import { NextRequest } from "next/server";
import {
  createAuthenticatedRequest,
  createUnauthenticatedRequest,
} from "@/__tests__/helpers/api-test-utils";

describe("GET /api/ai/models", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Successful responses", () => {
    it("should return Anthropic models with provider field", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/models"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.models).toBeDefined();
      expect(data.models.length).toBeGreaterThan(0);
      expect(data.models.every((m: any) => m.provider === "anthropic")).toBe(
        true
      );

      // Verify expected model structure
      const firstModel = data.models[0];
      expect(firstModel).toHaveProperty("id");
      expect(firstModel).toHaveProperty("name");
      expect(firstModel).toHaveProperty("provider", "anthropic");
      expect(firstModel).toHaveProperty("description");
    });

    it("should include ETag header for caching", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/models"
      );
      const response = await GET(request);

      expect(response.headers.get("ETag")).toBeTruthy();
      expect(response.headers.get("Cache-Control")).toBe(
        "private, max-age=300"
      );
    });

    it("should return 304 Not Modified when ETag matches", async () => {
      // First request to get ETag
      const request1 = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/models"
      );
      const response1 = await GET(request1);
      const etag = response1.headers.get("ETag");

      // Second request with If-None-Match
      const request2 = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/models",
        {
          headers: {
            "If-None-Match": etag!,
          },
        }
      );
      const response2 = await GET(request2);

      expect(response2.status).toBe(304);
      expect(response2.headers.get("ETag")).toBe(etag);
    });
  });

  describe("Authentication", () => {
    it("should require authentication", async () => {
      const request = createUnauthenticatedRequest(
        "http://localhost:3000/api/ai/models"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toMatch(/Invalid request origin|Unauthorized/);
    });

    it("should accept requests from authorized origins", async () => {
      const authorizedUrls = [
        "http://localhost:3000/api/ai/models",
        "http://100.96.166.53:3000/api/ai/models",
      ];

      for (const url of authorizedUrls) {
        const request = createAuthenticatedRequest(url);
        const response = await GET(request);
        expect(response.status).toBe(200);
      }
    });
  });

  describe("Cache behavior", () => {
    it("should set appropriate cache headers", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/models"
      );
      const response = await GET(request);

      const cacheControl = response.headers.get("Cache-Control");
      expect(cacheControl).toContain("max-age=300");
      expect(cacheControl).toContain("private");
    });

    it("should generate consistent ETags for same data", async () => {
      const request1 = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/models"
      );
      const response1 = await GET(request1);
      const etag1 = response1.headers.get("ETag");

      const request2 = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/models"
      );
      const response2 = await GET(request2);
      const etag2 = response2.headers.get("ETag");

      expect(etag1).toBe(etag2);
    });
  });

  describe("Model filtering", () => {
    it("should only return Anthropic models", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/ai/models"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.models.every((m: any) => m.provider === "anthropic")).toBe(
        true
      );
      expect(
        data.models.find((m: any) => m.provider === "openai")
      ).toBeUndefined();
    });
  });
});
