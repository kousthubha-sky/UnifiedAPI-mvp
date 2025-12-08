/**
 * OneRouter SDK Error Classes
 *
 * Rich error classes that unwrap backend error codes and provide
 * structured error information for better debugging.
 */

import { ErrorCode, APIErrorResponse } from './types.js';

/**
 * Base error class for all OneRouter SDK errors
 */
export class OneRouterError extends Error {
  /** Error code from the API */
  public readonly code: string;
  /** HTTP status code */
  public readonly statusCode: number;
  /** Request trace ID for debugging */
  public readonly traceId?: string;
  /** Additional error details */
  public readonly details?: Record<string, unknown>;
  /** Whether this error is retryable */
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: string = ErrorCode.INTERNAL_ERROR,
    statusCode: number = 500,
    traceId?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OneRouterError';
    this.code = code;
    this.statusCode = statusCode;
    this.traceId = traceId;
    this.details = details;
    this.retryable = this.isRetryable(code, statusCode);

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  private isRetryable(code: string, statusCode: number): boolean {
    // Network and timeout errors are retryable
    if (code === ErrorCode.NETWORK_ERROR || code === ErrorCode.TIMEOUT_ERROR) {
      return true;
    }
    // Rate limiting is retryable after waiting
    if (code === ErrorCode.RATE_LIMIT_EXCEEDED) {
      return true;
    }
    // Server errors (5xx) are generally retryable
    if (statusCode >= 500 && statusCode < 600) {
      return true;
    }
    return false;
  }

  /**
   * Create a OneRouterError from an API error response
   */
  static fromResponse(response: APIErrorResponse, statusCode: number): OneRouterError {
    return createTypedError(
      response.error,
      response.code,
      statusCode,
      response.trace_id,
      response.details
    );
  }

  /**
   * Serialize error for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      traceId: this.traceId,
      details: this.details,
      retryable: this.retryable,
    };
  }
}

/**
 * Error thrown when a request validation fails
 */
export class ValidationError extends OneRouterError {
  constructor(
    message: string,
    traceId?: string,
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, traceId, details);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends OneRouterError {
  constructor(
    message: string = 'Invalid or missing API key',
    traceId?: string,
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.UNAUTHORIZED, 401, traceId, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when access is forbidden
 */
export class ForbiddenError extends OneRouterError {
  constructor(
    message: string = 'Access denied',
    traceId?: string,
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.FORBIDDEN, 403, traceId, details);
    this.name = 'ForbiddenError';
  }
}

/**
 * Error thrown when a resource is not found
 */
export class NotFoundError extends OneRouterError {
  constructor(
    message: string = 'Resource not found',
    traceId?: string,
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.NOT_FOUND, 404, traceId, details);
    this.name = 'NotFoundError';
  }
}

/**
 * Error thrown when a payment-specific resource is not found
 */
export class PaymentNotFoundError extends OneRouterError {
  constructor(
    message: string = 'Payment not found',
    traceId?: string,
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.PAYMENT_NOT_FOUND, 404, traceId, details);
    this.name = 'PaymentNotFoundError';
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends OneRouterError {
  /** Retry-After header value in seconds */
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Rate limit exceeded',
    traceId?: string,
    details?: Record<string, unknown>,
    retryAfter?: number
  ) {
    super(message, ErrorCode.RATE_LIMIT_EXCEEDED, 429, traceId, details);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Error thrown when a payment operation fails
 */
export class PaymentError extends OneRouterError {
  constructor(
    message: string,
    code: string = ErrorCode.PAYMENT_FAILED,
    traceId?: string,
    details?: Record<string, unknown>
  ) {
    super(message, code, 400, traceId, details);
    this.name = 'PaymentError';
  }
}

/**
 * Error thrown when a refund operation fails
 */
export class RefundError extends OneRouterError {
  constructor(
    message: string,
    traceId?: string,
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.REFUND_FAILED, 400, traceId, details);
    this.name = 'RefundError';
  }
}

/**
 * Error thrown when there's a payment provider issue
 */
export class ProviderError extends OneRouterError {
  constructor(
    message: string,
    traceId?: string,
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.PROVIDER_ERROR, 502, traceId, details);
    this.name = 'ProviderError';
  }
}

/**
 * Error thrown when a network error occurs
 */
export class NetworkError extends OneRouterError {
  constructor(
    message: string = 'Network error occurred',
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.NETWORK_ERROR, 0, undefined, details);
    this.name = 'NetworkError';
  }
}

/**
 * Error thrown when a request times out
 */
export class TimeoutError extends OneRouterError {
  constructor(
    message: string = 'Request timed out',
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.TIMEOUT_ERROR, 0, undefined, details);
    this.name = 'TimeoutError';
  }
}

/**
 * Error thrown for internal server errors
 */
export class InternalError extends OneRouterError {
  constructor(
    message: string = 'Internal server error',
    traceId?: string,
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.INTERNAL_ERROR, 500, traceId, details);
    this.name = 'InternalError';
  }
}

/**
 * Create the appropriate error instance based on error code and status
 */
function createTypedError(
  message: string,
  code: string,
  statusCode: number,
  traceId?: string,
  details?: Record<string, unknown>
): OneRouterError {
  switch (code) {
    case ErrorCode.VALIDATION_ERROR:
      return new ValidationError(message, traceId, details);
    case ErrorCode.UNAUTHORIZED:
      return new AuthenticationError(message, traceId, details);
    case ErrorCode.FORBIDDEN:
      return new ForbiddenError(message, traceId, details);
    case ErrorCode.NOT_FOUND:
      return new NotFoundError(message, traceId, details);
    case ErrorCode.PAYMENT_NOT_FOUND:
      return new PaymentNotFoundError(message, traceId, details);
    case ErrorCode.RATE_LIMIT_EXCEEDED:
      return new RateLimitError(message, traceId, details);
    case ErrorCode.PAYMENT_FAILED:
      return new PaymentError(message, code, traceId, details);
    case ErrorCode.REFUND_FAILED:
      return new RefundError(message, traceId, details);
    case ErrorCode.PROVIDER_ERROR:
      return new ProviderError(message, traceId, details);
    case ErrorCode.NETWORK_ERROR:
      return new NetworkError(message, details);
    case ErrorCode.TIMEOUT_ERROR:
      return new TimeoutError(message, details);
    case ErrorCode.INTERNAL_ERROR:
    default:
      if (statusCode === 401) return new AuthenticationError(message, traceId, details);
      if (statusCode === 403) return new ForbiddenError(message, traceId, details);
      if (statusCode === 404) return new NotFoundError(message, traceId, details);
      if (statusCode === 429) return new RateLimitError(message, traceId, details);
      return new InternalError(message, traceId, details);
  }
}

/**
 * Type guard to check if an error is a OneRouterError
 */
export function isOneRouterError(error: unknown): error is OneRouterError {
  return error instanceof OneRouterError;
}

/**
 * Type guard to check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof OneRouterError) {
    return error.retryable;
  }
  // Network-level errors are generally retryable
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('econnreset')
    );
  }
  return false;
}
