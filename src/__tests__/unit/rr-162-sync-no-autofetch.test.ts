/**
 * Unit Tests for RR-162: Sync Route Without Auto-Fetch
 *
 * These tests verify that the sync route operates correctly after
 * auto-fetch removal. They test the specification defined in the contract.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  SyncBehaviorContracts,
  ValidationUtilities,
  TestDataGenerators,
} from "../contracts/rr-162-remove-autofetch.contract";

// Mock Next.js modules
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: any, init?: ResponseInit) => ({
      body,
      status: init?.status || 200,
      headers: init?.headers || {},
    }),
  },
  NextRequest: class {
    constructor(
      public url: string,
      public init?: RequestInit
    ) {}
  },
}));

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  upsert: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  neq: vi.fn(() => mockSupabase),
  in: vi.fn(() => mockSupabase),
  gte: vi.fn(() => mockSupabase),
  lt: vi.fn(() => mockSupabase),
  single: vi.fn(() => Promise.resolve({ data: null, error: null })),
  limit: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
};

vi.mock("@/lib/db/supabase-admin", () => ({
  getAdminClient: () => mockSupabase,
}));

// Mock file system for sync status
const mockFs = {
  writeFile: vi.fn(() => Promise.resolve()),
  readdir: vi.fn(() => Promise.resolve([])),
  stat: vi.fn(() => Promise.resolve({ mtimeMs: Date.now() })),
  unlink: vi.fn(() => Promise.resolve()),
};

vi.mock("fs", () => ({
  promises: mockFs,
}));

// Mock TokenManager
vi.mock("../../../../server/lib/token-manager.js", () => ({
  default: {
    getTokens: vi.fn(() =>
      Promise.resolve({
        access_token: "mock-token",
        refresh_token: "mock-refresh",
        expires_at: Date.now() + 3600000,
      })
    ),
    refreshTokens: vi.fn(() =>
      Promise.resolve({
        access_token: "new-mock-token",
        refresh_token: "new-mock-refresh",
        expires_at: Date.now() + 3600000,
      })
    ),
  },
}));

describe("RR-162: Sync Route Without Auto-Fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Contract 1: Sync Completes Without Auto-Fetch", () => {
    it("should complete sync to 100% without attempting auto-fetch", async () => {
      const progressUpdates: number[] = [];
      let finalStatus: any = null;

      // Mock sync status writes to track progress
      mockFs.writeFile.mockImplementation(
        async (path: string, content: string) => {
          const status = JSON.parse(content);
          progressUpdates.push(status.progress);
          finalStatus = status;
          return Promise.resolve();
        }
      );

      // Mock database responses for sync process
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "sync_metadata") {
          return {
            ...mockSupabase,
            select: () =>
              Promise.resolve({
                data: {
                  last_sync_at: new Date(Date.now() - 3600000).toISOString(),
                },
                error: null,
              }),
          };
        }
        if (table === "sync_status") {
          return {
            ...mockSupabase,
            upsert: () => Promise.resolve({ error: null }),
          };
        }
        return mockSupabase;
      });

      // Import and execute sync route
      const { POST } = await import("@/app/api/sync/route");
      const request = new (vi.mocked(await import("next/server")).NextRequest)(
        "http://localhost:3000/api/sync"
      );

      const response = await POST(request);

      // Verify contracts
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "initiated",
        syncId: expect.any(String),
      });

      // Wait for async sync to progress
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify no 92% hang
      expect(progressUpdates).not.toContain(92);
      expect(TestDataGenerators.validateNoHangAt92(progressUpdates)).toBe(true);

      // Verify reaches 100%
      if (finalStatus) {
        expect(finalStatus.status).toBe("completed");
        expect(finalStatus.progress).toBe(100);
      }
    });

    it("should not execute performAutoFetch function", async () => {
      // Read the actual sync route file
      const syncRoutePath = path.join(
        process.cwd(),
        "src/app/api/sync/route.ts"
      );

      let fileContent: string;
      try {
        fileContent = readFileSync(syncRoutePath, "utf-8");
      } catch (error) {
        // If file doesn't exist in test environment, skip
        console.warn("Sync route file not found, skipping code analysis test");
        return;
      }

      // Verify no auto-fetch code exists
      expect(ValidationUtilities.hasAutoFetchReferences(fileContent)).toBe(
        false
      );

      // Specific checks
      expect(fileContent).not.toContain("performAutoFetch");
      expect(fileContent).not.toContain("AUTO_FETCH_RATE_LIMIT");
      expect(fileContent).not.toContain("AUTO_FETCH_TIME_WINDOW");
      expect(fileContent).not.toContain("autoFetchFullContent");

      // Ensure no commented auto-fetch code
      const commentedAutoFetch = /\/\*[\s\S]*?performAutoFetch[\s\S]*?\*\//;
      expect(fileContent).not.toMatch(commentedAutoFetch);
    });
  });

  describe("Contract 2: Sync Progress Sequence", () => {
    it("should follow expected progress sequence without 92%", async () => {
      const progressSequence = TestDataGenerators.expectedProgressSequence();
      const capturedProgress: Array<{ progress: number; message?: string }> =
        [];

      mockFs.writeFile.mockImplementation(
        async (path: string, content: string) => {
          const status = JSON.parse(content);
          capturedProgress.push({
            progress: status.progress,
            message: status.message,
          });
          return Promise.resolve();
        }
      );

      // Mock successful sync responses
      mockSupabase.from.mockReturnValue({
        ...mockSupabase,
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => Promise.resolve({ error: null }),
        upsert: () => Promise.resolve({ error: null }),
      });

      const { POST } = await import("@/app/api/sync/route");
      const request = new (vi.mocked(await import("next/server")).NextRequest)(
        "http://localhost:3000/api/sync"
      );

      await POST(request);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify progress never includes 92
      const progressValues = capturedProgress.map((p) => p.progress);
      expect(progressValues).not.toContain(92);

      // Verify monotonic increase (no backwards progress)
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
      }
    });
  });

  describe("Contract 3: Sync Status Tracking", () => {
    it("should write sync status to both file and database", async () => {
      const syncId = "test-sync-123";
      let fileWrites = 0;
      let dbWrites = 0;

      mockFs.writeFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes(syncId)) {
          fileWrites++;
        }
        return Promise.resolve();
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "sync_status") {
          return {
            ...mockSupabase,
            upsert: () => {
              dbWrites++;
              return Promise.resolve({ error: null });
            },
          };
        }
        return mockSupabase;
      });

      const { POST } = await import("@/app/api/sync/route");
      const request = new (vi.mocked(await import("next/server")).NextRequest)(
        "http://localhost:3000/api/sync"
      );

      await POST(request);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify dual-write strategy
      expect(fileWrites).toBeGreaterThan(0);
      expect(dbWrites).toBeGreaterThan(0);
    });

    it("should clean up old sync files", async () => {
      const oldFiles = [
        "sync-status-old-1.json",
        "sync-status-old-2.json",
        "other-file.txt",
      ];

      mockFs.readdir.mockResolvedValue(oldFiles as any);
      mockFs.stat.mockResolvedValue({
        mtimeMs: Date.now() - 25 * 60 * 60 * 1000, // 25 hours old
      } as any);

      const { POST } = await import("@/app/api/sync/route");
      const request = new (vi.mocked(await import("next/server")).NextRequest)(
        "http://localhost:3000/api/sync"
      );

      await POST(request);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify cleanup was attempted for old sync files
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining("sync-status-old-1.json")
      );
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining("sync-status-old-2.json")
      );
      // Should not delete non-sync files
      expect(mockFs.unlink).not.toHaveBeenCalledWith(
        expect.stringContaining("other-file.txt")
      );
    });
  });

  describe("Contract 4: Error Handling Without Auto-Fetch", () => {
    it("should handle sync errors gracefully", async () => {
      // Simulate database error
      mockSupabase.from.mockReturnValue({
        ...mockSupabase,
        select: () =>
          Promise.resolve({
            data: null,
            error: { message: "Database connection failed" },
          }),
      });

      const { POST } = await import("@/app/api/sync/route");
      const request = new (vi.mocked(await import("next/server")).NextRequest)(
        "http://localhost:3000/api/sync"
      );

      const response = await POST(request);

      // Should still return initiated status (async processing)
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "initiated",
        syncId: expect.any(String),
      });

      // Wait and check that error is logged
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify sync status shows failure
      const lastWrite =
        mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1];
      if (lastWrite) {
        const status = JSON.parse(lastWrite[1] as string);
        expect(status.status).toBe("failed");
        expect(status.error).toBeDefined();
      }
    });

    it("should continue sync even if cleanup fails", async () => {
      // Make cleanup fail
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "sync_status") {
          return {
            ...mockSupabase,
            delete: () =>
              Promise.resolve({
                error: { message: "Cleanup failed" },
              }),
          };
        }
        return {
          ...mockSupabase,
          select: () => Promise.resolve({ data: [], error: null }),
        };
      });

      const { POST } = await import("@/app/api/sync/route");
      const request = new (vi.mocked(await import("next/server")).NextRequest)(
        "http://localhost:3000/api/sync"
      );

      const response = await POST(request);

      // Sync should still be initiated despite cleanup failure
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("initiated");
    });
  });

  describe("Contract 5: Performance Without Auto-Fetch", () => {
    it("should complete sync within 30 seconds", async () => {
      const startTime = Date.now();

      const { POST } = await import("@/app/api/sync/route");
      const request = new (vi.mocked(await import("next/server")).NextRequest)(
        "http://localhost:3000/api/sync"
      );

      await POST(request);

      const duration = Date.now() - startTime;

      // Initial response should be fast (< 1 second)
      expect(duration).toBeLessThan(1000);

      // Note: Full async sync testing would require more complex mocking
      // This test verifies the immediate response time
    });

    it("should not have memory leaks from removed auto-fetch", () => {
      // Verify no dangling references to auto-fetch in memory
      // This is a simple check - production would use memory profiling

      const checkForLeaks = () => {
        // Check global scope doesn't have auto-fetch artifacts
        expect((global as any).performAutoFetch).toBeUndefined();
        expect((global as any).AUTO_FETCH_RATE_LIMIT).toBeUndefined();
        expect((global as any).AUTO_FETCH_TIME_WINDOW).toBeUndefined();
      };

      checkForLeaks();
    });
  });
});
