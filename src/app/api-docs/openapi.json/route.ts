import { NextResponse } from "next/server";
import { generateOpenAPIDocument } from "@/lib/openapi/registry";

export async function GET(request: Request) {
  try {
    // Extract the host from the request to generate correct server URL
    const url = new URL(request.url);
    const serverUrl = `${url.protocol}//${url.host}`;
    const openApiDocument = generateOpenAPIDocument(serverUrl);

    // Use environment-based caching strategy
    const cacheControl =
      process.env.NODE_ENV === "production"
        ? "public, max-age=3600" // Cache for 1 hour in production
        : "no-cache, no-store, must-revalidate"; // No caching in development

    return NextResponse.json(openApiDocument, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": cacheControl,
      },
    });
  } catch (error) {
    console.error("Failed to generate OpenAPI document:", error);

    return NextResponse.json(
      {
        error: "Failed to generate OpenAPI specification",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
