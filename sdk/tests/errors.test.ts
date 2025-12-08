/**
 * Unit tests for error classes
 */

import { describe, it, expect } from 'vitest';
import {
  OneRouterError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  PaymentNotFoundError,
  RateLimitError,
  PaymentError,
  RefundError,
  ProviderError,
  NetworkError,
  TimeoutError,
  InternalError,
  isOneRouterError,
  isRetryableError,
  ErrorCode,
} from '../src/index.js';

describe('OneRouterError', () => {
  it('should create error with all properties', () => {
    const error = new OneRouterError(
      'Test error',
      ErrorCode.INTERNAL_ERROR,
      500,
      'trace_123',
      { extra: 'data' }
    );

    expect(error.message).toBe('Test error');
    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(error.statusCode).toBe(500);
    expect(error.traceId).toBe('trace_123');
    expect(error.details).toEqual({ extra: 'data' });
    expect(error.name).toBe('OneRouterError');
  });

  it('should be retryable for 5xx errors', () => {
    const error = new OneRouterError('Server error', 'INTERNAL_ERROR', 500);
    expect(error.retryable).toBe(true);
  });

  it('should be retryable for network errors', () => {
    const error = new OneRouterError(
      'Network error',
      ErrorCode.NETWORK_ERROR,
      0
    );
    expect(error.retryable).toBe(true);
  });

  it('should be retryable for timeout errors', () => {
    const error = new OneRouterError(
      'Timeout error',
      ErrorCode.TIMEOUT_ERROR,
      0
    );
    expect(error.retryable).toBe(true);
  });

  it('should be retryable for rate limit errors', () => {
    const error = new OneRouterError(
      'Rate limited',
      ErrorCode.RATE_LIMIT_EXCEEDED,
      429
    );
    expect(error.retryable).toBe(true);
  });

  it('should not be retryable for 4xx errors', () => {
    const error = new OneRouterError(
      'Bad request',
      ErrorCode.VALIDATION_ERROR,
      400
    );
    expect(error.retryable).toBe(false);
  });

  it('should serialize to JSON correctly', () => {
    const error = new OneRouterError(
      'Test error',
      'TEST_CODE',
      400,
      'trace_456',
      { key: 'value' }
    );

    const json = error.toJSON();
    expect(json).toEqual({
      name: 'OneRouterError',
      message: 'Test error',
      code: 'TEST_CODE',
      statusCode: 400,
      traceId: 'trace_456',
      details: { key: 'value' },
      retryable: false,
    });
  });

  it('should create from API response', () => {
    const error = OneRouterError.fromResponse(
      {
        error: 'Payment failed',
        code: ErrorCode.PAYMENT_FAILED,
        trace_id: 'trace_789',
        details: { reason: 'insufficient_funds' },
      },
      400
    );

    expect(error).toBeInstanceOf(PaymentError);
    expect(error.message).toBe('Payment failed');
    expect(error.code).toBe(ErrorCode.PAYMENT_FAILED);
    expect(error.traceId).toBe('trace_789');
  });
});

