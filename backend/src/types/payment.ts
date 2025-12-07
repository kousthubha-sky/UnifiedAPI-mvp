import { z } from 'zod';

export const PaymentProviderSchema = z.enum(['stripe', 'paypal']);
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>;

export const PaymentStatusSchema = z.enum(['pending', 'completed', 'failed', 'refunded', 'processing']);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const CreatePaymentRequestSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be 3-letter code').toUpperCase(),
  provider: PaymentProviderSchema,
  description: z.string().optional(),
  customer_id: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
  payment_method: z.string(),
});

export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;

export const RefundPaymentRequestSchema = z.object({
  reason: z.string().optional(),
  amount: z.number().positive('Refund amount must be positive').optional(),
});

export type RefundPaymentRequest = z.infer<typeof RefundPaymentRequestSchema>;

export const CreatePaymentResponseSchema = z.object({
  id: z.string(),
  provider_transaction_id: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: PaymentStatusSchema,
  created_at: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
  trace_id: z.string().optional(),
  provider_metadata: z.record(z.string(), z.any()).optional(),
  client_secret: z.string().optional(),
});

export type CreatePaymentResponse = z.infer<typeof CreatePaymentResponseSchema>;

export const RefundPaymentResponseSchema = z.object({
  refund_id: z.string(),
  original_transaction_id: z.string(),
  amount: z.number(),
  status: PaymentStatusSchema,
  created_at: z.string(),
  trace_id: z.string().optional(),
  provider_metadata: z.record(z.string(), z.any()).optional(),
});

export type RefundPaymentResponse = z.infer<typeof RefundPaymentResponseSchema>;

// List payments query parameters
export const ListPaymentsQuerySchema = z.object({
  provider: PaymentProviderSchema.optional(),
  status: PaymentStatusSchema.optional(),
  customer_id: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(10),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type ListPaymentsQuery = z.infer<typeof ListPaymentsQuerySchema>;

// List payments response
export const PaymentRecordSchema = z.object({
  id: z.string(),
  provider_transaction_id: z.string(),
  provider: PaymentProviderSchema,
  amount: z.number(),
  currency: z.string(),
  status: PaymentStatusSchema,
  customer_id: z.string().nullable(),
  metadata: z.record(z.string(), z.any()).nullable(),
  refund_id: z.string().nullable(),
  refund_status: z.string().nullable(),
  refund_amount: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type PaymentRecord = z.infer<typeof PaymentRecordSchema>;

export const ListPaymentsResponseSchema = z.object({
  payments: z.array(PaymentRecordSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  trace_id: z.string().optional(),
});

export type ListPaymentsResponse = z.infer<typeof ListPaymentsResponseSchema>;

// Error codes enum
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_PROVIDER = 'INVALID_PROVIDER',
  PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REFUND_FAILED = 'REFUND_FAILED',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
  trace_id?: string;
}

// Adapter list params
export interface ListPaymentsParams {
  provider?: PaymentProvider;
  status?: PaymentStatus;
  customer_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface AdapterListPaymentsResult {
  payments: PaymentRecord[];
  total: number;
}
