import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";

describe("RR-142: Verify author field is missing in current implementation", () => {
  it("should confirm that sync route is missing author field mapping", async () => {
    // Read the actual sync route file
    const syncRoutePath = path.join(
      process.cwd(),
      "src",
      "app",
      "api",
      "sync",
      "route.ts"
    );

    const fileContent = await fs.readFile(syncRoutePath, "utf-8");

    // Find the article mapping section (lines 355-374)
    const lines = fileContent.split("\n");

    // Look for the return statement that maps articles
    let mappingStartIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (
        lines[i].includes("return {") &&
        lines[i + 1]?.includes("feed_id: feedId")
      ) {
        mappingStartIndex = i;
        break;
      }
    }

    expect(mappingStartIndex).toBeGreaterThan(-1);

    // Extract the mapping object (approximately next 20 lines)
    const mappingLines = lines.slice(mappingStartIndex, mappingStartIndex + 20);
    const mappingContent = mappingLines.join("\n");

    // This test SHOULD FAIL when we implement the fix
    // Currently it will PASS because author field is missing
    expect(mappingContent).not.toContain("author:");

    // Verify the structure we expect to see
    expect(mappingContent).toContain("feed_id: feedId");
    expect(mappingContent).toContain("inoreader_id: article.id");
    expect(mappingContent).toContain("title: article.title");
    expect(mappingContent).toContain("content: article.content");
    expect(mappingContent).toContain("is_read:");
    expect(mappingContent).toContain("is_starred:");
    expect(mappingContent).toContain("last_sync_update: syncTimestamp");
  });

  it("should identify the exact location where author field needs to be added", async () => {
    const syncRoutePath = path.join(
      process.cwd(),
      "src",
      "app",
      "api",
      "sync",
      "route.ts"
    );

    const fileContent = await fs.readFile(syncRoutePath, "utf-8");
    const lines = fileContent.split("\n");

    // Find line with title mapping
    const titleLineIndex = lines.findIndex((line) =>
      line.includes('title: article.title || "Untitled"')
    );

    expect(titleLineIndex).toBeGreaterThan(-1);
    expect(titleLineIndex).toBe(357); // Line 358 (0-indexed)

    // The author field should be inserted after the title line
    const nextLine = lines[titleLineIndex + 1];

    // Currently the next line is content, not author
    expect(nextLine).toContain("content:");
    expect(nextLine).not.toContain("author:");
  });
});
