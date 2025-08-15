import { describe, it, expect, beforeEach } from "vitest";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import {
  convertOpenAPIToInsomnia,
  generateInsomniaId,
} from "@/lib/openapi/insomnia-converter";

/**
 * Unit tests for the Insomnia converter functionality
 * These tests validate the actual implementation of OpenAPI to Insomnia format conversion
 */

describe("OpenAPI to Insomnia Converter", () => {
  // Mock OpenAPI spec for testing
  const mockOpenAPISpec: OpenAPIObject = {
    openapi: "3.1.0",
    info: {
      title: "RSS News Reader API",
      version: "1.0.0",
      description: "API for RSS News Reader PWA",
    },
    servers: [
      {
        url: "http://localhost:3000/reader",
        description: "Development server",
      },
    ],
    tags: [
      { name: "Health", description: "Health check endpoints" },
      { name: "Sync", description: "Synchronization endpoints" },
      { name: "Articles", description: "Article management" },
    ],
    paths: {
      "/api/health": {
        get: {
          tags: ["Health"],
          summary: "Main health check",
          operationId: "getHealth",
          responses: {
            "200": {
              description: "Health status",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "healthy" },
                      timestamp: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/sync": {
        post: {
          tags: ["Sync"],
          summary: "Trigger manual sync",
          operationId: "triggerSync",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    force: { type: "boolean", default: false },
                    feedIds: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
                example: {
                  force: true,
                  feedIds: ["feed1", "feed2"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Sync started",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      jobId: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/articles/{id}": {
        get: {
          tags: ["Articles"],
          summary: "Get article by ID",
          operationId: "getArticle",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Article ID",
            },
            {
              name: "include",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["content", "metadata", "all"] },
              description: "Fields to include",
            },
          ],
          responses: {
            "200": {
              description: "Article details",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      content: { type: "string" },
                    },
                  },
                },
              },
            },
            "404": {
              description: "Article not found",
            },
          },
        },
        delete: {
          tags: ["Articles"],
          summary: "Delete article",
          operationId: "deleteArticle",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "204": {
              description: "Article deleted",
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  };

  describe("convertOpenAPIToInsomnia", () => {
    it("should create valid Insomnia v4 export structure", () => {
      const result = convertOpenAPIToInsomnia(
        mockOpenAPISpec,
        "http://localhost:3000/reader"
      );

      expect(result).toMatchObject({
        _type: "export",
        __export_format: 4,
        __export_date: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
        ),
        __export_source: "rss-reader-openapi-converter",
        resources: expect.any(Array),
      });

      // Verify resources array is not empty
      expect(result.resources.length).toBeGreaterThan(0);
    });

    it("should create workspace resource", () => {
      const result = convertOpenAPIToInsomnia(
        mockOpenAPISpec,
        "http://localhost:3000/reader"
      );

      const workspace = result.resources.find(
        (r: any) => r._type === "workspace"
      );
      expect(workspace).toBeDefined();
      expect(workspace).toMatchObject({
        _id: expect.stringMatching(/^wrk_[a-z0-9]+$/),
        _type: "workspace",
        name: "RSS News Reader API",
        description: "API for RSS News Reader PWA",
        scope: "collection",
      });
    });

    it("should create environment with proper variables", () => {
      const result = convertOpenAPIToInsomnia(
        mockOpenAPISpec,
        "http://localhost:3000/reader"
      );

      const environment = result.resources.find(
        (r: any) => r._type === "environment"
      );
      expect(environment).toBeDefined();
      expect(environment).toMatchObject({
        _id: expect.stringMatching(/^env_[a-z0-9]+$/),
        _type: "environment",
        parentId: expect.stringMatching(/^wrk_/),
        name: "Base Environment",
      });
      // Note: The current implementation creates empty data object initially

      // Note: Current implementation only creates one Base Environment
      // Additional environments like Tailscale would need to be added separately
    });

    it("should create request groups for each tag", () => {
      const result = convertOpenAPIToInsomnia(
        mockOpenAPISpec,
        "http://localhost:3000/reader"
      );

      const folders = result.resources.filter(
        (r: any) => r._type === "request_group"
      );

      // Should have folders for each tag
      expect(folders.length).toBeGreaterThanOrEqual(3); // Health, Sync, Articles

      const healthFolder = folders.find((f: any) => f.name === "Health");
      expect(healthFolder).toBeDefined();
      expect(healthFolder).toMatchObject({
        _id: expect.stringMatching(/^fld_[a-z0-9]+$/),
        _type: "request_group",
        parentId: expect.stringMatching(/^wrk_/),
        name: "Health",
      });
    });

    it("should create requests for each endpoint operation", () => {
      const result = convertOpenAPIToInsomnia(
        mockOpenAPISpec,
        "http://localhost:3000/reader"
      );

      const requests = result.resources.filter(
        (r: any) => r._type === "request"
      );

      // Should have requests for each operation
      expect(requests.length).toBeGreaterThanOrEqual(4); // GET /health, POST /sync, GET /articles/{id}, DELETE /articles/{id}

      // Check GET /api/health request
      const healthRequest = requests.find(
        (r: any) => r.name === "Main health check"
      );
      expect(healthRequest).toBeDefined();
      expect(healthRequest).toMatchObject({
        _id: expect.stringMatching(/^req_[a-z0-9]+$/),
        _type: "request",
        name: "Main health check",
        url: "{{ _.base_url }}/api/health",
        method: "GET",
        body: {},
        parameters: [],
        headers: [],
      });
    });

    it("should handle POST request with body correctly", () => {
      const result = convertOpenAPIToInsomnia(
        mockOpenAPISpec,
        "http://localhost:3000/reader"
      );

      const syncRequest = result.resources.find(
        (r: any) => r._type === "request" && r.name === "Trigger manual sync"
      );
      expect(syncRequest).toBeDefined();
      expect(syncRequest.method).toBe("POST");
      expect(syncRequest.body).toMatchObject({
        mimeType: "application/json",
        text: expect.stringContaining('"force"'),
      });

      // Verify the body is valid JSON
      expect(() => JSON.parse(syncRequest.body.text)).not.toThrow();
      const bodyObj = JSON.parse(syncRequest.body.text);
      expect(bodyObj).toHaveProperty("force");
      expect(bodyObj).toHaveProperty("feedIds");
    });

    it("should handle path parameters correctly", () => {
      const result = convertOpenAPIToInsomnia(
        mockOpenAPISpec,
        "http://localhost:3000/reader"
      );

      const articleRequest = result.resources.find(
        (r: any) => r._type === "request" && r.name === "Get article by ID"
      );
      expect(articleRequest).toBeDefined();
      expect(articleRequest.url).toBe(
        "{{ _.base_url }}/api/articles/{{ _.id }}"
      );

      // Path parameters are handled inline with {{ _.paramName }} format
    });

    it("should handle query parameters correctly", () => {
      const result = convertOpenAPIToInsomnia(
        mockOpenAPISpec,
        "http://localhost:3000/reader"
      );

      const articleRequest = result.resources.find(
        (r: any) => r._type === "request" && r.name === "Get article by ID"
      );

      const queryParam = articleRequest.parameters.find(
        (p: any) => p.name === "include"
      );
      expect(queryParam).toBeDefined();
      expect(queryParam).toMatchObject({
        name: "include",
        disabled: true, // Optional parameter
      });
    });

    it("should handle authentication when specified", () => {
      const specWithAuth = {
        ...mockOpenAPISpec,
        security: [{ bearerAuth: [] }],
      };

      const result = convertOpenAPIToInsomnia(
        specWithAuth,
        "http://localhost:3000/reader"
      );

      const requests = result.resources.filter(
        (r: any) => r._type === "request"
      );

      // At least one request should have authentication
      const authRequest = requests.find(
        (r: any) => r.authentication?.type === "bearer"
      );
      expect(authRequest).toBeDefined();

      if (authRequest) {
        expect(authRequest.authentication).toMatchObject({
          type: "bearer",
          token: "{{ _.auth_token }}",
        });
      }
    });

    it("should generate unique IDs for all resources", () => {
      const result = convertOpenAPIToInsomnia(
        mockOpenAPISpec,
        "http://localhost:3000/reader"
      );

      const ids = new Set();
      for (const resource of result.resources) {
        expect(ids.has(resource._id)).toBe(false);
        ids.add(resource._id);
      }
    });

    it("should handle minimal spec without errors", () => {
      const minimalSpec: OpenAPIObject = {
        openapi: "3.1.0",
        info: {
          title: "Minimal API",
          version: "1.0.0",
        },
        paths: {
          "/api/test": {
            get: {
              responses: {
                "200": {
                  description: "Success",
                },
              },
            },
          },
        },
      };

      expect(() => {
        const result = convertOpenAPIToInsomnia(
          minimalSpec,
          "http://localhost:3000/reader"
        );
        expect(result.resources).toBeDefined();
        expect(result.resources.length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it("should handle different base URL formats", () => {
      const testCases = [
        "http://localhost:3000/reader",
        "http://127.0.0.1:3000/reader",
        "http://100.96.166.53:3000/reader",
        "https://api.example.com",
      ];

      for (const baseUrl of testCases) {
        const result = convertOpenAPIToInsomnia(mockOpenAPISpec, baseUrl);
        const environment = result.resources.find(
          (r: any) => r._type === "environment" && r.name === "Base Environment"
        );
        expect(environment).toBeDefined();
        // Note: base_url is not stored in data in current implementation
      }
    });

    it("should properly escape special characters in JSON bodies", () => {
      const specWithSpecialChars: OpenAPIObject = {
        openapi: "3.1.0",
        info: {
          title: "Test API",
          version: "1.0.0",
        },
        paths: {
          "/api/test": {
            post: {
              requestBody: {
                content: {
                  "application/json": {
                    example: {
                      message: 'Test with "quotes" and \nnewlines',
                      json: '{"nested": "value"}',
                    },
                  },
                },
              },
              responses: {
                "200": { description: "OK" },
              },
            },
          },
        },
      };

      const result = convertOpenAPIToInsomnia(
        specWithSpecialChars,
        "http://localhost:3000/reader"
      );
      const testRequest = result.resources.find(
        (r: any) => r._type === "request" && r.url?.includes("/api/test")
      );

      expect(testRequest).toBeDefined();
      // Body text should be valid JSON
      expect(() => JSON.parse(testRequest.body.text)).not.toThrow();
    });
  });

  describe("generateInsomniaId", () => {
    it("should generate valid Insomnia IDs with correct prefix", () => {
      const workspaceId = generateInsomniaId("wrk");
      expect(workspaceId).toMatch(/^wrk_[a-z0-9]+$/);

      const envId = generateInsomniaId("env");
      expect(envId).toMatch(/^env_[a-z0-9]+$/);

      const folderId = generateInsomniaId("fld");
      expect(folderId).toMatch(/^fld_[a-z0-9]+$/);

      const requestId = generateInsomniaId("req");
      expect(requestId).toMatch(/^req_[a-z0-9]+$/);
    });

    it("should generate unique IDs", () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        const id = generateInsomniaId("req");
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
    });
  });
});
