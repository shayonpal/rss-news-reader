import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestServer } from "./test-server";
import type { Server } from "http";

describe("Insomnia Export API Integration", () => {
  let server: Server;
  let app: any;
  const TEST_PORT = 3008; // Use unique port for this test

  beforeAll(async () => {
    const testServer = await setupTestServer(TEST_PORT);
    server = testServer.server;
    app = testServer.app;

    await new Promise<void>((resolve) => {
      server.listen(TEST_PORT, resolve);
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (app) {
      await app.close();
    }
  });

  describe("GET /api/insomnia.json", () => {
    it("should return valid Insomnia v4 collection with localhost base URL", async () => {
      // Test Contract: GET request with localhost Host → Insomnia collection with localhost base_url
      const response = await fetch(`http://localhost:${TEST_PORT}/reader/api/insomnia.json`, {
        headers: {
          "Host": "localhost:3000"
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(response.headers.get("content-disposition")).toBe(
        'attachment; filename="rss-reader-insomnia-collection.json"'
      );

      const collection = await response.json();

      // Validate Insomnia v4 format
      expect(collection).toMatchObject({
        _type: "export",
        __export_format: 4,
        __export_source: "rss-news-reader",
        resources: expect.arrayContaining([
          expect.objectContaining({
            _type: "workspace",
            name: "RSS News Reader API"
          }),
          expect.objectContaining({
            _type: "environment",
            data: expect.objectContaining({
              base_url: "http://localhost:3000/reader"
            })
          })
        ])
      });

      // Verify all documented endpoints are included
      const requests = collection.resources.filter((r: any) => r._type === "request");
      expect(requests.length).toBeGreaterThan(0);
      
      // Check for health endpoints as baseline
      const healthRequests = requests.filter((r: any) => 
        r.url?.includes("/api/health")
      );
      expect(healthRequests.length).toBeGreaterThanOrEqual(6); // 6 health endpoints documented
    });

    it("should detect and use 127.0.0.1 from Host header", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/reader/api/insomnia.json`, {
        headers: {
          "Host": "127.0.0.1:3000"
        }
      });

      expect(response.status).toBe(200);
      const collection = await response.json();

      const env = collection.resources.find((r: any) => r._type === "environment");
      expect(env?.data?.base_url).toBe("http://127.0.0.1:3000/reader");
    });

    it("should detect and use Tailscale IP from Host header", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/reader/api/insomnia.json`, {
        headers: {
          "Host": "100.96.166.53:3000"
        }
      });

      expect(response.status).toBe(200);
      const collection = await response.json();

      const env = collection.resources.find((r: any) => r._type === "environment");
      expect(env?.data?.base_url).toBe("http://100.96.166.53:3000/reader");
    });

    it("should use X-Forwarded-Host header when present", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/reader/api/insomnia.json`, {
        headers: {
          "X-Forwarded-Host": "100.96.166.53:3000",
          "Host": "localhost:3000" // Should be overridden by X-Forwarded-Host
        }
      });

      expect(response.status).toBe(200);
      const collection = await response.json();

      const env = collection.resources.find((r: any) => r._type === "environment");
      expect(env?.data?.base_url).toBe("http://100.96.166.53:3000/reader");
    });

    it("should include cache headers for 5-minute caching", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/reader/api/insomnia.json`);

      expect(response.status).toBe(200);
      
      // Check cache headers
      const cacheControl = response.headers.get("cache-control");
      expect(cacheControl).toContain("public");
      expect(cacheControl).toContain("max-age=300"); // 5 minutes = 300 seconds
      
      // Should have ETag for cache validation
      expect(response.headers.get("etag")).toBeTruthy();
    });

    it("should respect If-None-Match header for caching", async () => {
      // First request to get ETag
      const firstResponse = await fetch(`http://localhost:${TEST_PORT}/reader/api/insomnia.json`);
      const etag = firstResponse.headers.get("etag");
      expect(etag).toBeTruthy();

      // Second request with If-None-Match
      const cachedResponse = await fetch(`http://localhost:${TEST_PORT}/reader/api/insomnia.json`, {
        headers: {
          "If-None-Match": etag!
        }
      });

      // Should return 304 Not Modified
      expect(cachedResponse.status).toBe(304);
    });

    it("should enforce rate limiting (1 request per minute per IP)", async () => {
      // Make first request - should succeed
      const firstResponse = await fetch(`http://localhost:${TEST_PORT}/reader/api/insomnia.json`);
      expect(firstResponse.status).toBe(200);

      // Check rate limit headers
      expect(firstResponse.headers.get("x-ratelimit-limit")).toBe("1");
      expect(firstResponse.headers.get("x-ratelimit-remaining")).toBe("0");
      expect(firstResponse.headers.get("x-ratelimit-reset")).toBeTruthy();

      // Immediate second request should be rate limited
      const secondResponse = await fetch(`http://localhost:${TEST_PORT}/reader/api/insomnia.json`);
      expect(secondResponse.status).toBe(429); // Too Many Requests

      const errorBody = await secondResponse.json();
      expect(errorBody).toMatchObject({
        error: "rate_limit_exceeded",
        message: expect.stringContaining("1 request per minute"),
        retryAfter: expect.any(Number)
      });
    });

    it("should stream large collections efficiently", async () => {
      // Measure memory before request
      const memBefore = process.memoryUsage().heapUsed;

      const response = await fetch(`http://localhost:${TEST_PORT}/reader/api/insomnia.json`);
      expect(response.status).toBe(200);

      // Should support streaming
      const reader = response.body?.getReader();
      expect(reader).toBeDefined();

      let totalSize = 0;
      let chunks = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          totalSize += value.length;
          chunks++;
        }
      }

      // Measure memory after streaming
      const memAfter = process.memoryUsage().heapUsed;
      const memUsed = (memAfter - memBefore) / 1024 / 1024; // Convert to MB

      // Memory usage should be reasonable (less than 10MB for typical collection)
      expect(memUsed).toBeLessThan(10);
      
      // Should have received data in chunks
      expect(chunks).toBeGreaterThan(0);
      expect(totalSize).toBeGreaterThan(0);
    });

    it("should handle errors gracefully when OpenAPI spec is unavailable", async () => {
      // Mock scenario where OpenAPI spec generation fails
      // This would typically happen if registry.ts has errors
      
      // For now, we'll test that the endpoint exists and returns JSON
      const response = await fetch(`http://localhost:${TEST_PORT}/reader/api/insomnia.json`);
      
      if (response.status === 500) {
        const error = await response.json();
        expect(error).toMatchObject({
          error: expect.stringContaining("generation_failed"),
          message: expect.any(String)
        });
      } else {
        expect(response.status).toBe(200);
      }
    });

    it("should include all HTTP methods for documented endpoints", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/reader/api/insomnia.json`);
      expect(response.status).toBe(200);
      
      const collection = await response.json();
      const requests = collection.resources.filter((r: any) => r._type === "request");
      
      // Check for variety of HTTP methods
      const methods = new Set(requests.map((r: any) => r.method));
      
      // Should have at least GET and POST methods
      expect(methods.has("GET")).toBe(true);
      expect(methods.has("POST")).toBe(true);
      
      // May also have PUT, DELETE, PATCH depending on documented endpoints
      // Don't assert on these as they depend on current API documentation state
    });

    it("should organize requests into folders by tags", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/reader/api/insomnia.json`);
      expect(response.status).toBe(200);
      
      const collection = await response.json();
      
      // Find request groups (folders)
      const folders = collection.resources.filter((r: any) => r._type === "request_group");
      const requests = collection.resources.filter((r: any) => r._type === "request");
      
      // Should have folders for organization
      expect(folders.length).toBeGreaterThan(0);
      
      // Each request should have a parentId linking to a folder
      for (const request of requests) {
        if (request.parentId) {
          const parentFolder = folders.find((f: any) => f._id === request.parentId);
          expect(parentFolder).toBeDefined();
        }
      }
    });

    it("should include request examples from OpenAPI spec", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/reader/api/insomnia.json`);
      expect(response.status).toBe(200);
      
      const collection = await response.json();
      const requests = collection.resources.filter((r: any) => r._type === "request");
      
      // Find POST requests which should have body examples
      const postRequests = requests.filter((r: any) => r.method === "POST");
      
      for (const request of postRequests) {
        if (request.body) {
          expect(request.body).toHaveProperty("mimeType");
          expect(request.body.mimeType).toBe("application/json");
          
          // Body text should be valid JSON
          if (request.body.text) {
            expect(() => JSON.parse(request.body.text)).not.toThrow();
          }
        }
      }
    });
  });

  describe("Performance Constraints", () => {
    it("should complete export within 2 seconds", async () => {
      const startTime = Date.now();
      
      const response = await fetch(`http://localhost:${TEST_PORT}/reader/api/insomnia.json`);
      expect(response.status).toBe(200);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 2 seconds even with all endpoints
      expect(duration).toBeLessThan(2000);
    });

    it("should handle concurrent requests within memory limits", async () => {
      // Test memory safety with 3 concurrent requests
      const promises = Array.from({ length: 3 }, (_, i) => 
        fetch(`http://localhost:${TEST_PORT}/reader/api/insomnia.json`, {
          headers: {
            "X-Request-ID": `test-${i}`,
            "X-Forwarded-For": `192.168.1.${100 + i}` // Different IPs to avoid rate limit
          }
        })
      );
      
      const responses = await Promise.all(promises);
      
      // At least first request should succeed
      expect(responses[0].status).toBe(200);
      
      // Others may be rate limited or succeed depending on timing
      for (const response of responses) {
        expect([200, 429]).toContain(response.status);
      }
    });
  });
});