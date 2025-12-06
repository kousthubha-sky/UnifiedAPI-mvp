import paypal from 'paypal-rest-sdk';
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
  constructor() {
    const mode = process.env.PAYPAL_MODE || 'sandbox';
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials not provided');
    }

    paypal.configure({
      mode,
      client_id: clientId,
      client_secret: clientSecret,
    });
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return new Promise((resolve, reject) => {
      const payment = {
        intent: 'sale',
        payer: {
          payment_method: 'credit_card',
          payer_info: {
            email: request.customer_id,
          },
        },
        transactions: [
          {
            amount: {
              total: formatPayPalAmount(request.amount),
              currency: request.currency.toUpperCase(),
              details: {
                subtotal: formatPayPalAmount(request.amount),
              },
            },
            description: request.description || 'Payment',
          },
        ],
      };

      paypal.payment.create(payment, (err: unknown, paypalPayment: unknown) => {
        if (err) {
          errorLog(err, { context: 'PayPal payment creation failed', request });
          reject(err);
        } else {
          const paypalPaymentRecord = paypalPayment as Record<string, unknown>;
          auditLog('PAYMENT_CREATED', {
            provider: 'paypal',
            transaction_id: paypalPaymentRecord.id,
            amount: request.amount,
            currency: request.currency,
            customer_id: request.customer_id,
          });

          resolve({
            id: String(paypalPaymentRecord.id),
            provider_transaction_id: String(paypalPaymentRecord.id),
            amount: request.amount,
            currency: request.currency.toUpperCase(),
            status: mapPayPalStatus(String(paypalPaymentRecord.state)),
            created_at: new Date(String(paypalPaymentRecord.create_time)).toISOString(),
            metadata: request.metadata,
          });
        }
      });
    });
  }

  async refundPayment(
    transactionId: string,
    amount?: number,
    _reason?: string
  ): Promise<RefundPaymentResponse> {
    return new Promise((resolve, reject) => {
      const saleId = transactionId;

      const refundRequest = amount
        ? {
            amount: {
              currency: process.env.PAYPAL_CURRENCY || 'USD',
              total: formatPayPalAmount(amount),
            },
          }
        : {};

      paypal.sale.get(saleId, (err: unknown, sale: unknown) => {
        if (err) {
          errorLog(err, { context: 'PayPal sale lookup failed', saleId });
          reject(err);
        } else {
          const saleRecord = sale as Record<string, unknown>;
          const refund = saleRecord.refund as (
            req: Record<string, unknown>,
            cb: (err: unknown, resp: unknown) => void
          ) => void;

          refund(refundRequest, (refundError: unknown, refundResponse: unknown) => {
            if (refundError) {
              errorLog(refundError, { context: 'PayPal refund failed', saleId });
              reject(refundError);
            } else {
              const refundRecord = refundResponse as Record<string, unknown>;
              auditLog('PAYMENT_REFUNDED', {
                provider: 'paypal',
                original_transaction_id: transactionId,
                refund_id: refundRecord.id,
                amount,
              });

              resolve({
                refund_id: String(refundRecord.id),
                original_transaction_id: transactionId,
                amount: extractRefundAmount(refundRecord) ?? amount ?? 0,
                status: mapPayPalStatus(String(refundRecord.state)),
                created_at: new Date(String(refundRecord.create_time)).toISOString(),
              });
            }
          });
        }
      });
    });
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
  created: 'pending',
  pending: 'pending',
  approved: 'processing',
  completed: 'completed',
  failed: 'failed',
  refunded: 'refunded',
  partially_refunded: 'refunded',
  canceled: 'failed',
};

const formatPayPalAmount = (amount: number): string => amount.toFixed(2);

const mapPayPalStatus = (status?: string | null): PaymentStatus => {
  if (!status) {
    return 'pending';
  }

  const normalized = status.toLowerCase();
  return PAYPAL_STATUS_MAP[normalized] || 'pending';
};

const extractRefundAmount = (record: Record<string, unknown>): number | null => {
  const amountRecord = record.amount as { total?: string } | undefined;
  if (amountRecord?.total) {
    return Number(amountRecord.total);
  }
  return null;
};
