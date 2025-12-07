import pRetry from 'p-retry';
import type { Options } from 'p-retry';
import { randomUUID } from 'crypto';
import { StripeAdapter } from '../../adapters/stripe.js';
import { PayPalAdapter } from '../../adapters/paypal.js';
import { PaymentAdapter } from '../../adapters/base.js';
import {
  CreatePaymentRequest,
  CreatePaymentResponse,
  RefundPaymentResponse,
  ListPaymentsParams,
  ListPaymentsResponse,
  PaymentProvider,
  PaymentStatus,
  ErrorCode,
} from '../../types/payment.js';
import { attachTraceId, translateProviderError } from '../normalizers/response.js';
import { PaymentError } from '../middleware/errorHandler.js';
import supabase from '../../utils/supabase.js';
import logger, { auditLogToDatabase } from '../../utils/logger.js';
import { cacheGet, cacheSet } from '../../utils/cache.js';

const RETRY_OPTIONS: Options = {
  retries: 3,
  factor: 2,
  minTimeout: 1000,
  maxTimeout: 5000,
  onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
    logger.warn({
      attempt: attemptNumber,
      retriesLeft,
      error: error.message,
      message: 'Payment operation retry attempt',
    });
  },
};

const getAdapter = (provider: PaymentProvider): PaymentAdapter => {
  switch (provider) {
    case 'stripe':
      return new StripeAdapter();
    case 'paypal':
      return new PayPalAdapter();
    default:
      throw new PaymentError(ErrorCode.INVALID_PROVIDER, `Invalid payment provider: ${provider}`, 400);
  }
};

export const createPayment = async (
  request: CreatePaymentRequest,
  idempotencyKey?: string
): Promise<CreatePaymentResponse> => {
  const traceId = randomUUID();

  const startTime = Date.now();

  try {
    // Check for idempotency
    if (idempotencyKey) {
      const cachedResult = await cacheGet(`idempotency:${idempotencyKey}`);
      if (cachedResult) {
        logger.info({
          trace_id: traceId,
          idempotency_key: idempotencyKey,
          message: 'Returning cached payment result for idempotency key',
        });
        return JSON.parse(cachedResult);
      }
    }

    const adapter = getAdapter(request.provider);

    const response = await pRetry(
      async () => {
        const result = await adapter.createPayment(request);
        return result;
      },
      RETRY_OPTIONS
    );

    const { error: supabaseError } = await supabase.from('payments').insert({
      id: response.id,
      provider_transaction_id: response.provider_transaction_id,
      provider: request.provider,
      amount: response.amount,
      currency: response.currency,
      status: response.status,
      customer_id: request.customer_id,
      metadata: response.metadata || {},
      created_at: response.created_at,
    });

    if (supabaseError) {
      logger.error({ error: supabaseError, trace_id: traceId }, 'Failed to persist payment to database');
    }

    const latency = Date.now() - startTime;

    await auditLogToDatabase({
      trace_id: traceId,
      customer_id: request.customer_id,
      endpoint: '/api/v1/payments/create',
      method: 'POST',
      provider: request.provider,
      status: 201,
      latency_ms: latency,
      request_body: request,
      response_body: response,
    });

    logger.info({
      trace_id: traceId,
      provider: request.provider,
      status: response.status,
      latency_ms: latency,
      message: 'Payment created successfully',
    });

    const responseWithTrace = attachTraceId(response, traceId);

    // Cache result for idempotency
    if (idempotencyKey) {
      await cacheSet(`idempotency:${idempotencyKey}`, JSON.stringify(responseWithTrace), 86400); // 24 hours
    }

    return responseWithTrace;
  } catch (error) {
    const latency = Date.now() - startTime;

    await auditLogToDatabase({
      trace_id: traceId,
      customer_id: request.customer_id,
      endpoint: '/api/v1/payments/create',
      method: 'POST',
      provider: request.provider,
      status: 500,
      latency_ms: latency,
      error_message: error instanceof Error ? error.message : String(error),
      request_body: request,
    });

    logger.error({
      trace_id: traceId,
      provider: request.provider,
      error: error instanceof Error ? error.message : String(error),
      latency_ms: latency,
      message: 'Payment creation failed',
    });

    throw translateProviderError(error, traceId, ErrorCode.PAYMENT_FAILED, 'Payment creation failed');
  }
};

