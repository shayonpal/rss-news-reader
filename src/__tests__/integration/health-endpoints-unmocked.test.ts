/**
 * Test to verify fetch mock is the issue
 */

import { describe, it, expect, beforeAll, vi } from "vitest";

describe("Fetch Mock Test", () => {
  beforeAll(() => {
    // Restore real fetch for this test
    vi.unmock("node-fetch");
    global.fetch = vi.fn().mockImplementation((...args) => {
      // Use real fetch implementation
      return import("node-fetch").then(({ default: fetch }) => fetch(...args));
    });
  });

  it("should be able to make real HTTP requests", async () => {
    // This should work with real fetch
    const response = await fetch("http://localhost:3000/reader/api/health/app");
    console.log("Response:", response);
    console.log("Response status:", response?.status);
    expect(response).toBeDefined();
  });
});
