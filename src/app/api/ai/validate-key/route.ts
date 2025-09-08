/**
 * @swagger
 * /api/ai/validate-key:
 *   post:
 *     summary: Validate an AI provider API key
 *     description: Validates an API key with the specified AI provider (currently supports Anthropic). Includes rate limiting (10 requests per minute) and a 3-second timeout for validation.
 *     tags:
 *       - AI
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - apiKey
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: ["anthropic", "openai"]
 *                 description: The AI provider to validate against
 *                 example: "anthropic"
 *               apiKey:
 *                 type: string
 *                 description: The API key to validate
 *                 example: "sk-ant-api03-..."
 *           example:
 *             provider: "anthropic"
 *             apiKey: "sk-ant-api03-example-key"
 *     responses:
 *       200:
 *         description: API key validation result
 *         headers:
 *           Cache-Control:
 *             description: Prevents caching of validation results
 *             schema:
 *               type: string
 *               example: "no-store"
 *           X-RateLimit-Limit:
 *             description: Maximum requests per minute
 *             schema:
 *               type: string
 *               example: "10"
 *           X-RateLimit-Remaining:
 *             description: Remaining requests in current window
 *             schema:
 *               type: string
 *               example: "9"
 *           X-RateLimit-Reset:
 *             description: Unix timestamp when rate limit resets
 *             schema:
 *               type: string
 *               example: "1699564800"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   description: Whether the API key is valid
 *                 message:
 *                   type: string
 *                   description: Human-readable validation result
 *             examples:
 *               valid:
 *                 value:
 *                   valid: true
 *                   message: "API key is valid"
 *               invalid:
 *                 value:
 *                   valid: false
 *                   message: "Invalid API key"
 *       400:
 *         description: Bad request - Invalid input or rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             examples:
 *               missingProvider:
 *                 value:
 *                   error: "Provider is required"
 *               unsupportedProvider:
 *                 value:
 *                   error: "Unsupported provider: azure"
 *               rateLimit:
 *                 value:
 *                   error: "Rate limit exceeded"
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Authentication required"
 *       504:
 *         description: Gateway Timeout - Validation took too long
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "API key validation timed out"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to validate API key"
 */

import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/services/ai/validation";
import { validateRequest, unauthorizedResponse } from "@/lib/services/ai/auth";
import { ApiErrors } from "@/lib/utils/api-errors";
import {
  checkRateLimit,
  getRateLimitHeaders,
} from "@/lib/services/ai/rate-limit";

// Supported providers
const SUPPORTED_PROVIDERS = ["anthropic", "openai"];

// Validation timeout in milliseconds
const VALIDATION_TIMEOUT = 3000;

/**
 * POST /api/ai/validate-key
 * 
 * Validates an API key with the specified AI provider.
 * 
 * Features:
 * - Supports multiple providers (Anthropic, OpenAI)
 * - Rate limiting: 10 requests per minute per IP
 * - 3-second timeout for validation
 * - Generic error messages for security
 * - Requires authentication
 * 
 * @param {NextRequest} request - The incoming request with provider and apiKey
 * @returns {NextResponse} JSON response with validation result
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit first
    const rateLimit = checkRateLimit(request);
    if (!rateLimit.allowed) {
      const response = ApiErrors.badRequest("Rate limit exceeded");
      const headers = getRateLimitHeaders(
        rateLimit.remaining,
        rateLimit.resetTime
      );
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      response.headers.set(
        "Retry-After",
        Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString()
      );
      return response;
    }

    // Validate request authentication
    const auth = await validateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.badRequest("Invalid JSON body");
    }

    const { provider, apiKey } = body;

    // Validate input
    if (!provider || !apiKey) {
      return ApiErrors.badRequest("Missing provider or apiKey");
    }

    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      return ApiErrors.badRequest("Invalid provider", {
        supportedProviders: SUPPORTED_PROVIDERS,
      });
    }

    // Implement timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT);

    try {
      // Pass the abort signal to the validation function
      const result = await validateApiKey(provider, apiKey);
      clearTimeout(timeoutId);

      // Return with no-store cache header and rate limit info
      const response = NextResponse.json(result, {
        headers: {
          "Cache-Control": "no-store",
          ...getRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime),
        },
      });
      return response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.message === "Validation timeout")
      ) {
        const response = ApiErrors.timeout("Validation timeout");
        response.headers.set("Cache-Control", "no-store");
        return response;
      }
      throw error;
    }
  } catch (error) {
    console.error("Validation error:", error);
    // Generic error message for security
    return ApiErrors.serverError("Validation failed");
  }
}