export const refundPayment = async (
  transactionId: string,
  amount?: number,
  reason?: string,
  customerId?: string
): Promise<RefundPaymentResponse> => {
  const traceId = randomUUID();

  const startTime = Date.now();

  try {
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('provider_transaction_id', transactionId)
      .single();

    if (fetchError || !payment) {
      throw new PaymentError(ErrorCode.PAYMENT_NOT_FOUND, 'Payment not found', 404);
    }

    const paymentRecord = payment as Record<string, unknown>;
    const provider = paymentRecord.provider as PaymentProvider;

    const adapter = getAdapter(provider);

    const response = await pRetry(
      async () => {
        const result = await adapter.refundPayment(transactionId, amount, reason);
        return result;
      },
      RETRY_OPTIONS
    );

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'refunded',
        refund_id: response.refund_id,
        refund_status: response.status,
        refund_amount: response.amount,
        updated_at: new Date().toISOString(),
      })
      .eq('provider_transaction_id', transactionId);

    if (updateError) {
      logger.error(
        { error: updateError, trace_id: traceId },
        'Failed to update payment refund in database'
      );
    }

    const latency = Date.now() - startTime;

    await auditLogToDatabase({
      trace_id: traceId,
      customer_id: customerId ?? (paymentRecord.customer_id as string),
      endpoint: `/api/v1/payments/${transactionId}/refund`,
      method: 'POST',
      provider,
      status: 200,
      latency_ms: latency,
      request_body: { amount, reason },
      response_body: response,
    });

    logger.info({
      trace_id: traceId,
      provider,
      transaction_id: transactionId,
      refund_id: response.refund_id,
      latency_ms: latency,
      message: 'Payment refunded successfully',
    });

    return attachTraceId(response, traceId);
  } catch (error) {
    const latency = Date.now() - startTime;

    await auditLogToDatabase({
      trace_id: traceId,
      customer_id: customerId ?? undefined,
      endpoint: `/api/v1/payments/${transactionId}/refund`,
      method: 'POST',
      status: 500,
      latency_ms: latency,
      error_message: error instanceof Error ? error.message : String(error),
      request_body: { amount, reason },
    });

    logger.error({
      trace_id: traceId,
      transaction_id: transactionId,
      error: error instanceof Error ? error.message : String(error),
      latency_ms: latency,
      message: 'Payment refund failed',
    });

    throw translateProviderError(error, traceId, ErrorCode.REFUND_FAILED, 'Refund failed');
  }
};

export const checkPaymentStatus = async (paymentId: string): Promise<PaymentStatus> => {
  const traceId = randomUUID();

  try {
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      throw new PaymentError(ErrorCode.PAYMENT_NOT_FOUND, 'Payment not found', 404);
    }

    const paymentRecord = payment as Record<string, unknown>;
    const currentStatus = paymentRecord.status as PaymentStatus;

    // If payment is already in a final state, return current status
    if (['completed', 'failed', 'refunded'].includes(currentStatus)) {
      return currentStatus;
    }

    // Check with provider for updated status
    const providerTransactionId = paymentRecord.provider_transaction_id as string;

    // TODO: Implement adapter.getPaymentStatus(providerTransactionId) for provider status checking
    // For now, return current status from database

    logger.info({
      trace_id: traceId,
      payment_id: paymentId,
      provider_transaction_id: providerTransactionId,
      current_status: currentStatus,
      message: 'Payment status checked',
    });

    return currentStatus;
  } catch (error) {
    logger.error({
      trace_id: traceId,
      payment_id: paymentId,
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to check payment status',
    });

    throw translateProviderError(
      error,
      traceId,
      ErrorCode.INTERNAL_ERROR,
      'Failed to check payment status',
      500
    );
  }
};

export const listPayments = async (params: ListPaymentsParams): Promise<ListPaymentsResponse> => {
  const traceId = randomUUID();

  try {
    const limit = params.limit ?? 10;
    const offset = params.offset ?? 0;

    let query = supabase
      .from('payments')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.provider) {
      query = query.eq('provider', params.provider);
    }
    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.customer_id) {
      query = query.eq('customer_id', params.customer_id);
    }
    if (params.start_date) {
      query = query.gte('created_at', params.start_date);
    }
    if (params.end_date) {
      query = query.lte('created_at', params.end_date);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const payments = (data || []).map((record) => ({
      id: String(record.id),
      provider_transaction_id: String(record.provider_transaction_id),
      provider: record.provider as PaymentProvider,
      amount: Number(record.amount),
      currency: String(record.currency).toUpperCase(),
      status: record.status as PaymentStatus,
      customer_id: record.customer_id ?? null,
      metadata: record.metadata ?? null,
      refund_id: record.refund_id ?? null,
      refund_status: record.refund_status ?? null,
      refund_amount: record.refund_amount !== null ? Number(record.refund_amount) : null,
      created_at: String(record.created_at),
      updated_at: String(record.updated_at),
    }));

    logger.info({
      trace_id: traceId,
      count: payments.length,
      total: count ?? 0,
      message: 'Payments listed successfully',
    });

    return {
      payments,
      total: count ?? payments.length,
      limit,
      offset,
      trace_id: traceId,
    };
  } catch (error) {
    logger.error({
      trace_id: traceId,
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to list payments',
    });

    throw translateProviderError(
      error,
      traceId,
      ErrorCode.INTERNAL_ERROR,
      'Failed to list payments',
      500
    );
  }
};
