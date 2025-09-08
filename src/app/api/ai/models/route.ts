/**
 * @swagger
 * /api/ai/models:
 *   get:
 *     summary: Get available AI models
 *     description: Retrieves a list of available Anthropic AI models that can be used for content summarization. Includes model metadata such as name, description, and provider information.
 *     tags:
 *       - AI
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved AI models
 *         headers:
 *           ETag:
 *             description: Entity tag for cache validation
 *             schema:
 *               type: string
 *           Cache-Control:
 *             description: Cache control header (private, max-age=300)
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 models:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Unique model identifier
 *                         example: "claude-3-opus-20240229"
 *                       name:
 *                         type: string
 *                         description: Human-readable model name
 *                         example: "Claude 3 Opus"
 *                       provider:
 *                         type: string
 *                         description: AI provider name
 *                         example: "anthropic"
 *                       description:
 *                         type: string
 *                         description: Model capabilities description
 *                         example: "Most capable model for complex tasks"
 *             example:
 *               models:
 *                 - id: "claude-3-opus-20240229"
 *                   name: "Claude 3 Opus"
 *                   provider: "anthropic"
 *                   description: "Most capable model for complex tasks"
 *                 - id: "claude-3-sonnet-20240229"
 *                   name: "Claude 3 Sonnet"
 *                   provider: "anthropic"
 *                   description: "Balanced performance and cost"
 *                 - id: "claude-3-haiku-20240307"
 *                   name: "Claude 3 Haiku"
 *                   provider: "anthropic"
 *                   description: "Fast and efficient"
 *       304:
 *         description: Not Modified - ETag matches, use cached response
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Authentication required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch models"
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest, unauthorizedResponse } from "@/lib/services/ai/auth";
import { ApiErrors } from "@/lib/utils/api-errors";
import crypto from "crypto";

// Available Anthropic models
const ANTHROPIC_MODELS = [
  {
    id: "claude-3-opus-20240229",
    name: "Claude 3 Opus",
    provider: "anthropic",
    description: "Most capable model for complex tasks",
  },
  {
    id: "claude-3-sonnet-20240229",
    name: "Claude 3 Sonnet",
    provider: "anthropic",
    description: "Balanced performance and cost",
  },
  {
    id: "claude-3-haiku-20240307",
    name: "Claude 3 Haiku",
    provider: "anthropic",
    description: "Fast and efficient",
  },
];

// Generate content-based ETag
function generateETag<T>(data: T): string {
  const hash = crypto.createHash("sha256");
  hash.update(JSON.stringify(data));
  return `"${hash.digest("hex").substring(0, 16)}"`;
}

const CACHE_MAX_AGE = 300; // 5 minutes

/**
 * GET /api/ai/models
 * 
 * Retrieves available AI models for content summarization.
 * 
 * Features:
 * - Returns list of Anthropic Claude models
 * - Implements ETag-based caching (304 Not Modified)
 * - 5-minute cache control for performance
 * - Requires authentication via validateRequest
 * 
 * @param {NextRequest} request - The incoming request
 * @returns {NextResponse} JSON response with models array or error
 */
export async function GET(request: NextRequest) {
  try {
    // Validate request authentication
    const auth = await validateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    // Generate content-based ETag
    const responseData = { models: ANTHROPIC_MODELS };
    const etag = generateETag(responseData);

    // Check If-None-Match header for caching
    const ifNoneMatch = request.headers.get("If-None-Match");
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
        },
      });
    }

    // Return models with caching headers (private for authenticated content)
    return NextResponse.json(responseData, {
      headers: {
        ETag: etag,
        "Cache-Control": `private, max-age=${CACHE_MAX_AGE}`,
      },
    });
  } catch (error) {
    console.error("Error fetching models:", error);
    return ApiErrors.serverError("Failed to fetch models");
  }
}
