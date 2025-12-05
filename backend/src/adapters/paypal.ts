import paypal from 'paypal-rest-sdk';
import {
  CreatePaymentRequest,
  CreatePaymentResponse,
  RefundPaymentResponse,
} from '../types/payment.js';
import { PaymentAdapter } from './base.js';
import { auditLog, errorLog } from '../utils/logger.js';

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
              total: request.amount.toString(),
              currency: request.currency,
              details: {
                subtotal: request.amount.toString(),
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
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            provider_transaction_id: String(paypalPaymentRecord.id),
            amount: request.amount,
            currency: request.currency,
            status: paypalPaymentRecord.state === 'created' ? 'pending' : 'completed',
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
              total: amount.toString(),
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
                amount: amount || 0,
                status: refundRecord.state === 'completed' ? 'completed' : 'pending',
                created_at: new Date(String(refundRecord.create_time)).toISOString(),
              });
            }
          });
        }
      });
    });
  }
}
