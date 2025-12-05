import { z } from 'zod';

export const PaymentProviderSchema = z.enum(['stripe', 'paypal']);
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>;

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
  status: z.enum(['pending', 'completed', 'failed']),
  created_at: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type CreatePaymentResponse = z.infer<typeof CreatePaymentResponseSchema>;

export const RefundPaymentResponseSchema = z.object({
  refund_id: z.string(),
  original_transaction_id: z.string(),
  amount: z.number(),
  status: z.enum(['pending', 'completed', 'failed']),
  created_at: z.string(),
});

export type RefundPaymentResponse = z.infer<typeof RefundPaymentResponseSchema>;

export interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
