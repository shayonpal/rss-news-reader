import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, PUT } from "@/app/api/users/[id]/preferences/route";
import { NextRequest } from "next/server";
import { encryptApiKey, decryptApiKey } from "@/lib/services/encryption";
import { createClient } from "@/lib/supabase/server";

// Mock our server wrapper
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/services/encryption", () => ({
  encryptApiKey: vi.fn(),
  decryptApiKey: vi.fn(),
}));

describe("Enhanced Preferences API with Provider Support", () => {
  let mockSupabase: any;
  const userId = "test-user-id";

  beforeEach(() => {
    // Create a full chainable mock
    const chainableObject = {
      from: vi.fn(),
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
      update: vi.fn(),
    };

    // Make each method return the chainable object
    chainableObject.from.mockReturnValue(chainableObject);
    chainableObject.select.mockReturnValue(chainableObject);
    chainableObject.eq.mockReturnValue(chainableObject);
    chainableObject.update.mockReturnValue(chainableObject);

    mockSupabase = chainableObject;

    // Mock the createClient to return our mock
    (createClient as any).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/users/[id]/preferences", () => {
    it("should include provider in response structure", async () => {
      const mockPreferences = {
        ai: {
          provider: "anthropic",
          model: "claude-3-opus-20240229",
          summaryLengthMin: 3,
          summaryLengthMax: 7,
          summaryStyle: "analytical",
          contentFocus: "key-points",
        },
        encryptedApiKeys: {
          anthropic: "encrypted-key-data",
        },
      };

      // Mock for all calls to single
      mockSupabase.single.mockImplementation(() =>
        Promise.resolve({
          data: {
            id: userId,
            preferences: mockPreferences,
          },
          error: null,
        })
      );

      const request = new NextRequest(
        `http://localhost:3000/api/users/${userId}/preferences`
      );
      const response = await GET(request, { params: { id: userId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ai.provider).toBe("anthropic");
      expect(data.ai.hasApiKey).toBe(true);
      expect(data.ai.apiKey).toBeUndefined(); // Never expose actual key
      expect(data.encryptedApiKeys).toBeUndefined(); // Never expose encrypted data
    });

    it("should default to anthropic for legacy data without provider", async () => {
      const mockLegacyPreferences = {
        ai: {
          model: "claude-3-opus-20240229",
          summaryLengthMin: 3,
          summaryLengthMax: 7,
        },
      };

      mockSupabase.single.mockImplementation(() =>
        Promise.resolve({
          data: {
            id: userId,
            preferences: mockLegacyPreferences,
          },
          error: null,
        })
      );

      const request = new NextRequest(
        `http://localhost:3000/api/users/${userId}/preferences`
      );
      const response = await GET(request, { params: { id: userId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ai.provider).toBe("anthropic"); // Default added
      expect(data.ai.hasApiKey).toBe(false);
    });

    it("should mask API key as hasApiKey boolean", async () => {
      const mockPreferences = {
        ai: {
          provider: "anthropic",
          model: "claude-3-opus-20240229",
        },
        encryptedApiKeys: {
          anthropic: "encrypted-key-data",
        },
      };

      mockSupabase.single.mockImplementation(() =>
        Promise.resolve({
          data: {
            id: userId,
            preferences: mockPreferences,
          },
          error: null,
        })
      );

      const request = new NextRequest(
        `http://localhost:3000/api/users/${userId}/preferences`
      );
      const response = await GET(request, { params: { id: userId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ai.hasApiKey).toBe(true);
      expect(data.ai.apiKey).toBeUndefined();
      expect(data.encryptedApiKeys).toBeUndefined();
    });
  });

  describe("PUT /api/users/[id]/preferences", () => {
    describe("apiKeyAction protocol", () => {
      it("should handle update action with new API key", async () => {
        (encryptApiKey as any).mockResolvedValue("new-encrypted-key");
        mockSupabase.single.mockImplementation(() =>
          Promise.resolve({
            data: {
              id: userId,
              preferences: {},
            },
            error: null,
          })
        );
        mockSupabase.update.mockReturnThis();
        mockSupabase.eq.mockResolvedValue({
          data: { id: userId },
          error: null,
        });

        const request = new NextRequest(
          `http://localhost:3000/api/users/${userId}/preferences`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ai: {
                provider: "anthropic",
                model: "claude-3-opus-20240229",
              },
              apiKeyAction: {
                provider: "anthropic",
                action: "update",
                apiKey: "sk-ant-new-key-123",
              },
            }),
          }
        );

        const response = await PUT(request, { params: { id: userId } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(encryptApiKey).toHaveBeenCalledWith("sk-ant-new-key-123");
        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            preferences: expect.objectContaining({
              encryptedApiKeys: {
                anthropic: "new-encrypted-key",
              },
            }),
          })
        );
      });

      it("should handle keep action without modifying key", async () => {
        const existingPreferences = {
          ai: {
            provider: "anthropic",
            model: "claude-3-sonnet-20240229",
          },
          encryptedApiKeys: {
            anthropic: "existing-encrypted-key",
          },
        };

        mockSupabase.single.mockImplementation(() =>
          Promise.resolve({
            data: {
              id: userId,
              preferences: existingPreferences,
            },
            error: null,
          })
        );
        mockSupabase.update.mockReturnThis();
        mockSupabase.eq.mockResolvedValue({
          data: { id: userId },
          error: null,
        });

        const request = new NextRequest(
          `http://localhost:3000/api/users/${userId}/preferences`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ai: {
                provider: "anthropic",
                model: "claude-3-opus-20240229", // Changed model
              },
              apiKeyAction: {
                provider: "anthropic",
                action: "keep",
              },
            }),
          }
        );

        const response = await PUT(request, { params: { id: userId } });

        expect(response.status).toBe(200);
        expect(encryptApiKey).not.toHaveBeenCalled();
        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            preferences: expect.objectContaining({
              encryptedApiKeys: {
                anthropic: "existing-encrypted-key", // Preserved
              },
            }),
          })
        );
      });

      it("should handle clear action to remove API key", async () => {
        mockSupabase.single.mockImplementation(() =>
          Promise.resolve({
            data: {
              id: userId,
              preferences: {
                encryptedApiKeys: { anthropic: "old-key" },
              },
            },
            error: null,
          })
        );
        mockSupabase.update.mockReturnThis();
        mockSupabase.eq.mockResolvedValue({
          data: { id: userId },
          error: null,
        });

        const request = new NextRequest(
          `http://localhost:3000/api/users/${userId}/preferences`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ai: {
                provider: "anthropic",
                model: "claude-3-opus-20240229",
              },
              apiKeyAction: {
                provider: "anthropic",
                action: "clear",
              },
            }),
          }
        );

        const response = await PUT(request, { params: { id: userId } });

        expect(response.status).toBe(200);
        expect(encryptApiKey).not.toHaveBeenCalled();
        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            preferences: expect.objectContaining({
              encryptedApiKeys: {}, // Cleared
            }),
          })
        );
      });
    });

    describe("Provider-specific key storage", () => {
      it("should store keys separately per provider", async () => {
        (encryptApiKey as any).mockResolvedValue("encrypted-anthropic-key");

        const existingPreferences = {
          encryptedApiKeys: {
            openai: "existing-openai-key", // Different provider
          },
        };

        mockSupabase.single.mockImplementation(() =>
          Promise.resolve({
            data: {
              id: userId,
              preferences: existingPreferences,
            },
            error: null,
          })
        );
        mockSupabase.update.mockReturnThis();
        mockSupabase.eq.mockResolvedValue({
          data: { id: userId },
          error: null,
        });

        const request = new NextRequest(
          `http://localhost:3000/api/users/${userId}/preferences`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ai: {
                provider: "anthropic",
                model: "claude-3-opus-20240229",
              },
              apiKeyAction: {
                provider: "anthropic",
                action: "update",
                apiKey: "sk-ant-key-123",
              },
            }),
          }
        );

        const response = await PUT(request, { params: { id: userId } });

        expect(response.status).toBe(200);
        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            preferences: expect.objectContaining({
              encryptedApiKeys: {
                openai: "existing-openai-key", // Preserved
                anthropic: "encrypted-anthropic-key", // Added
              },
            }),
          })
        );
      });
    });

    describe("Input validation", () => {
      it("should clamp summaryLength values to 1-10 range", async () => {
        mockSupabase.single.mockImplementation(() =>
          Promise.resolve({
            data: {
              id: userId,
              preferences: {},
            },
            error: null,
          })
        );
        mockSupabase.update.mockReturnThis();
        mockSupabase.eq.mockResolvedValue({
          data: { id: userId },
          error: null,
        });

        const request = new NextRequest(
          `http://localhost:3000/api/users/${userId}/preferences`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ai: {
                provider: "anthropic",
                model: "claude-3-opus-20240229",
                summaryLengthMin: -5, // Below minimum
                summaryLengthMax: 15, // Above maximum
              },
            }),
          }
        );

        const response = await PUT(request, { params: { id: userId } });

        expect(response.status).toBe(200);
        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            preferences: expect.objectContaining({
              ai: expect.objectContaining({
                summaryLengthMin: 1, // Clamped to minimum
                summaryLengthMax: 10, // Clamped to maximum
              }),
            }),
          })
        );
      });

      it("should validate summaryStyle enum values", async () => {
        const request = new NextRequest(
          `http://localhost:3000/api/users/${userId}/preferences`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ai: {
                provider: "anthropic",
                summaryStyle: "invalid-style",
              },
            }),
          }
        );

        const response = await PUT(request, { params: { id: userId } });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Invalid summary style");
      });

      it("should sanitize input to prevent injection", async () => {
        const request = new NextRequest(
          `http://localhost:3000/api/users/${userId}/preferences`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ai: {
                provider: '<script>alert("xss")</script>',
                model: "claude-3-opus-20240229",
              },
            }),
          }
        );

        const response = await PUT(request, { params: { id: userId } });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Invalid provider");
        expect(JSON.stringify(data)).not.toContain("<script>");
      });
    });

    describe("Backward compatibility", () => {
      it("should maintain compatibility with requests without provider", async () => {
        mockSupabase.single.mockImplementation(() =>
          Promise.resolve({
            data: {
              id: userId,
              preferences: {},
            },
            error: null,
          })
        );
        mockSupabase.update.mockReturnThis();
        mockSupabase.eq.mockResolvedValue({
          data: { id: userId },
          error: null,
        });

        const request = new NextRequest(
          `http://localhost:3000/api/users/${userId}/preferences`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ai: {
                model: "claude-3-opus-20240229", // No provider
                summaryLengthMin: 3,
                summaryLengthMax: 7,
              },
            }),
          }
        );

        const response = await PUT(request, { params: { id: userId } });

        expect(response.status).toBe(200);
        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            preferences: expect.objectContaining({
              ai: expect.objectContaining({
                provider: "anthropic", // Default added
                model: "claude-3-opus-20240229",
              }),
            }),
          })
        );
      });
    });
  });
});
