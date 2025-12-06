import {
  CreatePaymentRequest,
  CreatePaymentRequestSchema,
  ListPaymentsQuery,
  ListPaymentsQuerySchema,
  RefundPaymentRequest,
  RefundPaymentRequestSchema,
} from '../../types/payment.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const resolveAmount = (payload: Record<string, unknown>): number => {
  if (typeof payload.amount === 'number') {
    return Number(payload.amount.toFixed(2));
  }

  if (typeof payload.amount === 'string' && payload.amount.trim().length > 0) {
    return Number(parseFloat(payload.amount).toFixed(2));
  }

  if (typeof payload.amount_in_minor === 'number') {
    return Number((payload.amount_in_minor / 100).toFixed(2));
  }

  if (typeof payload.amount_in_cents === 'number') {
    return Number((payload.amount_in_cents / 100).toFixed(2));
  }

  if (typeof payload.amount_minor === 'number') {
    return Number((payload.amount_minor / 100).toFixed(2));
  }

  throw new Error('Amount is required');
};

export const normalizeCreatePaymentRequest = (
  payload: Record<string, unknown>
): CreatePaymentRequest => {
  const amount = resolveAmount(payload);

  const normalized: Record<string, unknown> = {
    ...payload,
    amount,
    currency: typeof payload.currency === 'string' ? payload.currency.toUpperCase() : payload.currency,
    metadata: isRecord(payload.metadata) ? payload.metadata : {},
  };

  return CreatePaymentRequestSchema.parse(normalized);
};

export const normalizeRefundPaymentRequest = (
  payload: Record<string, unknown>
): RefundPaymentRequest => {
  const normalized: Record<string, unknown> = { ...payload };

  if (payload.amount_in_minor && typeof payload.amount_in_minor === 'number') {
    normalized.amount = Number((payload.amount_in_minor / 100).toFixed(2));
  } else if (payload.amount && typeof payload.amount === 'number') {
    normalized.amount = Number(payload.amount.toFixed(2));
  }

  return RefundPaymentRequestSchema.parse(normalized);
};

export const normalizeListPaymentsQuery = (
  query: Record<string, unknown>
): ListPaymentsQuery => {
  const normalized: Record<string, unknown> = { ...query };

  if (typeof normalized.provider === 'string') {
    normalized.provider = normalized.provider.toLowerCase();
  }

  if (typeof normalized.status === 'string') {
    normalized.status = normalized.status.toLowerCase();
  }

  const limit = Number(normalized.limit ?? 10);
  const offset = Number(normalized.offset ?? 0);

  normalized.limit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 10;
  normalized.offset = Number.isFinite(offset) ? Math.max(Math.floor(offset), 0) : 0;

  return ListPaymentsQuerySchema.parse(normalized);
};
