import { promises as fs } from "fs";
import path from "path";

/**
 * Helper function to log Inoreader API calls
 * Fire-and-forget to avoid blocking the main request
 */
export function logInoreaderApiCall(
  endpoint: string,
  trigger: string,
  method: string = "GET"
): void {
  // Direct file writing for server-side logging
  const logEntry = {
    timestamp: new Date().toISOString(),
    endpoint,
    trigger,
    method,
  };

  // Fire and forget - don't await
  const logFile = path.join(process.cwd(), "logs", "inoreader-api-calls.jsonl");
  const logLine = JSON.stringify(logEntry) + "\n";

  fs.appendFile(logFile, logLine, "utf8").catch((error) => {
    // Silently fail - logging should not break the app
    console.error("Failed to log API call:", error);
  });
}
