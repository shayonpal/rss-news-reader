import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

interface AuthStatusResponse {
  authenticated: boolean;
  status: string;
  message: string;
  timestamp: string;
  tokenAge: number | null;
  daysRemaining: number | null;
}

const TOKEN_EXPIRY_DAYS = 365;
const EXPIRY_WARNING_DAYS = 30;

export async function GET(
  request: NextRequest
): Promise<NextResponse<AuthStatusResponse>> {
  const timestamp = new Date().toISOString();

  // Check environment variables
  const home = process.env.HOME;
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;

  if (!home || !encryptionKey) {
    return NextResponse.json(
      {
        authenticated: false,
        status: "config_error",
        message: "Missing required configuration",
        timestamp,
        tokenAge: null,
        daysRemaining: null,
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Construct token file path
  const tokenFilePath = path.join(home, ".rss-reader", "tokens.json");

  try {
    // Check if token file exists
    await fs.access(tokenFilePath);

    // Read and parse token file
    const fileContent = await fs.readFile(tokenFilePath, "utf-8");
    let tokenData: any;

    try {
      tokenData = JSON.parse(fileContent);
    } catch (parseError) {
      return NextResponse.json(
        {
          authenticated: false,
          status: "invalid_format",
          message: "Token file contains invalid JSON",
          timestamp,
          tokenAge: null,
          daysRemaining: null,
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check for encrypted field
    if (!tokenData.encrypted) {
      // Check if it has unencrypted tokens
      if (tokenData.access_token || tokenData.refresh_token) {
        return NextResponse.json(
          {
            authenticated: false,
            status: "unencrypted",
            message: "OAuth tokens are not properly encrypted",
            timestamp,
            tokenAge: null,
            daysRemaining: null,
          },
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return NextResponse.json(
        {
          authenticated: false,
          status: "empty_tokens",
          message: "OAuth tokens are empty or missing",
          timestamp,
          tokenAge: null,
          daysRemaining: null,
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if encrypted field is empty
    if (tokenData.encrypted === "") {
      return NextResponse.json(
        {
          authenticated: false,
          status: "empty_tokens",
          message: "OAuth tokens are empty or missing",
          timestamp,
          tokenAge: null,
          daysRemaining: null,
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get file stats to calculate token age
    let tokenAge: number;
    let daysRemaining: number;

    try {
      const stats = await fs.stat(tokenFilePath);
      const now = Date.now();
      const modifiedTime = stats.mtime.getTime();
      const ageInMs = now - modifiedTime;
      tokenAge = Math.floor(ageInMs / (1000 * 60 * 60 * 24));
      daysRemaining = Math.max(0, TOKEN_EXPIRY_DAYS - tokenAge);
    } catch (statError) {
      return NextResponse.json(
        {
          authenticated: false,
          status: "error",
          message: "Unable to check token age",
          timestamp,
          tokenAge: null,
          daysRemaining: null,
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Determine authentication status based on token age
    if (tokenAge >= TOKEN_EXPIRY_DAYS) {
      return NextResponse.json(
        {
          authenticated: false,
          status: "expired",
          message: "OAuth tokens have expired",
          timestamp,
          tokenAge,
          daysRemaining: 0,
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (daysRemaining <= EXPIRY_WARNING_DAYS) {
      return NextResponse.json(
        {
          authenticated: true,
          status: "expiring_soon",
          message: `OAuth tokens are expiring soon (${daysRemaining} days remaining)`,
          timestamp,
          tokenAge,
          daysRemaining,
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Tokens are valid
    return NextResponse.json(
      {
        authenticated: true,
        status: "valid",
        message: `OAuth tokens are valid (${daysRemaining} days remaining)`,
        timestamp,
        tokenAge,
        daysRemaining,
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    // Handle file not found
    if (error.code === "ENOENT" || error.message.includes("ENOENT")) {
      return NextResponse.json(
        {
          authenticated: false,
          status: "no_tokens",
          message: "OAuth token file not found",
          timestamp,
          tokenAge: null,
          daysRemaining: null,
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Handle other errors without exposing paths
    const sanitizedMessage = error.message
      .replace(/\/Users\/[^/]+/g, "")
      .replace(/\.rss-reader/g, "")
      .replace(/tokens\.json/g, "");

    return NextResponse.json(
      {
        authenticated: false,
        status: "error",
        message: `Unable to check token file: ${sanitizedMessage}`,
        timestamp,
        tokenAge: null,
        daysRemaining: null,
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Only allow GET method
export async function POST() {
  return new NextResponse("Method Not Allowed", { status: 405 });
}

export async function PUT() {
  return new NextResponse("Method Not Allowed", { status: 405 });
}

export async function DELETE() {
  return new NextResponse("Method Not Allowed", { status: 405 });
}

export async function PATCH() {
  return new NextResponse("Method Not Allowed", { status: 405 });
}
