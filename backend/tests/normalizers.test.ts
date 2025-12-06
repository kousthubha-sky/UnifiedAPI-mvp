import { describe, it, expect } from 'vitest';
import {
  normalizeCreatePaymentRequest,
  normalizeRefundPaymentRequest,
  normalizeListPaymentsQuery,
} from '../src/api/normalizers/request.js';

describe('Request Normalizers', () => {
  describe('normalizeCreatePaymentRequest', () => {
    it('should normalize currency to uppercase', () => {
      const result = normalizeCreatePaymentRequest({
        amount: 100.50,
        currency: 'usd',
        provider: 'stripe',
        customer_id: 'cust_123',
        payment_method: 'pm_123',
      });

      expect(result.currency).toBe('USD');
    });

    it('should convert amount_in_minor to major units', () => {
      const result = normalizeCreatePaymentRequest({
        amount_in_minor: 10050,
        currency: 'USD',
        provider: 'stripe',
        customer_id: 'cust_123',
        payment_method: 'pm_123',
      });

      expect(result.amount).toBe(100.50);
    });

    it('should convert amount_in_cents to major units', () => {
      const result = normalizeCreatePaymentRequest({
        amount_in_cents: 5099,
        currency: 'USD',
        provider: 'stripe',
        customer_id: 'cust_123',
        payment_method: 'pm_123',
      });

      expect(result.amount).toBe(50.99);
    });

    it('should handle string amounts', () => {
      const result = normalizeCreatePaymentRequest({
        amount: '75.25',
        currency: 'EUR',
        provider: 'paypal',
        customer_id: 'cust_123',
        payment_method: 'pm_123',
      });

      expect(result.amount).toBe(75.25);
    });

    it('should round amount to 2 decimal places', () => {
      const result = normalizeCreatePaymentRequest({
        amount: 99.99999,
        currency: 'USD',
        provider: 'stripe',
        customer_id: 'cust_123',
        payment_method: 'pm_123',
      });

      expect(result.amount).toBe(100.00);
    });

    it('should set empty metadata if not provided', () => {
      const result = normalizeCreatePaymentRequest({
        amount: 50,
        currency: 'USD',
        provider: 'stripe',
        customer_id: 'cust_123',
        payment_method: 'pm_123',
      });

      expect(result.metadata).toEqual({});
    });

    it('should throw error if amount is not provided', () => {
      expect(() => {
        normalizeCreatePaymentRequest({
          currency: 'USD',
          provider: 'stripe',
          customer_id: 'cust_123',
          payment_method: 'pm_123',
        });
      }).toThrow();
    });
  });

  describe('normalizeRefundPaymentRequest', () => {
    it('should normalize amount_in_minor to major units', () => {
      const result = normalizeRefundPaymentRequest({
        amount_in_minor: 2550,
        reason: 'customer request',
      });

      expect(result.amount).toBe(25.50);
    });

    it('should round amount to 2 decimal places', () => {
      const result = normalizeRefundPaymentRequest({
        amount: 10.12345,
      });

      expect(result.amount).toBe(10.12);
    });

    it('should accept request without amount', () => {
      const result = normalizeRefundPaymentRequest({
        reason: 'duplicate charge',
      });

      expect(result.amount).toBeUndefined();
      expect(result.reason).toBe('duplicate charge');
    });

    it('should accept request without reason', () => {
      const result = normalizeRefundPaymentRequest({
        amount: 15.00,
      });

      expect(result.amount).toBe(15.00);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('normalizeListPaymentsQuery', () => {
    it('should lowercase provider', () => {
      const result = normalizeListPaymentsQuery({
        provider: 'STRIPE',
      });

      expect(result.provider).toBe('stripe');
    });

    it('should lowercase status', () => {
      const result = normalizeListPaymentsQuery({
        status: 'COMPLETED',
      });

      expect(result.status).toBe('completed');
    });

    it('should set default limit', () => {
      const result = normalizeListPaymentsQuery({});

      expect(result.limit).toBe(10);
    });

    it('should set default offset', () => {
      const result = normalizeListPaymentsQuery({});

      expect(result.offset).toBe(0);
    });

    it('should cap limit at 100', () => {
      const result = normalizeListPaymentsQuery({
        limit: 500,
      });

      expect(result.limit).toBe(100);
    });

    it('should enforce minimum limit of 1', () => {
      const result = normalizeListPaymentsQuery({
        limit: 0,
      });

      expect(result.limit).toBe(1);
    });

    it('should enforce minimum offset of 0', () => {
      const result = normalizeListPaymentsQuery({
        offset: -5,
      });

      expect(result.offset).toBe(0);
    });

    it('should parse string limit and offset', () => {
      const result = normalizeListPaymentsQuery({
        limit: '25',
        offset: '10',
      });

      expect(result.limit).toBe(25);
      expect(result.offset).toBe(10);
    });

    it('should accept all filter parameters', () => {
      const result = normalizeListPaymentsQuery({
        provider: 'paypal',
        status: 'completed',
        customer_id: 'cust_123',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        limit: 50,
        offset: 20,
      });

      expect(result).toEqual({
        provider: 'paypal',
        status: 'completed',
        customer_id: 'cust_123',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        limit: 50,
        offset: 20,
      });
    });
  });
});
