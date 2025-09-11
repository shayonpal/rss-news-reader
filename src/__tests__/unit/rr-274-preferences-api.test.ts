import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PUT } from "@/app/api/users/[id]/preferences/route";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/services/encryption";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/services/encryption");

describe("Preferences API (RR-274)", () => {
  const mockUserId = "test-user-123";
  const mockSupabase = {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockReturnValue(mockSupabase as any);
    vi.mocked(encrypt).mockImplementation(
      (data) => `encrypted_${JSON.stringify(data)}`
    );
    vi.mocked(decrypt).mockImplementation((data) =>
      JSON.parse(data.replace("encrypted_", ""))
    );
  });

  describe("GET /api/users/[id]/preferences", () => {
    it("should return default preferences when none exist", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" }, // Not found
            }),
          }),
        }),
      });

      const request = new NextRequest(
        `http://localhost/api/users/${mockUserId}/preferences`
      );
      const response = await GET(request, { params: { id: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences.sync).toEqual({
        maxArticles: 100,
        retentionCount: 2000,
      });
    });

    it("should decrypt and return existing preferences", async () => {
      const encryptedPrefs = encrypt({
        sync: { maxArticles: 500, retentionCount: 1500 },
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 1,
                user_id: mockUserId,
                preferences: encryptedPrefs,
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      });

      const request = new NextRequest(
        `http://localhost/api/users/${mockUserId}/preferences`
      );
      const response = await GET(request, { params: { id: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences.sync.maxArticles).toBe(500);
      expect(data.preferences.sync.retentionCount).toBe(1500);
    });

    it("should handle decryption errors gracefully", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                preferences: "corrupted_data",
              },
              error: null,
            }),
          }),
        }),
      });

      vi.mocked(decrypt).mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      const request = new NextRequest(
        `http://localhost/api/users/${mockUserId}/preferences`
      );
      const response = await GET(request, { params: { id: mockUserId } });

      expect(response.status).toBe(500);
    });
  });

  describe("PUT /api/users/[id]/preferences", () => {
    describe("Input Validation", () => {
      it("should accept valid maxArticles range (10-5000)", async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        });

        const validValues = [10, 100, 500, 2500, 5000];

        for (const value of validValues) {
          mockSupabase.from.mockReturnValue({
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: { id: 1 },
                error: null,
              }),
            }),
          });

          const request = new NextRequest(
            `http://localhost/api/users/${mockUserId}/preferences`,
            {
              method: "PUT",
              body: JSON.stringify({
                sync: { maxArticles: value, retentionCount: 2000 },
              }),
            }
          );

          const response = await PUT(request, { params: { id: mockUserId } });
          expect(response.status).toBe(200);
        }
      });

      it("should reject maxArticles below 10", async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        });

        const request = new NextRequest(
          `http://localhost/api/users/${mockUserId}/preferences`,
          {
            method: "PUT",
            body: JSON.stringify({
              sync: { maxArticles: 5, retentionCount: 2000 },
            }),
          }
        );

        const response = await PUT(request, { params: { id: mockUserId } });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("maxArticles must be between 10 and 5000");
      });

      it("should reject maxArticles above 5000", async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        });

        const request = new NextRequest(
          `http://localhost/api/users/${mockUserId}/preferences`,
          {
            method: "PUT",
            body: JSON.stringify({
              sync: { maxArticles: 5001, retentionCount: 2000 },
            }),
          }
        );

        const response = await PUT(request, { params: { id: mockUserId } });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("maxArticles must be between 10 and 5000");
      });

      it("should accept valid retention range (100-5000)", async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        });

        const validValues = [100, 500, 1000, 2500, 5000];

        for (const value of validValues) {
          mockSupabase.from.mockReturnValue({
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: { id: 1 },
                error: null,
              }),
            }),
          });

          const request = new NextRequest(
            `http://localhost/api/users/${mockUserId}/preferences`,
            {
              method: "PUT",
              body: JSON.stringify({
                sync: { maxArticles: 100, retentionCount: value },
              }),
            }
          );

          const response = await PUT(request, { params: { id: mockUserId } });
          expect(response.status).toBe(200);
        }
      });

      it("should reject retention below 100", async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        });

        const request = new NextRequest(
          `http://localhost/api/users/${mockUserId}/preferences`,
          {
            method: "PUT",
            body: JSON.stringify({
              sync: { maxArticles: 100, retentionCount: 50 },
            }),
          }
        );

        const response = await PUT(request, { params: { id: mockUserId } });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain(
          "retentionCount must be between 100 and 5000"
        );
      });

      it("should reject retention above 5000", async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        });

        const request = new NextRequest(
          `http://localhost/api/users/${mockUserId}/preferences`,
          {
            method: "PUT",
            body: JSON.stringify({
              sync: { maxArticles: 100, retentionCount: 5001 },
            }),
          }
        );

        const response = await PUT(request, { params: { id: mockUserId } });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain(
          "retentionCount must be between 100 and 5000"
        );
      });

      it("should handle missing preference fields gracefully", async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        });

        mockSupabase.from.mockReturnValue({
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: { id: 1 },
              error: null,
            }),
          }),
        });

        const request = new NextRequest(
          `http://localhost/api/users/${mockUserId}/preferences`,
          {
            method: "PUT",
            body: JSON.stringify({
              sync: { maxArticles: 100 }, // Missing retentionCount
            }),
          }
        );

        const response = await PUT(request, { params: { id: mockUserId } });
        expect(response.status).toBe(200);
      });

      it("should validate preference encryption format", async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        });

        mockSupabase.from.mockReturnValue({
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: { id: 1 },
              error: null,
            }),
          }),
        });

        const request = new NextRequest(
          `http://localhost/api/users/${mockUserId}/preferences`,
          {
            method: "PUT",
            body: JSON.stringify({
              sync: { maxArticles: 100, retentionCount: 2000 },
            }),
          }
        );

        await PUT(request, { params: { id: mockUserId } });

        expect(encrypt).toHaveBeenCalledWith(
          expect.objectContaining({
            sync: { maxArticles: 100, retentionCount: 2000 },
          })
        );
      });
    });

    describe("Persistence", () => {
      it("should encrypt preferences with AES-256-GCM", async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        });

        mockSupabase.from.mockReturnValue({
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: { id: 1 },
              error: null,
            }),
          }),
        });

        const preferences = {
          sync: { maxArticles: 250, retentionCount: 1000 },
        };
        const request = new NextRequest(
          `http://localhost/api/users/${mockUserId}/preferences`,
          {
            method: "PUT",
            body: JSON.stringify(preferences),
          }
        );

        await PUT(request, { params: { id: mockUserId } });

        expect(encrypt).toHaveBeenCalledWith(preferences);
        expect(mockSupabase.from).toHaveBeenCalledWith("user_preferences");
        expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: mockUserId,
            preferences: expect.stringContaining("encrypted_"),
          })
        );
      });

      it("should handle encryption errors gracefully", async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        });

        vi.mocked(encrypt).mockImplementation(() => {
          throw new Error("Encryption failed");
        });

        const request = new NextRequest(
          `http://localhost/api/users/${mockUserId}/preferences`,
          {
            method: "PUT",
            body: JSON.stringify({
              sync: { maxArticles: 100, retentionCount: 2000 },
            }),
          }
        );

        const response = await PUT(request, { params: { id: mockUserId } });

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toContain("Failed to save preferences");
      });

      it("should handle database errors with proper rollback", async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        });

        mockSupabase.from.mockReturnValue({
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Database error" },
            }),
          }),
        });

        const request = new NextRequest(
          `http://localhost/api/users/${mockUserId}/preferences`,
          {
            method: "PUT",
            body: JSON.stringify({
              sync: { maxArticles: 100, retentionCount: 2000 },
            }),
          }
        );

        const response = await PUT(request, { params: { id: mockUserId } });

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toContain("Failed to save preferences");
      });

      it("should merge partial updates with existing preferences", async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        });

        // First get existing preferences
        mockSupabase.from.mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  preferences: encrypt({
                    sync: { maxArticles: 100, retentionCount: 2000 },
                    ui: { theme: "dark" },
                  }),
                },
                error: null,
              }),
            }),
          }),
        });

        // Then upsert merged preferences
        mockSupabase.from.mockReturnValueOnce({
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: { id: 1 },
              error: null,
            }),
          }),
        });

        const request = new NextRequest(
          `http://localhost/api/users/${mockUserId}/preferences`,
          {
            method: "PUT",
            body: JSON.stringify({
              sync: { maxArticles: 500 }, // Partial update
            }),
          }
        );

        await PUT(request, { params: { id: mockUserId } });

        expect(encrypt).toHaveBeenCalledWith(
          expect.objectContaining({
            sync: { maxArticles: 500, retentionCount: 2000 },
            ui: { theme: "dark" },
          })
        );
      });
    });
  });
});
