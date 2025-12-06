import { ErrorCode } from '../../types/payment.js';
import { PaymentError } from '../middleware/errorHandler.js';

export const attachTraceId = <T extends Record<string, unknown>>(
  payload: T,
  traceId: string,
  providerMetadata?: Record<string, unknown>
): T & { trace_id: string } => {
  return {
    ...payload,
    trace_id: traceId,
    ...(providerMetadata ? { provider_metadata: providerMetadata } : {}),
  };
};

export const translateProviderError = (
  error: unknown,
  traceId: string,
  fallbackCode: ErrorCode = ErrorCode.PROVIDER_ERROR,
  fallbackMessage = 'Payment provider error',
  statusCode = 502
): PaymentError => {
  if (error instanceof PaymentError) {
    error.details = {
      ...(error.details || {}),
      trace_id: traceId,
    };
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('not found')) {
      return new PaymentError(ErrorCode.PAYMENT_NOT_FOUND, 'Payment not found', 404, {
        trace_id: traceId,
      });
    }

    if (message.includes('unauthorized')) {
      return new PaymentError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401, {
        trace_id: traceId,
      });
    }

    if (message.includes('forbidden')) {
      return new PaymentError(ErrorCode.FORBIDDEN, 'Forbidden', 403, {
        trace_id: traceId,
      });
    }

    if (message.includes('rate limit')) {
      return new PaymentError(ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', 429, {
        trace_id: traceId,
      });
    }

    if (message.includes('timeout')) {
      return new PaymentError(ErrorCode.TIMEOUT_ERROR, 'Request timed out', 504, {
        trace_id: traceId,
      });
    }

    if (message.includes('network') || message.includes('connection')) {
      return new PaymentError(ErrorCode.NETWORK_ERROR, 'Network error', 503, {
        trace_id: traceId,
      });
    }
  }

  return new PaymentError(fallbackCode, fallbackMessage, statusCode, {
    trace_id: traceId,
  });
};
