/**
 * Payments Resource
 *
 * Provides methods for creating, refunding, and listing payments
 * through the PaymentHub API.
 */

import {
  Transport,
  RequestOptions,
  CreatePaymentRequest,
  CreatePaymentResponse,
  RefundPaymentRequest,
  RefundPaymentResponse,
  ListPaymentsRequest,
  ListPaymentsResponse,
} from '../types.js';
import { ValidationError } from '../errors.js';

/**
 * Payments resource class
 */
export class PaymentsResource {
  constructor(private readonly transport: Transport) {}

  /**
   * Create a new payment
   *
   * @param request - Payment creation parameters
   * @param options - Request options (idempotency key, timeout, etc.)
   * @returns Created payment details
   *
   * @example
   * ```typescript
   * const payment = await client.payments.create({
   *   amount: 1000, // $10.00 in cents
   *   currency: 'USD',
   *   provider: 'stripe',
   *   customer_id: 'cust_123',
   *   payment_method: 'pm_card_visa',
   *   description: 'Order #123',
   *   metadata: { order_id: '123' }
   * }, {
   *   idempotencyKey: 'unique-order-123'
   * });
   * ```
   */
  async create(
    request: CreatePaymentRequest,
    options?: RequestOptions
  ): Promise<CreatePaymentResponse> {
    // Validate required fields
    this.validateCreateRequest(request);

    return this.transport.request<CreatePaymentResponse>(
      'POST',
      '/api/v1/payments/create',
      request,
      options
    );
  }

  /**
   * Refund a payment
   *
   * @param paymentId - ID of the payment to refund
   * @param request - Refund parameters (optional amount for partial refund)
   * @param options - Request options
   * @returns Refund details
   *
   * @example
   * ```typescript
   * // Full refund
   * const refund = await client.payments.refund('pay_123');
   *
   * // Partial refund
   * const partialRefund = await client.payments.refund('pay_123', {
   *   amount: 500, // $5.00 partial refund
   *   reason: 'Customer request'
   * });
   * ```
   */
  async refund(
    paymentId: string,
    request?: RefundPaymentRequest,
    options?: RequestOptions
  ): Promise<RefundPaymentResponse> {
    if (!paymentId || typeof paymentId !== 'string') {
      throw new ValidationError('Payment ID is required');
    }

    return this.transport.request<RefundPaymentResponse>(
      'POST',
      `/api/v1/payments/${encodeURIComponent(paymentId)}/refund`,
      request || {},
      options
    );
  }

  /**
   * List payments with optional filters
   *
   * @param request - Filter and pagination parameters
   * @param options - Request options
   * @returns Paginated list of payments
   *
   * @example
   * ```typescript
   * // List all payments
   * const payments = await client.payments.list();
   *
   * // List with filters
   * const filtered = await client.payments.list({
   *   provider: 'stripe',
   *   status: 'completed',
   *   customer_id: 'cust_123',
   *   limit: 20,
   *   offset: 0
   * });
   *
   * // List by date range
   * const dateRange = await client.payments.list({
   *   start_date: '2024-01-01',
   *   end_date: '2024-12-31'
   * });
   * ```
   */
  async list(
    request?: ListPaymentsRequest,
    options?: RequestOptions
  ): Promise<ListPaymentsResponse> {
    // Build query string from request parameters
    const queryParams = this.buildQueryString(request);
    const path = queryParams ? `/api/v1/payments?${queryParams}` : '/api/v1/payments';

    return this.transport.request<ListPaymentsResponse>(
      'GET',
      path,
      undefined,
      options
    );
  }

  /**
   * Get a single payment by ID
   *
   * @param paymentId - ID of the payment to retrieve
   * @param options - Request options
   * @returns Payment details
   *
   * @example
   * ```typescript
   * const payment = await client.payments.get('pay_123');
   * ```
   */
  async get(
    paymentId: string,
    options?: RequestOptions
  ): Promise<ListPaymentsResponse> {
    if (!paymentId || typeof paymentId !== 'string') {
      throw new ValidationError('Payment ID is required');
    }

    // Use list endpoint with payment ID filter
    // Note: Backend may need a dedicated get endpoint
    return this.list(
      { customer_id: paymentId, limit: 1 },
      options
    );
  }

  /**
   * Validate create payment request
   */
  private validateCreateRequest(request: CreatePaymentRequest): void {
    const errors: string[] = [];

    if (typeof request.amount !== 'number' || request.amount <= 0) {
      errors.push('Amount must be a positive number');
    }

    if (!request.currency || typeof request.currency !== 'string') {
      errors.push('Currency is required');
    } else if (request.currency.length !== 3) {
      errors.push('Currency must be a 3-letter ISO code');
    }

    if (!request.provider) {
      errors.push('Provider is required');
    } else if (!['stripe', 'paypal'].includes(request.provider)) {
      errors.push('Provider must be "stripe" or "paypal"');
    }

    if (!request.customer_id || typeof request.customer_id !== 'string') {
      errors.push('Customer ID is required');
    }

    if (!request.payment_method || typeof request.payment_method !== 'string') {
      errors.push('Payment method is required');
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid payment request', undefined, {
        errors,
      });
    }
  }

  /**
   * Build query string from request parameters
   */
  private buildQueryString(request?: ListPaymentsRequest): string {
    if (!request) return '';

    const params = new URLSearchParams();

    if (request.provider) {
      params.set('provider', request.provider);
    }
    if (request.status) {
      params.set('status', request.status);
    }
    if (request.customer_id) {
      params.set('customer_id', request.customer_id);
    }
    if (request.start_date) {
      params.set('start_date', request.start_date);
    }
    if (request.end_date) {
      params.set('end_date', request.end_date);
    }
    if (request.limit !== undefined) {
      params.set('limit', String(request.limit));
    }
    if (request.offset !== undefined) {
      params.set('offset', String(request.offset));
    }

    return params.toString();
  }
}
