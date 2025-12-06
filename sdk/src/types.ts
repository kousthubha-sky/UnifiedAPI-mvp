/**
 * PaymentHub SDK Types
 */

// Configuration Types
export interface ClientConfig {
  /** API key for authentication (sk_...) */
  apiKey: string;
  /** Base URL of the PaymentHub API */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Enable HMAC request signing */
  enableSigning?: boolean;
  /** HMAC secret for request signing (defaults to apiKey if not provided) */
  signingSecret?: string;
}

export interface RequestOptions {
  /** Idempotency key for safe retries */
  idempotencyKey?: string;
  /** Custom timeout for this request */
  timeout?: number;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Skip retries for this request */
  skipRetry?: boolean;
}

// Payment Provider Types
export type PaymentProvider = 'stripe' | 'paypal';

// Payment Status Types
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'processing';

// Payment Request/Response Types
export interface CreatePaymentRequest {
  /** Amount in the smallest currency unit (cents for USD) */
  amount: number;
  /** Three-letter ISO currency code (e.g., 'USD', 'EUR') */
  currency: string;
  /** Payment provider to use */
  provider: PaymentProvider;
  /** Customer identifier */
  customer_id: string;
  /** Payment method identifier (e.g., Stripe PaymentMethod ID) */
  payment_method: string;
  /** Optional description */
  description?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface CreatePaymentResponse {
  /** Internal payment ID */
  id: string;
  /** Provider's transaction ID */
  provider_transaction_id: string;
  /** Payment amount */
  amount: number;
  /** Currency code */
  currency: string;
  /** Payment status */
  status: PaymentStatus;
  /** Creation timestamp */
  created_at: string;
  /** Request trace ID */
  trace_id?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Provider-specific metadata */
  provider_metadata?: Record<string, unknown>;
}

export interface RefundPaymentRequest {
  /** Optional partial refund amount (defaults to full refund) */
  amount?: number;
  /** Reason for refund */
  reason?: string;
}

export interface RefundPaymentResponse {
  /** Refund ID */
  refund_id: string;
  /** Original transaction ID */
  original_transaction_id: string;
  /** Refunded amount */
  amount: number;
  /** Refund status */
  status: PaymentStatus;
  /** Creation timestamp */
  created_at: string;
  /** Request trace ID */
  trace_id?: string;
  /** Provider-specific metadata */
  provider_metadata?: Record<string, unknown>;
}

export interface ListPaymentsRequest {
  /** Filter by provider */
  provider?: PaymentProvider;
  /** Filter by status */
  status?: PaymentStatus;
  /** Filter by customer ID */
  customer_id?: string;
  /** Filter by start date (ISO 8601) */
  start_date?: string;
  /** Filter by end date (ISO 8601) */
  end_date?: string;
  /** Maximum results to return (default: 10, max: 100) */
  limit?: number;
  /** Number of results to skip */
  offset?: number;
}

export interface PaymentRecord {
  /** Internal payment ID */
  id: string;
  /** Provider's transaction ID */
  provider_transaction_id: string;
  /** Payment provider */
  provider: PaymentProvider;
  /** Payment amount */
  amount: number;
  /** Currency code */
  currency: string;
  /** Payment status */
  status: PaymentStatus;
  /** Customer ID (nullable) */
  customer_id: string | null;
  /** Custom metadata (nullable) */
  metadata: Record<string, unknown> | null;
  /** Refund ID if refunded (nullable) */
  refund_id: string | null;
  /** Refund status (nullable) */
  refund_status: string | null;
  /** Refund amount (nullable) */
  refund_amount: number | null;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

export interface ListPaymentsResponse {
  /** Array of payment records */
  payments: PaymentRecord[];
  /** Total count of matching records */
  total: number;
  /** Current limit */
  limit: number;
  /** Current offset */
  offset: number;
  /** Request trace ID */
  trace_id?: string;
}

// Error Types
export interface APIErrorResponse {
  /** Error message */
  error: string;
  /** Error code */
  code: string;
  /** Additional error details */
  details?: Record<string, unknown>;
  /** Request trace ID */
  trace_id?: string;
}

// Error Codes from the backend
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_PROVIDER = 'INVALID_PROVIDER',
  PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REFUND_FAILED = 'REFUND_FAILED',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

// Transport Interface (for testing)
export interface Transport {
  request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T>;
}
