// src/services/payments.ts
import { BaseService } from './base.js';
import {
  CreatePaymentRequest,
  CreatePaymentResponse,
  RefundPaymentRequest,
  RefundPaymentResponse,
  ListPaymentsRequest,
  ListPaymentsResponse
} from '../types.js';

/**
 * Payment service for creating, refunding, and listing payments
 */
export class PaymentService extends BaseService {
  /**
   * Create a new payment
   */
  async create(params: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return this.request('payments', 'create', params);
  }

  /**
   * Refund a payment
   */
  async refund(paymentId: string, params?: RefundPaymentRequest): Promise<RefundPaymentResponse> {
    return this.request('payments', 'refund', { paymentId, ...params });
  }

  /**
   * List payments with optional filters
   */
  async list(params?: ListPaymentsRequest): Promise<ListPaymentsResponse> {
    return this.request('payments', 'list', params);
  }
}