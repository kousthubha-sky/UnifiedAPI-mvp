import Stripe from 'stripe';
import {
  CreatePaymentRequest,
  CreatePaymentResponse,
  RefundPaymentResponse,
} from '../types/payment.js';
import { PaymentAdapter } from './base.js';
import { auditLog, errorLog } from '../utils/logger.js';

export class StripeAdapter implements PaymentAdapter {
  private stripe: Stripe;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.STRIPE_API_KEY;
    if (!key) {
      throw new Error('Stripe API key not provided');
    }
    this.stripe = new Stripe(key);
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    try {
      const charge = await this.stripe.charges.create({
        amount: Math.round(request.amount * 100),
        currency: request.currency.toLowerCase(),
        source: request.payment_method,
        description: request.description,
        metadata: {
          customer_id: request.customer_id,
          ...request.metadata,
        },
      });

      auditLog('PAYMENT_CREATED', {
        provider: 'stripe',
        transaction_id: charge.id,
        amount: request.amount,
        currency: request.currency,
        customer_id: request.customer_id,
      });

      return {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        provider_transaction_id: charge.id,
        amount: request.amount,
        currency: request.currency,
        status: charge.paid ? 'completed' : 'pending',
        created_at: new Date(charge.created * 1000).toISOString(),
        metadata: request.metadata,
      };
    } catch (error) {
      errorLog(error, { context: 'Stripe payment creation failed', request });
      throw error;
    }
  }

  async refundPayment(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<RefundPaymentResponse> {
    try {
      const refund = await this.stripe.refunds.create({
        charge: transactionId,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason: reason as Stripe.RefundCreateParams.Reason,
      });

      auditLog('PAYMENT_REFUNDED', {
        provider: 'stripe',
        original_transaction_id: transactionId,
        refund_id: refund.id,
        amount: (refund.amount / 100).toFixed(2),
      });

      return {
        refund_id: refund.id,
        original_transaction_id: transactionId,
        amount: refund.amount / 100,
        status: refund.status === 'succeeded' ? 'completed' : 'pending',
        created_at: new Date(refund.created * 1000).toISOString(),
      };
    } catch (error) {
      errorLog(error, { context: 'Stripe refund failed', transactionId });
      throw error;
    }
  }
}
