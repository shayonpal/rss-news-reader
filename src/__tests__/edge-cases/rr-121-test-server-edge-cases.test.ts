import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestServer } from "../integration/test-server";
import { existsSync, renameSync } from "fs";
import { Server } from "http";

describe("RR-121: Test Server Edge Cases", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Missing Environment File Tests", () => {
    it("should fall back to .env if .env.test missing", async () => {
      const envTestPath = ".env.test";
      const tempPath = ".env.test.backup";
      let movedFile = false;

      // Temporarily move .env.test if it exists
      if (existsSync(envTestPath)) {
        renameSync(envTestPath, tempPath);
        movedFile = true;
      }

      try {
        // Should still work with just .env
        const { server } = await setupTestServer(3150);
        expect(server).toBeDefined();

        // Cleanup
        await new Promise<void>((resolve) => {
          server.close(() => resolve());
        });
      } finally {
        // Restore .env.test
        if (movedFile) {
          renameSync(tempPath, envTestPath);
        }
      }
    });
  });

  describe("Port Conflict Tests", () => {
    it("should handle port already in use", async () => {
      const port = 3151;

      // Start first server
      const { server: server1 } = await setupTestServer(port);
      await new Promise<void>((resolve) => {
        server1.listen(port, () => resolve());
      });

      try {
        // Try to start second server on same port
        const { server: server2 } = await setupTestServer(port);

        await expect(
          new Promise<void>((resolve, reject) => {
            server2.listen(port, () => resolve());
            server2.on("error", (err: any) => {
              if (err.code === "EADDRINUSE") {
                reject(new Error("Port already in use"));
              }
            });
          })
        ).rejects.toThrow("Port already in use");
      } finally {
        // Cleanup
        await new Promise<void>((resolve) => {
          server1.close(() => resolve());
        });
      }
    });
  });

  describe("Memory Constraint Tests", () => {
    it("should not exceed memory limits during startup", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      const { server, app } = await setupTestServer(3152);

      await new Promise<void>((resolve) => {
        server.listen(3152, () => resolve());
      });

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Should not increase by more than 100MB
      expect(memoryIncrease).toBeLessThan(100);

      // Cleanup
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    });
  });

  describe("Cleanup Tests", () => {
    it("should properly close server and app", async () => {
      const { server, app } = await setupTestServer(3153);

      await new Promise<void>((resolve) => {
        server.listen(3153, () => resolve());
      });

      // Close server
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });

      // Try to listen again on same port - should work
      const newServer = new Server();
      await new Promise<void>((resolve) => {
        newServer.listen(3153, () => {
          newServer.close(() => resolve());
        });
      });

      // No error means port was properly released
      expect(true).toBe(true);
    });
  });
});
