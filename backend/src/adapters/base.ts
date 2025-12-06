import { 
  CreatePaymentRequest, 
  CreatePaymentResponse, 
  RefundPaymentResponse,
  ListPaymentsParams,
  AdapterListPaymentsResult
} from '../types/payment.js';

export interface PaymentAdapter {
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>;
  refundPayment(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<RefundPaymentResponse>;
  listPayments(params: ListPaymentsParams): Promise<AdapterListPaymentsResult>;
}

export interface AdapterConfig {
  apiKey?: string;
  secretKey?: string;
  webhookSecret?: string;
}
