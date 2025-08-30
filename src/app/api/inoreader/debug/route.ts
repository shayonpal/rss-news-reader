import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  try {
    // Check for file-based tokens (the actual token storage)
    const home = process.env.HOME;
    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    const tokenFilePath = path.join(home!, ".rss-reader", "tokens.json");

    let fileTokens: any = null;
    let tokenAge: number | null = null;
    let expiresIn: number | null = null;

    try {
      // Check if token file exists
      await fs.access(tokenFilePath);

      // Read encrypted token file
      const fileContent = await fs.readFile(tokenFilePath, "utf-8");
      const encryptedData = JSON.parse(fileContent);

      // Decrypt tokens if encryption key is available
      if (encryptionKey && encryptedData.encrypted) {
        try {
          const algorithm = "aes-256-gcm";
          const key = Buffer.from(encryptionKey, "base64");
          const iv = Buffer.from(encryptedData.iv, "hex");
          const authTag = Buffer.from(encryptedData.authTag, "hex");
          const decipher = crypto.createDecipheriv(algorithm, key, iv);

          decipher.setAuthTag(authTag);

          let decrypted = decipher.update(
            encryptedData.encrypted,
            "hex",
            "utf8"
          );
          decrypted += decipher.final("utf8");

          fileTokens = JSON.parse(decrypted);

          // Calculate token age and expiration
          const stats = await fs.stat(tokenFilePath);
          const now = Date.now();
          const modifiedTime = stats.mtime.getTime();
          const ageInMs = now - modifiedTime;
          tokenAge = Math.floor(ageInMs / (1000 * 60 * 60 * 24)); // days

          // OAuth tokens typically expire after 365 days for Inoreader
          const TOKEN_EXPIRY_DAYS = 365;
          const daysRemaining = Math.max(0, TOKEN_EXPIRY_DAYS - tokenAge);
          expiresIn = daysRemaining * 24 * 60 * 60 * 1000; // milliseconds
        } catch (decryptError) {
          console.error("Failed to decrypt tokens:", decryptError);
          fileTokens = { error: "Failed to decrypt tokens" };
        }
      } else {
        fileTokens = { error: "Encryption key not available" };
      }
    } catch (fileError: any) {
      if (fileError.code === "ENOENT") {
        fileTokens = { error: "Token file not found" };
      } else {
        fileTokens = { error: fileError.message };
      }
    }

    return NextResponse.json({
      // File-based token info (the actual tokens used by sync)
      fileTokens: {
        hasAccessToken: !!fileTokens?.access_token,
        hasRefreshToken: !!fileTokens?.refresh_token,
        tokenAge: tokenAge,
        daysOld: tokenAge,
        expiresIn: expiresIn,
        isExpired: expiresIn !== null ? expiresIn <= 0 : null,
        status: fileTokens?.error || "Tokens present",
        apiUsage: fileTokens?.api_usage || null,
      },
      // Environment check
      environment: {
        hasEncryptionKey: !!encryptionKey,
        hasClientId: !!process.env.INOREADER_CLIENT_ID,
        hasClientSecret: !!process.env.INOREADER_CLIENT_SECRET,
        tokenPath: tokenFilePath,
      },
      // Debugging info
      debug: {
        tokenFileExists: !fileTokens?.error,
        isEncrypted: !!(fileTokens && !fileTokens.error),
        lastModified: tokenAge !== null ? `${tokenAge} days ago` : null,
      },
    });
  } catch (error) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to check debug info" },
      { status: 500 }
    );
  }
}
