import Stripe from 'stripe';
import {
  CreatePaymentRequest,
  CreatePaymentResponse,
  RefundPaymentResponse,
  ListPaymentsParams,
  AdapterListPaymentsResult,
  PaymentRecord,
  PaymentStatus,
} from '../types/payment.js';
import { PaymentAdapter } from './base.js';
import { auditLog, errorLog } from '../utils/logger.js';
import supabase from '../utils/supabase.js';

export class StripeAdapter implements PaymentAdapter {
  private stripe: Stripe;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.STRIPE_API_KEY;
    if (!key) {
      throw new Error('Stripe API key not provided');
    }
    this.stripe = new Stripe(key, {
      apiVersion: '2024-06-20',
    });
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: toStripeAmount(request.amount),
        currency: request.currency.toLowerCase(),
        payment_method: request.payment_method,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        description: request.description,
        metadata: {
          customer_id: request.customer_id,
          ...request.metadata,
        },
      });

      auditLog('PAYMENT_CREATED', {
        provider: 'stripe',
        transaction_id: paymentIntent.id,
        amount: request.amount,
        currency: request.currency,
        customer_id: request.customer_id,
      });

      return {
        id: paymentIntent.id,
        provider_transaction_id: paymentIntent.id,
        amount: request.amount,
        currency: paymentIntent.currency?.toUpperCase() || request.currency,
        status: mapStripeStatus(paymentIntent.status),
        created_at: new Date(paymentIntent.created * 1000).toISOString(),
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
        payment_intent: transactionId,
        amount: amount ? toStripeAmount(amount) : undefined,
        reason: reason as Stripe.RefundCreateParams.Reason,
      });

      auditLog('PAYMENT_REFUNDED', {
        provider: 'stripe',
        original_transaction_id: transactionId,
        refund_id: refund.id,
        amount: refund.amount ? fromStripeAmount(refund.amount) : amount,
      });

      return {
        refund_id: refund.id,
        original_transaction_id: transactionId,
        amount: refund.amount ? fromStripeAmount(refund.amount) : amount || 0,
        status: mapStripeStatus(refund.status),
        created_at: new Date(refund.created * 1000).toISOString(),
      };
    } catch (error) {
      errorLog(error, { context: 'Stripe refund failed', transactionId });
      throw error;
    }
  }

  async listPayments(params: ListPaymentsParams): Promise<AdapterListPaymentsResult> {
    const limit = params.limit ?? 10;
    const offset = params.offset ?? 0;

    let query = supabase
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('provider', 'stripe')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.customer_id) {
      query = query.eq('customer_id', params.customer_id);
    }
    if (params.start_date) {
      query = query.gte('created_at', params.start_date);
    }
    if (params.end_date) {
      query = query.lte('created_at', params.end_date);
    }

    const { data, error, count } = await query;
    if (error) {
      errorLog(error, { context: 'Stripe adapter listPayments failed' });
      throw error;
    }

    const payments: PaymentRecord[] = (data || []).map((record) => this.mapSupabaseRecord(record));

    return {
      payments,
      total: count ?? payments.length,
    };
  }

  private mapSupabaseRecord(record: Record<string, unknown>): PaymentRecord {
    return {
      id: String(record.id),
      provider_transaction_id: String(record.provider_transaction_id),
      provider: 'stripe',
      amount: Number(record.amount),
      currency: String(record.currency).toUpperCase(),
      status: (record.status as PaymentStatus) || 'pending',
      customer_id: (record.customer_id as string) ?? null,
      metadata: (record.metadata as Record<string, unknown>) ?? null,
      refund_id: (record.refund_id as string) ?? null,
      refund_status: (record.refund_status as string) ?? null,
      refund_amount:
        record.refund_amount === null || record.refund_amount === undefined
          ? null
          : Number(record.refund_amount),
      created_at: String(record.created_at),
      updated_at: String(record.updated_at),
    };
  }
}

const STRIPE_STATUS_MAP: Record<string, PaymentStatus> = {
  succeeded: 'completed',
  requires_action: 'processing',
  requires_capture: 'processing',
  requires_confirmation: 'processing',
  requires_payment_method: 'failed',
  processing: 'processing',
  canceled: 'failed',
  failed: 'failed',
  pending: 'pending',
  refunded: 'refunded',
};

const toStripeAmount = (amount: number): number => Math.round(amount * 100);

const fromStripeAmount = (amount: number): number => Number((amount / 100).toFixed(2));

const mapStripeStatus = (status?: string | null): PaymentStatus => {
  if (!status) {
    return 'pending';
  }

  return STRIPE_STATUS_MAP[status] || 'pending';
};
