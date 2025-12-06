import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPaymentRoutes } from '../src/api/routes/payments.js';
import { PaymentError, registerErrorHandler } from '../src/api/middleware/errorHandler.js';
import type { FastifyInstance } from 'fastify';

vi.mock('../src/api/services/paymentService.js', () => ({
  createPayment: vi.fn(),
  refundPayment: vi.fn(),
  listPayments: vi.fn(),
}));

import * as paymentService from '../src/api/services/paymentService.js';

const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify();
  await registerErrorHandler(app);
  await registerPaymentRoutes(app);
  await app.ready();
  return app;
};

describe('Payment Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
    vi.clearAllMocks();
  });

  it('POST /api/v1/payments/create should normalize payload and return trace header', async () => {
    const mockResponse = {
      id: 'pay_123',
      provider_transaction_id: 'pi_123',
      amount: 100.5,
      currency: 'USD',
      status: 'completed',
      created_at: new Date().toISOString(),
      trace_id: 'trace-create',
      metadata: {},
    };

    vi.mocked(paymentService.createPayment).mockResolvedValueOnce(mockResponse);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/create',
      payload: {
        amount_in_minor: 10050,
        currency: 'usd',
        provider: 'stripe',
        customer_id: 'cust_123',
        payment_method: 'pm_123',
        metadata: null,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers['x-trace-id']).toBe('trace-create');

    expect(paymentService.createPayment).toHaveBeenCalledWith({
      amount: 100.5,
      currency: 'USD',
      provider: 'stripe',
      customer_id: 'cust_123',
      payment_method: 'pm_123',
      metadata: {},
    });

    const body = response.json();
    expect(body.trace_id).toBe('trace-create');
    expect(body.amount).toBe(100.5);
  });

  it('POST /api/v1/payments/:id/refund should pass normalized payload to service', async () => {
    const mockResponse = {
      refund_id: 're_123',
      original_transaction_id: 'pi_123',
      amount: 25.5,
      status: 'completed',
      created_at: new Date().toISOString(),
      trace_id: 'trace-refund',
    };

    vi.mocked(paymentService.refundPayment).mockResolvedValueOnce(mockResponse);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/pi_123/refund',
      payload: {
        amount_in_minor: 2550,
        reason: 'requested_by_customer',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-trace-id']).toBe('trace-refund');

    expect(paymentService.refundPayment).toHaveBeenCalledWith(
      'pi_123',
      25.5,
      'requested_by_customer',
      undefined
    );

    const body = response.json();
    expect(body.refund_id).toBe('re_123');
    expect(body.trace_id).toBe('trace-refund');
  });

  it('GET /api/v1/payments should normalize query params', async () => {
    const mockResponse = {
      payments: [],
      total: 0,
      limit: 10,
      offset: 0,
      trace_id: 'trace-list',
    };

    vi.mocked(paymentService.listPayments).mockResolvedValueOnce(mockResponse);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/payments?provider=PAYPAL&status=COMPLETED&limit=50&offset=10',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-trace-id']).toBe('trace-list');

    expect(paymentService.listPayments).toHaveBeenCalledWith({
      provider: 'paypal',
      status: 'completed',
      limit: 50,
      offset: 10,
    });

    const body = response.json();
    expect(body.trace_id).toBe('trace-list');
  });

  it('should propagate PaymentError from service', async () => {
    const error = new PaymentError('PAYMENT_FAILED', 'Provider error', 400);
    vi.mocked(paymentService.createPayment).mockRejectedValueOnce(error);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/create',
      payload: {
        amount: 10,
        currency: 'usd',
        provider: 'stripe',
        customer_id: 'cust_123',
        payment_method: 'pm_123',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.code).toBe('PAYMENT_FAILED');
  });
});
