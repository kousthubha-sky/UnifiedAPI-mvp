import { Client, Environment, CheckoutPaymentIntent } from '@paypal/paypal-server-sdk';
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

export class PayPalAdapter implements PaymentAdapter {
  private client: Client;

  constructor() {
    const mode = process.env.PAYPAL_MODE || 'sandbox';
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials not provided');
    }

    this.client = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: clientId,
        oAuthClientSecret: clientSecret,
      },
      environment: mode === 'production' ? Environment.Production : Environment.Sandbox,
    });
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    try {
      const orderRequest = {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          {
            amount: {
              currencyCode: request.currency.toUpperCase(),
              value: formatPayPalAmount(request.amount),
            },
            description: request.description || 'Payment',
          },
        ],
        applicationContext: {
          returnUrl: process.env.PAYPAL_RETURN_URL || 'http://localhost:3000/success',
          cancelUrl: process.env.PAYPAL_CANCEL_URL || 'http://localhost:3000/cancel',
        },
      };

      const { result } = await this.client.getOrdersController().createOrder({
        body: orderRequest,
        prefer: 'return=representation',
      });

      auditLog('PAYMENT_CREATED', {
        provider: 'paypal',
        transaction_id: result.id,
        amount: request.amount,
        currency: request.currency,
        customer_id: request.customer_id,
      });

      return {
        id: result.id,
        provider_transaction_id: result.id,
        amount: request.amount,
        currency: request.currency.toUpperCase(),
        status: mapPayPalStatus(result.status),
        created_at: result.createTime,
        metadata: request.metadata,
      };
    } catch (error) {
      errorLog(error, { context: 'PayPal order creation failed', request });
      throw error;
    }
  }

  async refundPayment(
    transactionId: string,
    amount?: number,
    _reason?: string
  ): Promise<RefundPaymentResponse> {
    try {
      // First capture the order if not already captured
      const captureRequest = {};
      const { result: captureResult } = await this.client.getOrdersController().captureOrder({
        id: transactionId,
        body: captureRequest,
        prefer: 'return=representation',
      });

      // Get the capture ID from the capture result
      const captureId = captureResult.purchaseUnits?.[0]?.payments?.captures?.[0]?.id;
      if (!captureId) {
        throw new Error('Failed to capture payment for refund');
      }

      // Now refund the captured payment
      const refundRequest = amount
        ? {
            amount: {
              currencyCode: process.env.PAYPAL_CURRENCY || 'USD',
              value: formatPayPalAmount(amount),
            },
          }
        : {};

      const { result: refundResult } = await this.client.getPaymentsController().refundCapturedPayment({
        captureId,
        body: refundRequest,
        prefer: 'return=representation',
      });

      auditLog('PAYMENT_REFUNDED', {
        provider: 'paypal',
        original_transaction_id: transactionId,
        refund_id: refundResult.id,
        amount,
      });

      return {
        refund_id: refundResult.id,
        original_transaction_id: transactionId,
        amount: amount || 0,
        status: mapPayPalStatus(refundResult.status),
        created_at: refundResult.createTime,
      };
    } catch (error) {
      errorLog(error, { context: 'PayPal refund failed', transactionId });
      throw error;
    }
  }

  async listPayments(params: ListPaymentsParams): Promise<AdapterListPaymentsResult> {
    const limit = params.limit ?? 10;
    const offset = params.offset ?? 0;

    let query = supabase
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('provider', 'paypal')
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
      errorLog(error, { context: 'PayPal adapter listPayments failed' });
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
      provider: 'paypal',
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

const PAYPAL_STATUS_MAP: Record<string, PaymentStatus> = {
  CREATED: 'pending',
  APPROVED: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'refunded',
};

const formatPayPalAmount = (amount: number): string => amount.toFixed(2);

const mapPayPalStatus = (status?: string | null): PaymentStatus => {
  if (!status) {
    return 'pending';
  }

  return PAYPAL_STATUS_MAP[status] || 'pending';
};
