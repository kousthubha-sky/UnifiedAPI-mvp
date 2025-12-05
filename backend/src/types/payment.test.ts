import { describe, it, expect } from 'vitest';
import { CreatePaymentRequestSchema, RefundPaymentRequestSchema } from './payment.js';

describe('Payment Schemas', () => {
  it('should validate a valid create payment request', () => {
    const validPayload = {
      amount: 100.0,
      currency: 'USD',
      provider: 'stripe',
      customer_id: 'cust_123',
      payment_method: 'tok_visa',
    };

    const result = CreatePaymentRequestSchema.parse(validPayload);
    expect(result.amount).toBe(100.0);
    expect(result.currency).toBe('USD');
  });

  it('should reject negative amount', () => {
    const invalidPayload = {
      amount: -100.0,
      currency: 'USD',
      provider: 'stripe',
      customer_id: 'cust_123',
      payment_method: 'tok_visa',
    };

    expect(() => CreatePaymentRequestSchema.parse(invalidPayload)).toThrow();
  });

  it('should validate a refund payment request', () => {
    const validPayload = {
      reason: 'customer_request',
      amount: 50.0,
    };

    const result = RefundPaymentRequestSchema.parse(validPayload);
    expect(result.amount).toBe(50.0);
  });
});
