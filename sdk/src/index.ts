/**
 * OneRouter SDK
 *
 * Official Node.js/TypeScript SDK for the OneRouter Unified Payment API.
 *
 * @example
 * ```typescript
 * import { UnifiedAPIClient } from '@OneRouter/sdk';
 *
 * const client = new UnifiedAPIClient({
 *   apiKey: 'sk_your_api_key',
 *   baseUrl: 'https://api.OneRouter.com',
 * });
 *
 * // Create a payment
 * const payment = await client.payments.create({
 *   amount: 1000,
 *   currency: 'USD',
 *   provider: 'stripe',
 *   customer_id: 'cust_123',
 *   payment_method: 'pm_card_visa'
 * });
 * ```
 *
 * @packageDocumentation
 */

// Main client
export { UnifiedAPIClient } from './client.js';

// Types
export type {
  ClientConfig,
  RequestOptions,
  Environment,
  PaymentProvider,
  PaymentStatus,
  CreatePaymentRequest,
  CreatePaymentResponse,
  RefundPaymentRequest,
  RefundPaymentResponse,
  ListPaymentsRequest,
  ListPaymentsResponse,
  PaymentRecord,
  HealthResponse,
  HealthCheckResult,
  RequestMetrics,
  RequestInterceptor,
  ResponseInterceptor,
  ErrorInterceptor,
  APIErrorResponse,
  Transport,
} from './types.js';

export { ErrorCode } from './types.js';

// Errors
export {
  OneRouterError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  PaymentNotFoundError,
  RateLimitError,
  PaymentError,
  RefundError,
  ProviderError,
  NetworkError,
  TimeoutError,
  InternalError,
  isOneRouterError,
  isRetryableError,
} from './errors.js';

// Transport (for advanced usage and testing)
export { HttpTransport, MockTransport } from './transport.js';

// Configuration utilities
export { detectEnvironment, mergeConfig, validateApiKey, getEnvironmentConfig } from './config.js';

// Metrics
export { MetricsCollector } from './metrics.js';

// Resources (for advanced typing)
export { PaymentsResource } from './resources/payments.js';

