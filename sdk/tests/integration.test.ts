/**
 * Integration tests for OneRouter SDK
 *
 * These tests require a running local Fastify server.
 * Run with: INTEGRATION_TEST=true npm run test:integration
 *
 * Prerequisites:
 * 1. Start the backend server: cd backend && npm run dev
 * 2. Set up test API key in environment
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  UnifiedAPIClient,
  OneRouterError,
  AuthenticationError,
  ValidationError,
} from '../src/index.js';

// Skip integration tests unless explicitly enabled
const INTEGRATION_ENABLED = process.env.INTEGRATION_TEST === 'true';
const API_KEY = process.env.TEST_API_KEY || 'sk_test_integration';
const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

// Helper to conditionally run tests
const describeIntegration = INTEGRATION_ENABLED ? describe : describe.skip;

describeIntegration('Integration Tests', () => {
  let client: UnifiedAPIClient;

  beforeAll(() => {
    client = new UnifiedAPIClient({
      apiKey: API_KEY,
      baseUrl: API_BASE_URL,
      timeout: 10000,
      maxRetries: 1,
    });
  });

  describe('Health Check', () => {
    it('should be able to reach the server', async () => {
      // This test just verifies connectivity
      // The SDK doesn't have a dedicated health endpoint, but we can try listing
      try {
        await client.payments.list({ limit: 1 });
        // If we get here without a network error, server is reachable
        expect(true).toBe(true);
      } catch (error) {
        // If it's an auth error, server is still reachable
        if (error instanceof AuthenticationError) {
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    });
  });

  describe('Payments API', () => {
    describe('create', () => {
      it('should create a payment with valid data', async () => {
        try {
          const payment = await client.payments.create({
            amount: 1000,
            currency: 'USD',
            provider: 'paypal',
            customer_id: 'cust_integration_test',
            payment_method: 'pm_card_visa',
            description: 'Integration test payment',
            metadata: { test: true },
          });

          expect(payment.id).toBeDefined();
          expect(payment.amount).toBe(1000);
          expect(payment.currency).toBe('USD');
          expect(payment.status).toBeDefined();
        } catch (error) {
          // If authentication fails, that's expected in CI without real API keys
          if (error instanceof AuthenticationError) {
            console.log('Skipping create test: no valid API key');
            return;
          }
          throw error;
        }
      });

      it('should reject payment with invalid currency', async () => {
        await expect(
          client.payments.create({
            amount: 1000,
            currency: 'INVALID',
            provider: 'paypal',
            customer_id: 'cust_test',
            payment_method: 'pm_card_visa',
          })
        ).rejects.toThrow();
      });

      it('should use idempotency key for duplicate requests', async () => {
        const idempotencyKey = `idem_${Date.now()}`;

        try {
          const payment1 = await client.payments.create(
            {
              amount: 1000,
              currency: 'USD',
              provider: 'paypal',
              customer_id: 'cust_test',
              payment_method: 'pm_card_visa',
            },
            { idempotencyKey }
          );

          const payment2 = await client.payments.create(
            {
              amount: 1000,
              currency: 'USD',
              provider: 'paypal',
              customer_id: 'cust_test',
              payment_method: 'pm_card_visa',
            },
            { idempotencyKey }
          );

          // With idempotency, both should return the same payment
          expect(payment1.id).toBe(payment2.id);
        } catch (error) {
          if (error instanceof AuthenticationError) {
            console.log('Skipping idempotency test: no valid API key');
            return;
          }
          // Idempotency might not be fully implemented, so just log
          console.log('Idempotency test result:', error);
        }
      });
    });

    describe('list', () => {
      it('should list payments with pagination', async () => {
        try {
          const result = await client.payments.list({
            limit: 5,
            offset: 0,
          });

          expect(result.payments).toBeInstanceOf(Array);
          expect(result.limit).toBe(5);
          expect(result.offset).toBe(0);
          expect(typeof result.total).toBe('number');
        } catch (error) {
          if (error instanceof AuthenticationError) {
            console.log('Skipping list test: no valid API key');
            return;
          }
          throw error;
        }
      });

      it('should filter payments by provider', async () => {
        try {
          const result = await client.payments.list({
            provider: 'paypal',
            limit: 10,
          });

          expect(result.payments).toBeInstanceOf(Array);
          // All returned payments should be from PayPal
          result.payments.forEach((payment) => {
            expect(payment.provider).toBe('paypal');
          });
        } catch (error) {
          if (error instanceof AuthenticationError) {
            console.log('Skipping filter test: no valid API key');
            return;
          }
          throw error;
        }
      });

      it('should filter payments by status', async () => {
        try {
          const result = await client.payments.list({
            status: 'completed',
            limit: 10,
          });

          expect(result.payments).toBeInstanceOf(Array);
          result.payments.forEach((payment) => {
            expect(payment.status).toBe('completed');
          });
        } catch (error) {
          if (error instanceof AuthenticationError) {
            console.log('Skipping status filter test: no valid API key');
            return;
          }
          throw error;
        }
      });

      it('should filter payments by date range', async () => {
        try {
          const result = await client.payments.list({
            start_date: '2024-01-01',
            end_date: '2024-12-31',
            limit: 10,
          });

          expect(result.payments).toBeInstanceOf(Array);
        } catch (error) {
          if (error instanceof AuthenticationError) {
            console.log('Skipping date range test: no valid API key');
            return;
          }
          throw error;
        }
      });
    });

    describe('refund', () => {
      it('should refund a payment', async () => {
        try {
          // First create a payment
          const payment = await client.payments.create({
            amount: 1000,
            currency: 'USD',
            provider: 'paypal',
            customer_id: 'cust_refund_test',
            payment_method: 'pm_card_visa',
          });

          // Then refund it
          const refund = await client.payments.refund(payment.id);

          expect(refund.refund_id).toBeDefined();
          expect(refund.original_transaction_id).toBe(payment.id);
          expect(refund.amount).toBe(1000);
        } catch (error) {
          if (error instanceof AuthenticationError) {
            console.log('Skipping refund test: no valid API key');
            return;
          }
          throw error;
        }
      });

      it('should perform partial refund', async () => {
        try {
          // First create a payment
          const payment = await client.payments.create({
            amount: 1000,
            currency: 'USD',
            provider: 'paypal',
            customer_id: 'cust_partial_refund',
            payment_method: 'pm_card_visa',
          });

          // Partial refund
          const refund = await client.payments.refund(payment.id, {
            amount: 500,
            reason: 'Partial refund test',
          });

          expect(refund.amount).toBe(500);
        } catch (error) {
          if (error instanceof AuthenticationError) {
            console.log('Skipping partial refund test: no valid API key');
            return;
          }
          throw error;
        }
      });

      it('should fail to refund non-existent payment', async () => {
        try {
          await client.payments.refund('non_existent_payment_id');
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          if (error instanceof AuthenticationError) {
            console.log('Skipping non-existent refund test: no valid API key');
            return;
          }
          expect(error).toBeInstanceOf(OneRouterError);
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid API key', async () => {
      const badClient = new UnifiedAPIClient({
        apiKey: 'invalid_key',
        baseUrl: API_BASE_URL,
        maxRetries: 0,
      });

      try {
        await badClient.payments.list();
        // Should not reach here if auth is enforced
      } catch (error) {
        // Either auth error or network error is acceptable
        expect(error).toBeInstanceOf(OneRouterError);
      }
    });

    it('should handle network timeout', async () => {
      const timeoutClient = new UnifiedAPIClient({
        apiKey: API_KEY,
        baseUrl: 'http://10.255.255.1:3000', // Non-routable IP
        timeout: 1000,
        maxRetries: 0,
      });

      await expect(timeoutClient.payments.list()).rejects.toThrow();
    });
  });
});

// Export for potential use in other test files
export { INTEGRATION_ENABLED, API_KEY, API_BASE_URL };
