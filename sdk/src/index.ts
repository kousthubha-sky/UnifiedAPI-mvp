/**
 * PaymentHub SDK
 *
 * Official Node.js/TypeScript SDK for the PaymentHub Unified Payment API.
 *
 * @example
 * ```typescript
 * import { UnifiedAPIClient } from '@paymenthub/sdk';
 *
 * const client = new UnifiedAPIClient({
 *   apiKey: 'sk_your_api_key',
 *   baseUrl: 'https://api.paymenthub.com',
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
  PaymentProvider,
  PaymentStatus,
  CreatePaymentRequest,
  CreatePaymentResponse,
  RefundPaymentRequest,
  RefundPaymentResponse,
  ListPaymentsRequest,
  ListPaymentsResponse,
  PaymentRecord,
  APIErrorResponse,
  Transport,
} from './types.js';

export { ErrorCode } from './types.js';

// Errors
export {
  PaymentHubError,
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
  isPaymentHubError,
  isRetryableError,
} from './errors.js';

// Transport (for advanced usage and testing)
export { HttpTransport, MockTransport } from './transport.js';

// Resources (for advanced typing)
export { PaymentsResource } from './resources/payments.js';
