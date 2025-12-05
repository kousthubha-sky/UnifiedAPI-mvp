import { CreatePaymentRequest, CreatePaymentResponse, RefundPaymentResponse } from '../types/payment.js';

export interface PaymentAdapter {
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>;
  refundPayment(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<RefundPaymentResponse>;
}

export interface AdapterConfig {
  apiKey?: string;
  secretKey?: string;
  webhookSecret?: string;
}
