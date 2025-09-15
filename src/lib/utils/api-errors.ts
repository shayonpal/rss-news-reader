import { NextResponse } from "next/server";

/**
 * Standard error response format for API endpoints
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown> | string[] | string;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  message: string,
  status: number,
  code?: string,
  details?: Record<string, unknown> | string[] | string
): NextResponse<ErrorResponse> {
  const body: ErrorResponse = {
    error: message,
    ...(code && { code }),
    ...(details && { details }),
  };

  return NextResponse.json(body, { status });
}

/**
 * Common error responses
 */
export const ApiErrors = {
  unauthorized: (message = "Unauthorized") =>
    createErrorResponse(message, 401, "UNAUTHORIZED"),

  badRequest: (
    message = "Bad request",
    details?: Record<string, unknown> | string[] | string
  ) => createErrorResponse(message, 400, "BAD_REQUEST", details),

  notFound: (message = "Not found") =>
    createErrorResponse(message, 404, "NOT_FOUND"),

  timeout: (message = "Request timeout") =>
    createErrorResponse(message, 504, "TIMEOUT"),

  serverError: (
    message = "Internal server error",
    details?: Record<string, unknown> | string[] | string
  ) => createErrorResponse(message, 500, "INTERNAL_ERROR", details),

  validationError: (
    message = "Validation failed",
    details?: Record<string, unknown> | string[] | string
  ) => createErrorResponse(message, 422, "VALIDATION_ERROR", details),
} as const;
