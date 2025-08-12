import { readFileSync } from "fs";
import { join } from "path";

let cachedVersion: string | null = null;

/**
 * Reads the version from package.json with error handling and caching
 * @returns Promise<string> - The version string or fallback
 */
export async function getAppVersion(): Promise<string> {
  // Return cached version if available
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    // Try to read from package.json in project root
    const packageJsonPath = join(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

    if (packageJson.version && typeof packageJson.version === "string") {
      // Validate semantic versioning format
      const versionRegex = /^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/;
      if (versionRegex.test(packageJson.version)) {
        cachedVersion = packageJson.version;
        return packageJson.version;
      }
    }

    // Invalid version format
    console.warn(
      "Invalid version format in package.json:",
      packageJson.version
    );
    return "0.0.0-invalid";
  } catch (error) {
    // Handle file read errors gracefully
    console.warn(
      "Could not read version from package.json:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return "0.0.0-unknown";
  }
}

/**
 * Synchronous version of getAppVersion for scenarios where async is not possible
 * @returns string - The version string or fallback
 */
export function getAppVersionSync(): string {
  // Return cached version if available
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    const packageJsonPath = join(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

    if (packageJson.version && typeof packageJson.version === "string") {
      const versionRegex = /^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/;
      if (versionRegex.test(packageJson.version)) {
        cachedVersion = packageJson.version;
        return packageJson.version;
      }
    }

    console.warn(
      "Invalid version format in package.json:",
      packageJson.version
    );
    return "0.0.0-invalid";
  } catch (error) {
    console.warn(
      "Could not read version from package.json:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return "0.0.0-unknown";
  }
}

/**
 * Clears the cached version (useful for testing)
 */
export function clearVersionCache(): void {
  cachedVersion = null;
}