describe('Specific error classes', () => {
  describe('ValidationError', () => {
    it('should have correct properties', () => {
      const error = new ValidationError('Invalid input', 'trace_1', {
        field: 'amount',
      });

      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
    });
  });

  describe('AuthenticationError', () => {
    it('should have default message', () => {
      const error = new AuthenticationError();

      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toBe('Invalid or missing API key');
      expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(error.statusCode).toBe(401);
    });

    it('should accept custom message', () => {
      const error = new AuthenticationError('API key expired');
      expect(error.message).toBe('API key expired');
    });
  });

  describe('ForbiddenError', () => {
    it('should have correct properties', () => {
      const error = new ForbiddenError();

      expect(error.name).toBe('ForbiddenError');
      expect(error.code).toBe(ErrorCode.FORBIDDEN);
      expect(error.statusCode).toBe(403);
    });
  });

  describe('NotFoundError', () => {
    it('should have correct properties', () => {
      const error = new NotFoundError();

      expect(error.name).toBe('NotFoundError');
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.statusCode).toBe(404);
    });
  });

  describe('PaymentNotFoundError', () => {
    it('should have correct properties', () => {
      const error = new PaymentNotFoundError();

      expect(error.name).toBe('PaymentNotFoundError');
      expect(error.code).toBe(ErrorCode.PAYMENT_NOT_FOUND);
      expect(error.statusCode).toBe(404);
    });
  });

  describe('RateLimitError', () => {
    it('should include retryAfter', () => {
      const error = new RateLimitError('Too many requests', 'trace_2', {}, 60);

      expect(error.name).toBe('RateLimitError');
      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
      expect(error.retryable).toBe(true);
    });
  });

  describe('PaymentError', () => {
    it('should have correct properties', () => {
      const error = new PaymentError('Card declined');

      expect(error.name).toBe('PaymentError');
      expect(error.code).toBe(ErrorCode.PAYMENT_FAILED);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('RefundError', () => {
    it('should have correct properties', () => {
      const error = new RefundError('Already refunded');

      expect(error.name).toBe('RefundError');
      expect(error.code).toBe(ErrorCode.REFUND_FAILED);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('ProviderError', () => {
    it('should have correct properties', () => {
      const error = new ProviderError('Stripe API error');

      expect(error.name).toBe('ProviderError');
      expect(error.code).toBe(ErrorCode.PROVIDER_ERROR);
      expect(error.statusCode).toBe(502);
    });
  });

  describe('NetworkError', () => {
    it('should have correct properties', () => {
      const error = new NetworkError();

      expect(error.name).toBe('NetworkError');
      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.statusCode).toBe(0);
      expect(error.retryable).toBe(true);
    });
  });

  describe('TimeoutError', () => {
    it('should have correct properties', () => {
      const error = new TimeoutError();

      expect(error.name).toBe('TimeoutError');
      expect(error.code).toBe(ErrorCode.TIMEOUT_ERROR);
      expect(error.statusCode).toBe(0);
      expect(error.retryable).toBe(true);
    });
  });

  describe('InternalError', () => {
    it('should have correct properties', () => {
      const error = new InternalError();

      expect(error.name).toBe('InternalError');
      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
    });
  });
});

describe('Type guards', () => {
  describe('isOneRouterError', () => {
    it('should return true for OneRouterError', () => {
      const error = new OneRouterError('test', 'TEST', 400);
      expect(isOneRouterError(error)).toBe(true);
    });

    it('should return true for specific error subclasses', () => {
      expect(isOneRouterError(new ValidationError('test'))).toBe(true);
      expect(isOneRouterError(new AuthenticationError())).toBe(true);
      expect(isOneRouterError(new NetworkError())).toBe(true);
    });

    it('should return false for regular Error', () => {
      expect(isOneRouterError(new Error('test'))).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isOneRouterError(null)).toBe(false);
      expect(isOneRouterError(undefined)).toBe(false);
      expect(isOneRouterError('error')).toBe(false);
      expect(isOneRouterError({ message: 'error' })).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for retryable OneRouterErrors', () => {
      expect(isRetryableError(new NetworkError())).toBe(true);
      expect(isRetryableError(new TimeoutError())).toBe(true);
      expect(isRetryableError(new RateLimitError())).toBe(true);
      expect(isRetryableError(new InternalError())).toBe(true);
    });

    it('should return false for non-retryable OneRouterErrors', () => {
      expect(isRetryableError(new ValidationError('test'))).toBe(false);
      expect(isRetryableError(new AuthenticationError())).toBe(false);
      expect(isRetryableError(new ForbiddenError())).toBe(false);
    });

    it('should check error message for regular errors', () => {
      expect(isRetryableError(new Error('network error occurred'))).toBe(true);
      expect(isRetryableError(new Error('timeout'))).toBe(true);
      expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
      expect(isRetryableError(new Error('validation failed'))).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError('error')).toBe(false);
    });
  });
});
