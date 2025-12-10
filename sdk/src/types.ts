/**
 * OneRouter SDK Types
 */

// Environment Types
export type Environment = 'local' | 'staging' | 'production';

// Configuration Types
export interface ClientConfig {
  /** API key for authentication (sk_...) */
  apiKey: string;
  /** Base URL of the OneRouter API */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Enable HMAC request signing */
  enableSigning?: boolean;
  /** HMAC secret for request signing (defaults to apiKey if not provided) */
  signingSecret?: string;
  /** Environment override (auto-detected if not provided) */
  environment?: Environment;
  /** Request interceptors */
  requestInterceptors?: RequestInterceptor[];
  /** Response interceptors */
  responseInterceptors?: ResponseInterceptor<unknown>[];
  /** Error interceptors */
  errorInterceptors?: ErrorInterceptor[];
  /** Response cache TTL in milliseconds (default: 300000 = 5 minutes) */
  cacheTtlMs?: number;
  /** Maximum number of entries in response cache (default: 1000) */
  cacheMaxSize?: number;
  /** Interval for periodic cache cleanup in milliseconds (default: 60000 = 1 minute) */
  cacheCleanupIntervalMs?: number;
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
  /** Skip response caching for this request */
  skipCache?: boolean;
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
  created_at: number;
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
  created_at: number;
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
   created_at: number;
   /** Last update timestamp */
   updated_at: number;
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



// Health Check Types
export interface HealthResponse {
  /** Server status */
  status: string;
  /** Current timestamp */
  timestamp: string;
}

// Metrics Types
export interface RequestMetrics {
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** Request duration in milliseconds */
  duration: number;
  /** HTTP status code */
  statusCode: number;
  /** Whether the request was successful */
  success: boolean;
  /** Timestamp of the request */
  timestamp: number;
  /** Environment tag */
  environment: Environment;
  /** Request trace ID */
  traceId?: string;
}

export interface HealthCheckResult {
  /** Overall health status */
  status: 'healthy' | 'unhealthy';
  /** Timestamp of the check */
  timestamp: string;
  /** Latency in milliseconds */
  latency: number;
  /** Individual service checks */
  services: {
    /** API connectivity check */
    api: { status: 'ok' | 'error'; latency: number; error?: string };
    /** Authentication check */
    auth: { status: 'ok' | 'error'; latency: number; error?: string };
    /** Payments service check */
    payments?: { status: 'ok' | 'error'; latency: number; error?: string };
  };
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
  /** Skip response caching for this request */
  skipCache?: boolean;
}

// Connection Types (for hybrid Connect + BYOK)
export type ConnectionType = 'connect' | 'api_key';

// Payment Request/Response Types
export interface CreatePaymentRequest {
  /** Amount in cents (e.g., 1000 = $10.00) */
  amount: number;
  /** Three-letter ISO currency code (e.g., 'usd', 'eur') */
  currency: string;
  /** Optional description */
  description?: string;
  /** Optional customer email */
  customer_email?: string;
  /** Optional customer name */
  customer_name?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface CreatePaymentResponse {
  /** Payment ID (Stripe format: pi_...) */
  id: string;
  /** Payment amount in cents */
  amount: number;
  /** Currency code */
  currency: string;
  /** Payment status */
  status: PaymentStatus;
  /** Payment provider (always 'stripe' for now) */
  provider: PaymentProvider;
  /** Connection type used ('connect' or 'api_key') */
  connection_type: ConnectionType;
  /** Client secret for frontend payment confirmation */
  client_secret: string;
  /** Creation timestamp (Unix timestamp) */
  created_at: number;
}

export interface RefundPaymentRequest {
  /** Optional partial refund amount in cents (defaults to full refund) */
  amount?: number;
  /** Reason for refund */
  reason?: string;
}

export interface RefundPaymentResponse {
  /** Refund ID (Stripe format: re_...) */
  id: string;
  /** Original payment ID */
  payment_id: string;
  /** Refunded amount in cents */
  amount: number;
  /** Refund status */
  status: PaymentStatus;
}

export interface ListPaymentsRequest {
  /** Maximum results to return (default: 10) */
  limit?: number;
  /** Number of results to skip */
  offset?: number;
  /** Filter by status */
  status?: PaymentStatus;
}

export interface PaymentRecord {
  /** Payment ID */
  id: string;
  /** Payment amount in cents */
  amount: number;
  /** Currency code */
  currency: string;
  /** Payment status */
  status: PaymentStatus;
  /** Payment provider */
  provider: PaymentProvider;
  /** Connection type used */
  connection_type: ConnectionType;
  /** Creation timestamp (Unix timestamp) */
  created_at: number;
}

export interface ListPaymentsResponse {
  /** Array of payment records */
  data: PaymentRecord[];
  /** Total count of matching records */
  total: number;
  /** Whether there are more results */
  has_more: boolean;
}

// Error Types
export interface APIErrorResponse {
  /** Error message (new format) */
  detail?: string;
  /** Error message (old format) */
  error?: string;
  /** Error code (old format) */
  code?: string;
  /** Additional error details (old format) */
  details?: Record<string, unknown>;
  /** Additional error details (new format) */
  errors?: Record<string, unknown>;
  /** Request trace ID */
  trace_id?: string;
}




// Health Check Types
export interface HealthResponse {
  /** Server status */
  status: string;
  /** Current timestamp */
  timestamp: string;
  /** API version */
  version?: string;
}

// Metrics Types
export interface RequestMetrics {
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** Request duration in milliseconds */
  duration: number;
  /** HTTP status code */
  statusCode: number;
  /** Whether the request was successful */
  success: boolean;
  /** Timestamp of the request */
  timestamp: number;
  /** Environment tag */
  environment: Environment;
  /** Request trace ID */
  traceId?: string;
}

// Interceptor Types
export interface RequestInterceptor {
  (request: {
    method: string;
    path: string;
    body?: unknown;
    options?: RequestOptions;
  }): {
    method: string;
    path: string;
    body?: unknown;
    options?: RequestOptions;
  } | Promise<{
    method: string;
    path: string;
    body?: unknown;
    options?: RequestOptions;
  }>;
}

export interface ResponseInterceptor<T = unknown> {
  (response: {
    data: T;
    status: number;
    headers: Record<string, string>;
  }): T | Promise<T>;
}

export interface ErrorInterceptor {
  (error: Error): Error | Promise<Error>;
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
