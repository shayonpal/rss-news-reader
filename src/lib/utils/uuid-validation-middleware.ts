/**
 * UUID Validation Middleware for Next.js API Routes
 *
 * Provides runtime validation for UUID parameters using Zod schemas
 * to catch invalid UUIDs before they reach route handlers.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// UUID validation schema
const UUIDSchema = z.string().uuid();

/**
 * Validates UUID parameters in API route contexts
 */
export function validateUUID(uuid: string): {
  isValid: boolean;
  error?: string;
} {
  try {
    UUIDSchema.parse(uuid);
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Invalid UUID format: ${uuid}`,
    };
  }
}

/**
 * Middleware function to validate UUID parameters in route handlers
 * Returns NextResponse with 400 error if validation fails
 */
export function validateUUIDParams(
  params: Record<string, string>,
  uuidFields: string[]
): NextResponse | null {
  for (const field of uuidFields) {
    const value = params[field];

    if (!value) {
      return NextResponse.json(
        {
          error: "Missing required parameter",
          message: `Parameter '${field}' is required`,
          details: `Expected UUID format for ${field}`,
        },
        { status: 400 }
      );
    }

    const validation = validateUUID(value);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: "Invalid parameter format",
          message: validation.error,
          details: `Parameter '${field}' must be a valid UUID`,
        },
        { status: 400 }
      );
    }
  }

  return null; // No validation errors
}

/**
 * Higher-order function to wrap route handlers with UUID validation
 */
export function withUUIDValidation<T extends Record<string, string>>(
  uuidFields: string[],
  handler: (
    request: NextRequest,
    context: { params: T }
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context: { params: T }
  ): Promise<NextResponse> => {
    // Validate UUID parameters
    const validationError = validateUUIDParams(context.params, uuidFields);
    if (validationError) {
      return validationError;
    }

    // Call the original handler if validation passes
    return handler(request, context);
  };
}

/**
 * Specific validators for common parameter names
 */
export const validators = {
  articleId: (params: { id: string }) => validateUUIDParams(params, ["id"]),
  tagId: (params: { id: string }) => validateUUIDParams(params, ["id"]),
  feedId: (params: { id: string }) => validateUUIDParams(params, ["id"]),
  userId: (params: { id: string }) => validateUUIDParams(params, ["id"]),
} as const;

/**
 * Convenience function for article ID validation
 */
export const withArticleIdValidation = <T extends { id: string }>(
  handler: (
    request: NextRequest,
    context: { params: T }
  ) => Promise<NextResponse>
) => withUUIDValidation(["id"], handler);

/**
 * Convenience function for tag ID validation
 */
export const withTagIdValidation = <T extends { id: string }>(
  handler: (
    request: NextRequest,
    context: { params: T }
  ) => Promise<NextResponse>
) => withUUIDValidation(["id"], handler);
