/**
 * Unit tests for error classes
 */

import { describe, it, expect } from 'vitest';
import {
  PaymentHubError,
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
  isPaymentHubError,
  isRetryableError,
  ErrorCode,
} from '../src/index.js';

describe('PaymentHubError', () => {
  it('should create error with all properties', () => {
    const error = new PaymentHubError(
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
    expect(error.name).toBe('PaymentHubError');
  });

  it('should be retryable for 5xx errors', () => {
    const error = new PaymentHubError('Server error', 'INTERNAL_ERROR', 500);
    expect(error.retryable).toBe(true);
  });

  it('should be retryable for network errors', () => {
    const error = new PaymentHubError(
      'Network error',
      ErrorCode.NETWORK_ERROR,
      0
    );
    expect(error.retryable).toBe(true);
  });

  it('should be retryable for timeout errors', () => {
    const error = new PaymentHubError(
      'Timeout error',
      ErrorCode.TIMEOUT_ERROR,
      0
    );
    expect(error.retryable).toBe(true);
  });

  it('should be retryable for rate limit errors', () => {
    const error = new PaymentHubError(
      'Rate limited',
      ErrorCode.RATE_LIMIT_EXCEEDED,
      429
    );
    expect(error.retryable).toBe(true);
  });

  it('should not be retryable for 4xx errors', () => {
    const error = new PaymentHubError(
      'Bad request',
      ErrorCode.VALIDATION_ERROR,
      400
    );
    expect(error.retryable).toBe(false);
  });

  it('should serialize to JSON correctly', () => {
    const error = new PaymentHubError(
      'Test error',
      'TEST_CODE',
      400,
      'trace_456',
      { key: 'value' }
    );

    const json = error.toJSON();
    expect(json).toEqual({
      name: 'PaymentHubError',
      message: 'Test error',
      code: 'TEST_CODE',
      statusCode: 400,
      traceId: 'trace_456',
      details: { key: 'value' },
      retryable: false,
    });
  });

  it('should create from API response', () => {
    const error = PaymentHubError.fromResponse(
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
  describe('isPaymentHubError', () => {
    it('should return true for PaymentHubError', () => {
      const error = new PaymentHubError('test', 'TEST', 400);
      expect(isPaymentHubError(error)).toBe(true);
    });

    it('should return true for specific error subclasses', () => {
      expect(isPaymentHubError(new ValidationError('test'))).toBe(true);
      expect(isPaymentHubError(new AuthenticationError())).toBe(true);
      expect(isPaymentHubError(new NetworkError())).toBe(true);
    });

    it('should return false for regular Error', () => {
      expect(isPaymentHubError(new Error('test'))).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isPaymentHubError(null)).toBe(false);
      expect(isPaymentHubError(undefined)).toBe(false);
      expect(isPaymentHubError('error')).toBe(false);
      expect(isPaymentHubError({ message: 'error' })).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for retryable PaymentHubErrors', () => {
      expect(isRetryableError(new NetworkError())).toBe(true);
      expect(isRetryableError(new TimeoutError())).toBe(true);
      expect(isRetryableError(new RateLimitError())).toBe(true);
      expect(isRetryableError(new InternalError())).toBe(true);
    });

    it('should return false for non-retryable PaymentHubErrors', () => {
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
