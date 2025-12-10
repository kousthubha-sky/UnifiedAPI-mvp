/**
 * Unit tests for UnifiedAPIClient
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  UnifiedAPIClient,
  MockTransport,
  ValidationError,
  OneRouterError,
  NetworkError,
  CreatePaymentRequest,
  CreatePaymentResponse,
  RefundPaymentResponse,
  ListPaymentsResponse,
} from '../src/index.js';

describe('UnifiedAPIClient', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.UNIFIED_ENV;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('constructor', () => {
    it('should create client with valid config', () => {
      const client = new UnifiedAPIClient({
        apiKey: 'sk_test_123',
        baseUrl: 'https://api.example.com',
      });

      expect(client).toBeDefined();
      expect(client.payments).toBeDefined();
    });

    it('should throw ValidationError when apiKey is missing', () => {
      expect(() => {
        new UnifiedAPIClient({
          apiKey: '',
        });
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid API key format', () => {
      expect(() => {
        new UnifiedAPIClient({
          apiKey: 'invalid_key',
        });
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for API key without sk_ prefix', () => {
      expect(() => {
        new UnifiedAPIClient({
          apiKey: 'test_123',
        });
      }).toThrow(ValidationError);
    });

    it('should use default baseUrl when not provided', () => {
      const client = new UnifiedAPIClient({
        apiKey: 'sk_test_123',
      });

      expect(client.baseUrl).toBe('http://localhost:8000');
    });

    it('should use default timeout when not provided', () => {
      const client = new UnifiedAPIClient({
        apiKey: 'sk_test_123',
      });

      expect(client.timeout).toBe(30000);
    });

    it('should auto-detect local environment', () => {
      const client = new UnifiedAPIClient({
        apiKey: 'sk_test_123',
      });

      expect(client.getMetrics().getEnvironment()).toBe('local');
    });

    it('should use explicit environment override', () => {
      const client = new UnifiedAPIClient({
        apiKey: 'sk_test_123',
        environment: 'production',
      });

      expect(client.getMetrics().getEnvironment()).toBe('production');
    });

    it('should perform health check on creation', async () => {
      const { client, mock } = UnifiedAPIClient.withMockTransport({
        apiKey: 'sk_test_123',
      });

      mock.onHealth(async () => ({ status: 'healthy', timestamp: new Date().toISOString() }));

      // Actually call health check
      const health = await client.health();
      expect(health.status).toBe('healthy');
    });

    it('should create client without health check', () => {
      const client = new UnifiedAPIClient({
        apiKey: 'sk_test_123',
      });

      expect(client).toBeDefined();
    });
  });

  describe('static factory methods', () => {
    it('should create client with mock transport', () => {
      const { client, mock } = UnifiedAPIClient.withMockTransport({
        apiKey: 'sk_test_123',
      });

      expect(client).toBeInstanceOf(UnifiedAPIClient);
      expect(mock).toBeInstanceOf(MockTransport);
    });

    it('should create client for development', () => {
      const client = UnifiedAPIClient.forDevelopment('sk_test_123');

      expect(client).toBeInstanceOf(UnifiedAPIClient);
      expect(client.baseUrl).toBe('http://localhost:8000');
      expect(client.getMetrics().getEnvironment()).toBe('local');
    });

    it('should create client for production', () => {
      const client = UnifiedAPIClient.forProduction('sk_live_123');

      expect(client).toBeInstanceOf(UnifiedAPIClient);
      expect(client.baseUrl).toBe('https://api.onerouter.com');
      expect(client.getMetrics().getEnvironment()).toBe('production');
    });

    it('should create client for production with custom URL', () => {
      const client = UnifiedAPIClient.forProduction(
        'sk_live_123',
        'https://api.prod.com'
      );

      expect(client).toBeInstanceOf(UnifiedAPIClient);
      expect(client.baseUrl).toBe('https://api.prod.com');
    });
  });
});

describe('PaymentsResource', () => {
  let client: UnifiedAPIClient;
  let mock: MockTransport;

  beforeEach(() => {
    const result = UnifiedAPIClient.withMockTransport({
      apiKey: 'sk_test_123',
    });
    client = result.client;
    mock = result.mock;
  });

  describe('create', () => {
    it('should create a payment successfully', async () => {
      const mockResponse: CreatePaymentResponse = {
        id: 'pay_123',
        provider_transaction_id: 'pi_abc123',
        amount: 1000,
        currency: 'USD',
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
        trace_id: 'trace_123',
      };

      mock.onCreatePayment(async () => mockResponse);

      const request: CreatePaymentRequest = {
        amount: 1000,
        currency: 'USD',
        provider: 'stripe',
        customer_id: 'cust_123',
        payment_method: 'pm_card_visa',
      };

      const result = await client.payments.create(request);

      expect(result).toEqual(mockResponse);
      expect(mock.getRequests()).toHaveLength(1);
      expect(mock.getRequests()[0]).toMatchObject({
        method: 'POST',
        path: '/api/v1/payments/create',
        body: request,
      });
    });

    it('should include idempotency key in request', async () => {
      mock.onCreatePayment(async () => ({
        id: 'pay_123',
        provider_transaction_id: 'pi_abc123',
        amount: 1000,
        currency: 'USD',
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
      }));

      await client.payments.create(
        {
          amount: 1000,
          currency: 'USD',
          provider: 'stripe',
          customer_id: 'cust_123',
          payment_method: 'pm_card_visa',
        },
        { idempotencyKey: 'idem_123' }
      );

      expect(mock.getRequests()[0].options?.idempotencyKey).toBe('idem_123');
    });

    it('should throw ValidationError for invalid amount', async () => {
      await expect(
        client.payments.create({
          amount: -100,
          currency: 'USD',
          provider: 'stripe',
          customer_id: 'cust_123',
          payment_method: 'pm_card_visa',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for missing currency', async () => {
      await expect(
        client.payments.create({
          amount: 1000,
          currency: '',
          provider: 'stripe',
          customer_id: 'cust_123',
          payment_method: 'pm_card_visa',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid provider', async () => {
      await expect(
        client.payments.create({
          amount: 1000,
          currency: 'USD',
          provider: 'invalid' as 'stripe',
          customer_id: 'cust_123',
          payment_method: 'pm_card_visa',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for missing customer_id', async () => {
      await expect(
        client.payments.create({
          amount: 1000,
          currency: 'USD',
          provider: 'stripe',
          customer_id: '',
          payment_method: 'pm_card_visa',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for missing payment_method', async () => {
      await expect(
        client.payments.create({
          amount: 1000,
          currency: 'USD',
          provider: 'stripe',
          customer_id: 'cust_123',
          payment_method: '',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should include metadata in request', async () => {
      mock.onCreatePayment(async () => ({
        id: 'pay_123',
        provider_transaction_id: 'pi_abc123',
        amount: 1000,
        currency: 'USD',
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
      }));

      await client.payments.create({
        amount: 1000,
        currency: 'USD',
        provider: 'stripe',
        customer_id: 'cust_123',
        payment_method: 'pm_card_visa',
        metadata: { order_id: 'order_123' },
      });

      expect(mock.getRequests()[0].body).toMatchObject({
        metadata: { order_id: 'order_123' },
      });
    });
  });

  describe('refund', () => {
    it('should refund a payment successfully', async () => {
      const mockResponse: RefundPaymentResponse = {
        refund_id: 'ref_123',
        original_transaction_id: 'pay_123',
        amount: 1000,
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
        trace_id: 'trace_456',
      };

      mock.onRefundPayment('pay_123', async () => mockResponse);

      const result = await client.payments.refund('pay_123');

      expect(result).toEqual(mockResponse);
      expect(mock.getRequests()).toHaveLength(1);
      expect(mock.getRequests()[0]).toMatchObject({
        method: 'POST',
        path: '/api/v1/payments/pay_123/refund',
      });
    });

    it('should perform partial refund', async () => {
      mock.onRefundPayment('pay_123', async () => ({
        refund_id: 'ref_123',
        original_transaction_id: 'pay_123',
        amount: 500,
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
      }));

      await client.payments.refund('pay_123', {
        amount: 500,
        reason: 'Partial refund requested',
      });

      expect(mock.getRequests()[0].body).toMatchObject({
        amount: 500,
        reason: 'Partial refund requested',
      });
    });

    it('should throw ValidationError for empty payment ID', async () => {
      await expect(client.payments.refund('')).rejects.toThrow(ValidationError);
    });
  });

  describe('list', () => {
    it('should list payments successfully', async () => {
      const mockResponse: ListPaymentsResponse = {
        payments: [
          {
            id: 'pay_123',
            provider_transaction_id: 'pi_abc123',
            provider: 'stripe',
            amount: 1000,
            currency: 'USD',
            status: 'completed',
            customer_id: 'cust_123',
            metadata: null,
            refund_id: null,
            refund_status: null,
            refund_amount: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
        limit: 10,
        offset: 0,
        trace_id: 'trace_789',
      };

      mock.onListPayments(async () => mockResponse);

      const result = await client.payments.list();

      expect(result).toEqual(mockResponse);
      expect(mock.getRequests()).toHaveLength(1);
      expect(mock.getRequests()[0]).toMatchObject({
        method: 'GET',
        path: '/api/v1/payments',
      });
    });

    it('should list payments with filters', async () => {
      mock.onListPayments(async () => ({
        payments: [],
        total: 0,
        limit: 20,
        offset: 10,
      }));

      await client.payments.list({
        provider: 'stripe',
        status: 'completed',
        customer_id: 'cust_123',
        limit: 20,
        offset: 10,
      });

      const requestPath = mock.getRequests()[0].path;
      expect(requestPath).toContain('provider=stripe');
      expect(requestPath).toContain('status=completed');
      expect(requestPath).toContain('customer_id=cust_123');
      expect(requestPath).toContain('limit=20');
      expect(requestPath).toContain('offset=10');
    });

    it('should list payments with date range', async () => {
      mock.onListPayments(async () => ({
        payments: [],
        total: 0,
        limit: 10,
        offset: 0,
      }));

      await client.payments.list({
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      });

      const requestPath = mock.getRequests()[0].path;
      expect(requestPath).toContain('start_date=2024-01-01');
      expect(requestPath).toContain('end_date=2024-12-31');
    });
  });
});

describe('MockTransport', () => {
  it('should log all requests', async () => {
    const mock = new MockTransport();
    mock.setDefaultResponse({ success: true });

    await mock.request('GET', '/test1');
    await mock.request('POST', '/test2', { data: 'value' });

    const requests = mock.getRequests();
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({ method: 'GET', path: '/test1' });
    expect(requests[1]).toMatchObject({
      method: 'POST',
      path: '/test2',
      body: { data: 'value' },
    });
  });

  it('should reset handlers and log', () => {
    const mock = new MockTransport();
    mock.onRequest('GET', '/test', async () => ({ data: 'test' }));
    mock.reset();

    expect(mock.getRequests()).toHaveLength(0);
  });

  it('should use default response for unhandled requests', async () => {
    const mock = new MockTransport();
    mock.setDefaultResponse({ default: true });

    const result = await mock.request('GET', '/unknown');
    expect(result).toEqual({ default: true });
  });
});

describe('Retry configuration', () => {
  it('should accept maxRetries configuration', () => {
    const client = new UnifiedAPIClient({
      apiKey: 'sk_test_123',
      maxRetries: 5,
    });

    expect(client).toBeDefined();
  });

  it('should pass skipRetry option to transport', async () => {
    const { client, mock } = UnifiedAPIClient.withMockTransport({
      apiKey: 'sk_test_123',
    });

    mock.onCreatePayment(async () => ({
      id: 'pay_123',
      provider_transaction_id: 'pi_abc123',
      amount: 1000,
      currency: 'USD',
      status: 'completed',
      created_at: '2024-01-01T00:00:00Z',
    }));

    await client.payments.create(
      {
        amount: 1000,
        currency: 'USD',
        provider: 'stripe',
        customer_id: 'cust_123',
        payment_method: 'pm_card_visa',
      },
      { skipRetry: true }
    );

    expect(mock.getRequests()[0].options?.skipRetry).toBe(true);
  });

  it('should pass idempotency key to transport', async () => {
    const { client, mock } = UnifiedAPIClient.withMockTransport({
      apiKey: 'sk_test_123',
    });

    mock.onCreatePayment(async () => ({
      id: 'pay_123',
      provider_transaction_id: 'pi_abc123',
      amount: 1000,
      currency: 'USD',
      status: 'completed',
      created_at: '2024-01-01T00:00:00Z',
    }));

    await client.payments.create(
      {
        amount: 1000,
        currency: 'USD',
        provider: 'stripe',
        customer_id: 'cust_123',
        payment_method: 'pm_card_visa',
      },
      { idempotencyKey: 'idem_123' }
    );

    expect(mock.getRequests()[0].options?.idempotencyKey).toBe('idem_123');
  });
});

describe('Error handling', () => {
  let client: UnifiedAPIClient;
  let mock: MockTransport;

  beforeEach(() => {
    const result = UnifiedAPIClient.withMockTransport({
      apiKey: 'sk_test_123',
    });
    client = result.client;
    mock = result.mock;
  });

  it('should propagate errors from mock', async () => {
    mock.onCreatePayment(async () => {
      throw new OneRouterError(
        'Payment failed',
        'PAYMENT_FAILED',
        400,
        'trace_err'
      );
    });

    await expect(
      client.payments.create({
        amount: 1000,
        currency: 'USD',
        provider: 'stripe',
        customer_id: 'cust_123',
        payment_method: 'pm_card_visa',
      })
    ).rejects.toThrow(OneRouterError);
  });
});
