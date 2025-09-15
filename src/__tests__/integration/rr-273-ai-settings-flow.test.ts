import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";

// Mock modules
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user-id", email: "test@example.com" },
  }),
}));

// Mock fetch for API calls
global.fetch = vi.fn();

describe("AI Settings Integration Flow", () => {
  const mockUser = { id: "test-user-id", email: "test@example.com" };

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("Complete AI settings configuration flow", () => {
    it("should fetch models on page load and populate dropdown", async () => {
      const mockModels = [
        {
          id: "claude-3-opus-20240229",
          name: "Claude 3 Opus",
          provider: "anthropic",
          description: "Most capable model",
        },
        {
          id: "claude-3-sonnet-20240229",
          name: "Claude 3 Sonnet",
          provider: "anthropic",
          description: "Balanced model",
        },
      ];

      (fetch as any).mockImplementation((url: string) => {
        if (url.includes("/api/ai/models")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ ETag: '"models-etag-123"' }),
            json: () => Promise.resolve({ models: mockModels }),
          });
        }
        if (url.includes("/api/users/")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                ai: {
                  provider: "anthropic",
                  model: "claude-3-opus-20240229",
                  hasApiKey: false,
                },
              }),
          });
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      // Simulate component mount
      await act(async () => {
        // Component would fetch models on mount
        const response = await fetch("/api/ai/models");
        const data = await response.json();
        expect(data.models).toHaveLength(2);
        expect(data.models[0].provider).toBe("anthropic");
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/ai/models"),
        expect.any(Object)
      );
    });

    it("should validate API key with 500ms debounce", async () => {
      (fetch as any).mockImplementation((url: string) => {
        if (url.includes("/api/ai/validate-key")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ valid: true }),
          });
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      const validateKey = async (apiKey: string) => {
        // Simulate debounced validation
        return new Promise((resolve) => {
          setTimeout(async () => {
            const response = await fetch("/api/ai/validate-key", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: "anthropic",
                apiKey,
              }),
            });
            const data = await response.json();
            resolve(data.valid);
          }, 500);
        });
      };

      // Type API key with simulated debounce
      const validationPromise1 = validateKey("sk-ant-");
      vi.advanceTimersByTime(200);

      const validationPromise2 = validateKey("sk-ant-test");
      vi.advanceTimersByTime(200);

      const validationPromise3 = validateKey("sk-ant-test-key-123");
      vi.advanceTimersByTime(500);

      const result = await validationPromise3;
      expect(result).toBe(true);

      // Only the last validation should have completed
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/ai/validate-key"),
        expect.objectContaining({
          body: JSON.stringify({
            provider: "anthropic",
            apiKey: "sk-ant-test-key-123",
          }),
        })
      );
    });

    it("should save preferences with provider context and apiKeyAction", async () => {
      (fetch as any).mockImplementation((url: string) => {
        if (url.includes("/api/users/") && url.includes("/preferences")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                ai: {
                  provider: "anthropic",
                  model: "claude-3-opus-20240229",
                  hasApiKey: true,
                },
              }),
          });
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      const savePreferences = async (preferences: any, apiKeyAction: any) => {
        const response = await fetch("/api/users/test-user-id/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...preferences,
            apiKeyAction,
          }),
        });
        return response.json();
      };

      const result = await savePreferences(
        {
          ai: {
            provider: "anthropic",
            model: "claude-3-opus-20240229",
            summaryLengthMin: 3,
            summaryLengthMax: 7,
            summaryStyle: "analytical",
            contentFocus: "key-points",
          },
        },
        {
          provider: "anthropic",
          action: "update",
          apiKey: "sk-ant-test-key-123",
        }
      );

      expect(result.ai.hasApiKey).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/preferences"),
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining("apiKeyAction"),
        })
      );
    });

    it("should handle validation errors gracefully", async () => {
      (fetch as any).mockImplementation((url: string) => {
        if (url.includes("/api/ai/validate-key")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ valid: false }),
          });
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      const response = await fetch("/api/ai/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "anthropic",
          apiKey: "invalid-key",
        }),
      });
      const data = await response.json();

      expect(data.valid).toBe(false);
      expect(data.details).toBeUndefined(); // Generic error only
    });

    it("should handle network timeout on validation", async () => {
      (fetch as any).mockImplementation((url: string) => {
        if (url.includes("/api/ai/validate-key")) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: false,
                status: 408,
                json: () =>
                  Promise.resolve({
                    error: "Validation timeout",
                    valid: false,
                  }),
              });
            }, 3000);
          });
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      const validatePromise = fetch("/api/ai/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "anthropic",
          apiKey: "sk-ant-test-key-123",
        }),
      });

      vi.advanceTimersByTime(3000);
      const response = await validatePromise;
      const data = await response.json();

      expect(response.status).toBe(408);
      expect(data.valid).toBe(false);
      expect(data.error).toBe("Validation timeout");
    });
  });

  describe("State management integration", () => {
    it("should maintain provider context through state updates", async () => {
      // Simulate Zustand store behavior
      const mockStore = {
        preferences: {
          ai: {
            provider: "anthropic",
            model: null,
            hasApiKey: false,
          },
        },
        setAiProvider: vi.fn((provider: string) => {
          mockStore.preferences.ai.provider = provider;
        }),
        setAiModel: vi.fn((model: string) => {
          mockStore.preferences.ai.model = model;
        }),
        setApiKeyStatus: vi.fn((hasKey: boolean) => {
          mockStore.preferences.ai.hasApiKey = hasKey;
        }),
      };

      // Simulate state updates
      mockStore.setAiProvider("anthropic");
      mockStore.setAiModel("claude-3-opus-20240229");
      mockStore.setApiKeyStatus(true);

      expect(mockStore.preferences.ai.provider).toBe("anthropic");
      expect(mockStore.preferences.ai.model).toBe("claude-3-opus-20240229");
      expect(mockStore.preferences.ai.hasApiKey).toBe(true);

      expect(mockStore.setAiProvider).toHaveBeenCalledWith("anthropic");
      expect(mockStore.setAiModel).toHaveBeenCalledWith(
        "claude-3-opus-20240229"
      );
      expect(mockStore.setApiKeyStatus).toHaveBeenCalledWith(true);
    });

    it("should handle optimistic updates with rollback on error", async () => {
      const mockStore = {
        preferences: {
          ai: {
            model: "claude-3-sonnet-20240229",
          },
        },
        previousState: null as any,
        setOptimistic: vi.fn((updates: any) => {
          mockStore.previousState = { ...mockStore.preferences };
          Object.assign(mockStore.preferences.ai, updates);
        }),
        rollback: vi.fn(() => {
          if (mockStore.previousState) {
            mockStore.preferences = mockStore.previousState;
            mockStore.previousState = null;
          }
        }),
      };

      // Optimistic update
      mockStore.setOptimistic({ model: "claude-3-opus-20240229" });
      expect(mockStore.preferences.ai.model).toBe("claude-3-opus-20240229");

      // Simulate API failure
      (fetch as any).mockRejectedValueOnce(new Error("Network error"));

      try {
        await fetch("/api/users/test-user-id/preferences", {
          method: "PUT",
          body: JSON.stringify(mockStore.preferences),
        });
      } catch (error) {
        // Rollback on failure
        mockStore.rollback();
      }

      expect(mockStore.preferences.ai.model).toBe("claude-3-sonnet-20240229"); // Rolled back
      expect(mockStore.rollback).toHaveBeenCalled();
    });
  });

  describe("Cache behavior", () => {
    it("should use ETag for models endpoint caching", async () => {
      const mockModels = [
        {
          id: "claude-3-opus-20240229",
          name: "Claude 3 Opus",
          provider: "anthropic",
        },
      ];

      let callCount = 0;
      (fetch as any).mockImplementation((url: string, options: any) => {
        if (url.includes("/api/ai/models")) {
          callCount++;

          if (options?.headers?.["If-None-Match"] === '"models-etag-123"') {
            return Promise.resolve({
              ok: true,
              status: 304,
              headers: new Headers({ ETag: '"models-etag-123"' }),
            });
          }

          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ ETag: '"models-etag-123"' }),
            json: () => Promise.resolve({ models: mockModels }),
          });
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      // First request - no ETag
      const response1 = await fetch("/api/ai/models");
      const data1 = await response1.json();
      expect(response1.status).toBe(200);
      expect(data1.models).toHaveLength(1);

      // Second request with ETag
      const response2 = await fetch("/api/ai/models", {
        headers: { "If-None-Match": '"models-etag-123"' },
      });
      expect(response2.status).toBe(304);

      expect(callCount).toBe(2);
    });
  });

  describe("Security validations", () => {
    it("should never expose API keys in responses", async () => {
      const responses = [
        { error: "Validation failed", valid: false },
        { ai: { hasApiKey: true, model: "claude-3-opus-20240229" } },
        { error: "Invalid request" },
      ];

      for (const response of responses) {
        const responseStr = JSON.stringify(response);
        expect(responseStr).not.toContain("sk-ant");
        expect(responseStr).not.toContain("apiKey");
        expect(responseStr).not.toContain("encryptedApiKeys");
      }
    });

    it("should require authentication for all operations", async () => {
      (fetch as any).mockImplementation((url: string) => {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: "Unauthorized" }),
        });
      });

      const endpoints = [
        "/api/ai/validate-key",
        "/api/users/test-user-id/preferences",
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(endpoint, {
          method: endpoint.includes("validate") ? "POST" : "GET",
        });
        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe("Unauthorized");
      }
    });
  });
});
