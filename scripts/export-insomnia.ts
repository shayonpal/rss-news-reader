#!/usr/bin/env tsx

/**
 * Export OpenAPI specification as Insomnia collection
 *
 * Usage:
 *   npm run export:insomnia
 *   npm run export:insomnia -- --server http://localhost:3000
 *   npm run export:insomnia -- --server http://100.96.166.53:3000
 *
 * Memory-limited execution to handle constrained environments:
 *   node --max-old-space-size=768 scripts/export-insomnia.ts
 */

import fs from "fs/promises";
import path from "path";
import { generateOpenAPIDocument } from "../src/lib/openapi/registry";
import { convertOpenAPIToInsomnia } from "../src/lib/openapi/insomnia-converter";

// Parse command line arguments
const args = process.argv.slice(2);
let serverUrl = "http://localhost:3000";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--server" && args[i + 1]) {
    serverUrl = args[i + 1];
    i++; // Skip next argument
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log(`
RSS Reader Insomnia Export Script
==================================

Exports the OpenAPI specification as an Insomnia v4 collection file.

Usage:
  npm run export:insomnia                              # Use localhost:3000
  npm run export:insomnia -- --server [URL]           # Use custom server URL
  
Options:
  --server [URL]    Server URL (default: http://localhost:3000)
  --help, -h        Show this help message

Examples:
  npm run export:insomnia
  npm run export:insomnia -- --server http://127.0.0.1:3000
  npm run export:insomnia -- --server http://100.96.166.53:3000

The exported file will be saved to:
  exports/insomnia/rss-reader-collection.json
`);
    process.exit(0);
  }
}

// Ensure server URL ends with /reader if not already present
if (!serverUrl.endsWith("/reader")) {
  serverUrl = `${serverUrl}/reader`;
}

async function exportInsomnia() {
  try {
    console.log("🚀 Starting Insomnia export...");
    console.log(`📍 Using server URL: ${serverUrl}`);

    // Generate OpenAPI document
    console.log("📄 Generating OpenAPI document...");
    const openApiSpec = generateOpenAPIDocument();

    // Check memory usage before conversion
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    console.log(`💾 Memory usage: ${heapUsedMB}MB`);

    if (heapUsedMB > 700) {
      console.warn(
        "⚠️  High memory usage detected. Consider restarting with --max-old-space-size=768"
      );
    }

    // Convert to Insomnia format
    console.log("🔄 Converting to Insomnia v4 format...");
    const insomniaCollection = convertOpenAPIToInsomnia(openApiSpec, serverUrl);

    // Create exports directory if it doesn't exist
    const exportDir = path.join(process.cwd(), "exports", "insomnia");
    await fs.mkdir(exportDir, { recursive: true });

    // Generate filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `rss-reader-collection-${timestamp}.json`;
    const filepath = path.join(exportDir, filename);

    // Also create a latest symlink
    const latestPath = path.join(exportDir, "rss-reader-collection.json");

    // Write the collection file
    console.log(`📝 Writing collection to ${filepath}...`);
    await fs.writeFile(
      filepath,
      JSON.stringify(insomniaCollection, null, 2),
      "utf-8"
    );

    // Update the latest symlink (overwrite if exists)
    try {
      await fs.unlink(latestPath);
    } catch {
      // File might not exist, that's okay
    }
    await fs.writeFile(
      latestPath,
      JSON.stringify(insomniaCollection, null, 2),
      "utf-8"
    );

    // Calculate file size
    const stats = await fs.stat(filepath);
    const fileSizeKB = Math.round(stats.size / 1024);

    // Count resources
    const resourceCount = insomniaCollection.resources?.length || 0;
    const requestCount =
      insomniaCollection.resources?.filter((r: any) => r._type === "request")
        .length || 0;

    console.log("\n✅ Export completed successfully!");
    console.log("📊 Export Statistics:");
    console.log(`   • File size: ${fileSizeKB}KB`);
    console.log(`   • Total resources: ${resourceCount}`);
    console.log(`   • API requests: ${requestCount}`);
    console.log(`   • Server URL: ${serverUrl}`);
    console.log("\n📁 Files created:");
    console.log(`   • ${filepath}`);
    console.log(`   • ${latestPath} (latest version)`);
    console.log("\n🎯 Next steps:");
    console.log("   1. Open Insomnia");
    console.log("   2. Go to Application → Preferences → Data → Import Data");
    console.log("   3. Select 'From File' and choose the exported JSON");
    console.log("   4. Configure environment variables as needed");
  } catch (error) {
    console.error("\n❌ Export failed:", error);

    if (error instanceof Error) {
      if (error.message.includes("heap out of memory")) {
        console.error("\n💡 Try running with increased memory:");
        console.error(
          "   node --max-old-space-size=1024 scripts/export-insomnia.ts"
        );
      } else {
        console.error("\nError details:", error.message);
      }
    }

    process.exit(1);
  }
}

// Run the export
exportInsomnia().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
