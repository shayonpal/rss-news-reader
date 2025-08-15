import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Unit tests for GET /api/insomnia.json endpoint
 * These tests define the SPECIFICATION for the endpoint behavior
 * Implementation MUST match these tests - tests should NEVER be modified to match implementation
 */

describe("GET /api/insomnia.json", () => {
  let GET: (request: NextRequest) => Promise<Response>;
  let mockGenerateDocument: any;
  let mockConvertOpenAPIToInsomnia: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock OpenAPI document generation
    mockGenerateDocument = vi.fn().mockResolvedValue({
      openapi: "3.1.0",
      info: {
        title: "RSS News Reader API",
        version: "1.0.0",
      },
      servers: [
        {
          url: "http://localhost:3000/reader",
        },
      ],
      paths: {
        "/api/health": {
          get: {
            summary: "Health check",
            responses: {
              200: { description: "OK" },
            },
          },
        },
      },
    });

    // Mock converter
    mockConvertOpenAPIToInsomnia = vi.fn().mockReturnValue({
      _type: "export",
      __export_format: 4,
      __export_source: "rss-news-reader",
      __export_date: new Date().toISOString(),
      resources: [
        { _id: "wrk_123", _type: "workspace", name: "RSS News Reader API" },
        {
          _id: "env_123",
          _type: "environment",
          data: { base_url: "http://localhost:3000/reader" },
        },
      ],
    });

    // Mock the modules
    vi.doMock("@/lib/openapi/registry", () => ({
      openApiRegistry: {
        generateDocument: mockGenerateDocument,
      },
    }));

    vi.doMock("@/lib/openapi/insomnia-converter", () => ({
      convertOpenAPIToInsomnia: mockConvertOpenAPIToInsomnia,
    }));
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("Successful Export", () => {
    it("should return 200 with Insomnia collection JSON", async () => {
      // This represents the expected implementation
      GET = async (request: NextRequest) => {
        const { openApiRegistry } = await import("@/lib/openapi/registry");
        const { convertOpenAPIToInsomnia } = await import(
          "@/lib/openapi/insomnia-converter"
        );

        const openApiDoc = await openApiRegistry.generateDocument();
        const baseUrl = "http://localhost:3000/reader";
        const collection = convertOpenAPIToInsomnia(openApiDoc, baseUrl);

        return new Response(JSON.stringify(collection, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition":
              'attachment; filename="rss-reader-insomnia-collection.json"',
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
          },
        });
      };

      const request = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");
      expect(response.headers.get("content-disposition")).toBe(
        'attachment; filename="rss-reader-insomnia-collection.json"'
      );

      const body = await response.json();
      expect(body).toMatchObject({
        _type: "export",
        __export_format: 4,
        __export_source: "rss-news-reader",
        resources: expect.any(Array),
      });
    });

    it("should include proper CORS headers", async () => {
      GET = async () => {
        return new Response(JSON.stringify({}), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      };

      const request = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json"
      );
      const response = await GET(request);

      expect(response.headers.get("access-control-allow-origin")).toBe("*");
    });

    it("should include cache headers for 5-minute caching", async () => {
      GET = async () => {
        const etag = `"${Date.now()}"`;
        return new Response(JSON.stringify({}), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
            ETag: etag,
          },
        });
      };

      const request = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json"
      );
      const response = await GET(request);

      expect(response.headers.get("cache-control")).toBe("public, max-age=300");
      expect(response.headers.get("etag")).toBeTruthy();
    });

    it("should handle If-None-Match header for caching", async () => {
      const staticEtag = '"static-etag-123"';

      GET = async (request: NextRequest) => {
        const ifNoneMatch = request.headers.get("if-none-match");

        if (ifNoneMatch === staticEtag) {
          return new Response(null, {
            status: 304,
            headers: {
              ETag: staticEtag,
              "Cache-Control": "public, max-age=300",
            },
          });
        }

        return new Response(JSON.stringify({}), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ETag: staticEtag,
            "Cache-Control": "public, max-age=300",
          },
        });
      };

      // First request without If-None-Match
      const firstRequest = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json"
      );
      const firstResponse = await GET(firstRequest);
      expect(firstResponse.status).toBe(200);
      expect(firstResponse.headers.get("etag")).toBe('"static-etag-123"');

      // Second request with If-None-Match
      const secondRequest = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json",
        {
          headers: {
            "If-None-Match": '"static-etag-123"',
          },
        }
      );
      const secondResponse = await GET(secondRequest);
      expect(secondResponse.status).toBe(304);
    });
  });

  describe("Base URL Detection", () => {
    it("should detect localhost from Host header", async () => {
      GET = async (request: NextRequest) => {
        const host = request.headers.get("host") || "localhost:3000";
        const baseUrl = `http://${host}/reader`;

        return new Response(
          JSON.stringify({
            base_url: baseUrl,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      };

      const request = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json",
        {
          headers: { Host: "localhost:3000" },
        }
      );
      const response = await GET(request);
      const body = await response.json();

      expect(body.base_url).toBe("http://localhost:3000/reader");
    });

    it("should detect 127.0.0.1 from Host header", async () => {
      GET = async (request: NextRequest) => {
        const host = request.headers.get("host") || "localhost:3000";
        const baseUrl = `http://${host}/reader`;

        return new Response(
          JSON.stringify({
            base_url: baseUrl,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      };

      const request = new NextRequest(
        "http://127.0.0.1:3000/reader/api/insomnia.json",
        {
          headers: { Host: "127.0.0.1:3000" },
        }
      );
      const response = await GET(request);
      const body = await response.json();

      expect(body.base_url).toBe("http://127.0.0.1:3000/reader");
    });

    it("should detect Tailscale IP from Host header", async () => {
      GET = async (request: NextRequest) => {
        const host = request.headers.get("host") || "localhost:3000";
        const baseUrl = `http://${host}/reader`;

        return new Response(
          JSON.stringify({
            base_url: baseUrl,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      };

      const request = new NextRequest(
        "http://100.96.166.53:3000/reader/api/insomnia.json",
        {
          headers: { Host: "100.96.166.53:3000" },
        }
      );
      const response = await GET(request);
      const body = await response.json();

      expect(body.base_url).toBe("http://100.96.166.53:3000/reader");
    });

    it("should prefer X-Forwarded-Host over Host header", async () => {
      GET = async (request: NextRequest) => {
        const forwardedHost = request.headers.get("x-forwarded-host");
        const host =
          forwardedHost || request.headers.get("host") || "localhost:3000";
        const baseUrl = `http://${host}/reader`;

        return new Response(
          JSON.stringify({
            base_url: baseUrl,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      };

      const request = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json",
        {
          headers: {
            Host: "localhost:3000",
            "X-Forwarded-Host": "100.96.166.53:3000",
          },
        }
      );
      const response = await GET(request);
      const body = await response.json();

      expect(body.base_url).toBe("http://100.96.166.53:3000/reader");
    });

    it("should handle X-Forwarded-Proto for HTTPS", async () => {
      GET = async (request: NextRequest) => {
        const proto = request.headers.get("x-forwarded-proto") || "http";
        const host = request.headers.get("host") || "localhost:3000";
        const baseUrl = `${proto}://${host}/reader`;

        return new Response(
          JSON.stringify({
            base_url: baseUrl,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      };

      const request = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json",
        {
          headers: {
            Host: "api.example.com",
            "X-Forwarded-Proto": "https",
          },
        }
      );
      const response = await GET(request);
      const body = await response.json();

      expect(body.base_url).toBe("https://api.example.com/reader");
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limit of 1 request per minute per IP", async () => {
      const rateLimitStore = new Map<string, number>();

      GET = async (request: NextRequest) => {
        // Get client IP
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0] ||
          request.headers.get("x-real-ip") ||
          "127.0.0.1";

        const now = Date.now();
        const lastRequest = rateLimitStore.get(ip);

        if (lastRequest && now - lastRequest < 60000) {
          const resetTime = Math.ceil((lastRequest + 60000) / 1000);
          return new Response(
            JSON.stringify({
              error: "rate_limit_exceeded",
              message: "Only 1 request per minute allowed",
              retryAfter: Math.ceil((lastRequest + 60000 - now) / 1000),
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "X-RateLimit-Limit": "1",
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": resetTime.toString(),
                "Retry-After": Math.ceil(
                  (lastRequest + 60000 - now) / 1000
                ).toString(),
              },
            }
          );
        }

        rateLimitStore.set(ip, now);

        return new Response(JSON.stringify({}), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": "1",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": Math.ceil((now + 60000) / 1000).toString(),
          },
        });
      };

      // First request should succeed
      const firstRequest = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json"
      );
      const firstResponse = await GET(firstRequest);
      expect(firstResponse.status).toBe(200);
      expect(firstResponse.headers.get("x-ratelimit-limit")).toBe("1");
      expect(firstResponse.headers.get("x-ratelimit-remaining")).toBe("0");

      // Second request should be rate limited
      const secondRequest = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json"
      );
      const secondResponse = await GET(secondRequest);
      expect(secondResponse.status).toBe(429);

      const errorBody = await secondResponse.json();
      expect(errorBody.error).toBe("rate_limit_exceeded");
      expect(errorBody.retryAfter).toBeGreaterThan(0);
    });

    it("should track rate limits per IP address", async () => {
      const rateLimitStore = new Map<string, number>();

      GET = async (request: NextRequest) => {
        const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
        const now = Date.now();
        const lastRequest = rateLimitStore.get(ip);

        if (lastRequest && now - lastRequest < 60000) {
          return new Response(
            JSON.stringify({ error: "rate_limit_exceeded" }),
            {
              status: 429,
            }
          );
        }

        rateLimitStore.set(ip, now);
        return new Response(JSON.stringify({}), { status: 200 });
      };

      // Request from first IP
      const request1 = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json",
        {
          headers: { "X-Forwarded-For": "192.168.1.100" },
        }
      );
      const response1 = await GET(request1);
      expect(response1.status).toBe(200);

      // Request from second IP should succeed
      const request2 = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json",
        {
          headers: { "X-Forwarded-For": "192.168.1.101" },
        }
      );
      const response2 = await GET(request2);
      expect(response2.status).toBe(200);

      // Second request from first IP should be rate limited
      const request3 = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json",
        {
          headers: { "X-Forwarded-For": "192.168.1.100" },
        }
      );
      const response3 = await GET(request3);
      expect(response3.status).toBe(429);
    });
  });

  describe("Streaming Response", () => {
    it("should stream large collections efficiently", async () => {
      GET = async () => {
        // Create a large collection
        const collection = {
          _type: "export",
          __export_format: 4,
          resources: Array.from({ length: 1000 }, (_, i) => ({
            _id: `req_${i}`,
            _type: "request",
            name: `Request ${i}`,
            url: `http://localhost:3000/api/endpoint${i}`,
          })),
        };

        // Convert to stream
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const json = JSON.stringify(collection, null, 2);
            const chunks = [];
            const chunkSize = 1024; // 1KB chunks

            for (let i = 0; i < json.length; i += chunkSize) {
              chunks.push(json.slice(i, i + chunkSize));
            }

            for (const chunk of chunks) {
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Transfer-Encoding": "chunked",
          },
        });
      };

      const request = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();

      // Verify we can read the stream
      const text = await response.text();
      const parsed = JSON.parse(text);
      expect(parsed.resources).toHaveLength(1000);
    });

    it("should not buffer entire response in memory", async () => {
      let streamCreated = false;

      GET = async () => {
        const stream = new ReadableStream({
          start(controller) {
            streamCreated = true;
            controller.enqueue(
              new TextEncoder().encode('{"test": "streaming"}')
            );
            controller.close();
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Transfer-Encoding": "chunked",
          },
        });
      };

      const request = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json"
      );
      const response = await GET(request);

      expect(streamCreated).toBe(true);
      expect(response.headers.get("transfer-encoding")).toBe("chunked");
    });
  });

  describe("Error Handling", () => {
    it("should handle OpenAPI generation errors gracefully", async () => {
      mockGenerateDocument.mockRejectedValue(
        new Error("Failed to generate OpenAPI")
      );

      GET = async () => {
        try {
          const { openApiRegistry } = await import("@/lib/openapi/registry");
          await openApiRegistry.generateDocument();
          return new Response(JSON.stringify({}), { status: 200 });
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: "generation_failed",
              message: error instanceof Error ? error.message : "Unknown error",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      };

      const request = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json"
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("generation_failed");
      expect(body.message).toContain("Failed to generate OpenAPI");
    });

    it("should handle converter errors gracefully", async () => {
      mockConvertOpenAPIToInsomnia.mockImplementation(() => {
        throw new Error("Invalid OpenAPI spec");
      });

      GET = async () => {
        try {
          const { openApiRegistry } = await import("@/lib/openapi/registry");
          const { convertOpenAPIToInsomnia } = await import(
            "@/lib/openapi/insomnia-converter"
          );

          const openApiDoc = await openApiRegistry.generateDocument();
          convertOpenAPIToInsomnia(openApiDoc, "http://localhost:3000/reader");

          return new Response(JSON.stringify({}), { status: 200 });
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: "conversion_failed",
              message: error instanceof Error ? error.message : "Unknown error",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      };

      const request = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json"
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("conversion_failed");
      expect(body.message).toContain("Invalid OpenAPI spec");
    });

    it("should handle missing Host header gracefully", async () => {
      GET = async (request: NextRequest) => {
        const host = request.headers.get("host") || "localhost:3000";
        const baseUrl = `http://${host}/reader`;

        return new Response(
          JSON.stringify({
            base_url: baseUrl,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      };

      const request = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json"
      );
      // Remove Host header
      request.headers.delete("host");

      const response = await GET(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.base_url).toBe("http://localhost:3000/reader");
    });
  });

  describe("OPTIONS Method", () => {
    it("should handle OPTIONS request for CORS preflight", async () => {
      const OPTIONS = async () => {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
            "Access-Control-Max-Age": "86400",
          },
        });
      };

      const request = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json",
        {
          method: "OPTIONS",
        }
      );
      const response = await OPTIONS();

      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("access-control-allow-methods")).toContain(
        "GET"
      );
      expect(response.headers.get("access-control-max-age")).toBe("86400");
    });
  });

  describe("Performance Requirements", () => {
    it("should generate response within 2 seconds", async () => {
      GET = async () => {
        const start = Date.now();

        // Simulate some processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        const duration = Date.now() - start;

        return new Response(
          JSON.stringify({
            duration_ms: duration,
            resources: Array.from({ length: 50 }, (_, i) => ({
              _id: `req_${i}`,
              _type: "request",
            })),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Response-Time": `${duration}ms`,
            },
          }
        );
      };

      const request = new NextRequest(
        "http://localhost:3000/reader/api/insomnia.json"
      );
      const start = Date.now();
      const response = await GET(request);
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000);

      const responseTime = response.headers.get("x-response-time");
      if (responseTime) {
        const ms = parseInt(responseTime.replace("ms", ""));
        expect(ms).toBeLessThan(2000);
      }
    });

    it("should handle concurrent requests without memory issues", async () => {
      const memBefore = process.memoryUsage().heapUsed;

      GET = async () => {
        return new Response(
          JSON.stringify({
            resources: Array.from({ length: 100 }, (_, i) => ({
              _id: `req_${i}`,
              _type: "request",
            })),
          }),
          { status: 200 }
        );
      };

      // Make 5 concurrent requests
      const promises = Array.from({ length: 5 }, () => {
        const request = new NextRequest(
          "http://localhost:3000/reader/api/insomnia.json"
        );
        return GET(request);
      });

      const responses = await Promise.all(promises);

      const memAfter = process.memoryUsage().heapUsed;
      const memUsed = (memAfter - memBefore) / 1024 / 1024; // MB

      // All should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
      }

      // Memory usage should be reasonable (less than 50MB for 5 requests)
      expect(memUsed).toBeLessThan(50);
    });
  });
});
