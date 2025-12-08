/**
 * UnifiedAPIClient - Main SDK Client
 *
 * The primary entry point for the OneRouter SDK.
 * Provides a unified interface to interact with payment operations.
 */

import {
  ClientConfig,
  Transport,
  RequestOptions,
} from './types.js';
import { HttpTransport, MockTransport } from './transport.js';
import { PaymentsResource } from './resources/payments.js';
import { CustomersResource } from './resources/customers.js';
import { ApiKeysResource } from './resources/api_keys.js';
import { ValidationError } from './errors.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<ClientConfig> = {
  baseUrl: 'http://localhost:8000',
  timeout: 30000,
  maxRetries: 3,
  enableSigning: false,
};

/**
 * UnifiedAPIClient - Main SDK Client
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
 *
 * // Refund a payment
 * const refund = await client.payments.refund(payment.id);
 *
 * // List payments
 * const payments = await client.payments.list({
 *   status: 'completed',
 *   limit: 10
 * });
 *
 * // Create a customer
 * const customer = await client.customers.create({
 *   email: 'user@example.com',
 *   tier: 'starter'
 * });
 *
 * // Create an API key
 * const apiKey = await client.apiKeys.create({
 *   name: 'My App',
 *   customer_id: customer.id
 * });
 *
 * // Check server health
 * const health = await client.health();
 * ```
 */
export class UnifiedAPIClient {
  /**
   * Payments resource for creating, refunding, and listing payments
   */
  public readonly payments: PaymentsResource;

  /**
   * Customers resource for managing customer accounts
   */
  public readonly customers: CustomersResource;

  /**
   * API Keys resource for managing API keys
   */
  public readonly apiKeys: ApiKeysResource;

  /**
   * The transport layer used for HTTP requests
   */
  private readonly transport: Transport;

  /**
   * The configuration used to create this client
   */
  private readonly config: ClientConfig;

  /**
   * Create a new UnifiedAPIClient
   *
   * @param config - Client configuration
   * @throws {ValidationError} If required configuration is missing
   */
  constructor(config: ClientConfig);
  /**
   * Create a new UnifiedAPIClient with a custom transport (for testing)
   *
   * @param config - Client configuration
   * @param transport - Custom transport implementation
   */
  constructor(config: ClientConfig, transport: Transport);
  constructor(config: ClientConfig, transport?: Transport) {
    // Validate required config
    if (!config.apiKey) {
      throw new ValidationError('API key is required');
    }

    // Merge with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Use provided transport or create HTTP transport
    this.transport = transport || new HttpTransport(this.config);

    // Initialize resources
    this.payments = new PaymentsResource(this.transport);
    this.customers = new CustomersResource(this.transport);
    this.apiKeys = new ApiKeysResource(this.transport);
  }

  /**
   * Get the configured base URL
   */
  get baseUrl(): string {
    return this.config.baseUrl || DEFAULT_CONFIG.baseUrl!;
  }

  /**
   * Get the configured timeout
   */
  get timeout(): number {
    return this.config.timeout || DEFAULT_CONFIG.timeout!;
  }

  /**
   * Create a client with mock transport for testing
   *
   * @param config - Client configuration (apiKey can be any string for testing)
   * @returns Object containing the client and mock transport
   *
   * @example
   * ```typescript
   * const { client, mock } = UnifiedAPIClient.withMockTransport({
   *   apiKey: 'test_key'
   * });
   *
   * // Set up mock responses
   * mock.onCreatePayment(async (body) => ({
   *   id: 'pay_mock_123',
   *   provider_transaction_id: 'pi_mock_123',
   *   amount: (body as any).amount,
   *   currency: (body as any).currency,
   *   status: 'completed',
   *   created_at: new Date().toISOString()
   * }));
   *
   * // Use client normally
   * const payment = await client.payments.create({
   *   amount: 1000,
   *   currency: 'USD',
   *   provider: 'stripe',
   *   customer_id: 'cust_123',
   *   payment_method: 'pm_visa'
   * });
   *
   * // Check logged requests
   * console.log(mock.getRequests());
   * ```
   */
  static withMockTransport(
    config: ClientConfig
  ): { client: UnifiedAPIClient; mock: MockTransport } {
    const mock = new MockTransport();
    const client = new UnifiedAPIClient(config, mock);
    return { client, mock };
  }

  /**
   * Create a client with default configuration for development
   *
   * @param apiKey - API key for authentication
   * @returns UnifiedAPIClient configured for local development
   *
   * @example
   * ```typescript
   * const client = UnifiedAPIClient.forDevelopment('sk_your_api_key');
   * ```
   */
  static forDevelopment(apiKey: string): UnifiedAPIClient {
    return new UnifiedAPIClient({
      apiKey,
      baseUrl: 'http://localhost:8000',
      timeout: 30000,
      maxRetries: 3,
    });
  }

  /**
   * Check server health
   *
   * @param options - Request options
   * @returns Health status
   *
   * @example
   * ```typescript
   * const health = await client.health();
   * console.log(`Server is ${health.status}`);
   * ```
   */
  async health(options?: RequestOptions): Promise<{ status: string; timestamp: string }> {
    return this.transport.request<{ status: string; timestamp: string }>(
      'GET',
      '/health',
      undefined,
      options
    );
  }

  /**
   * Create a client configured for production
   *
   * @param apiKey - API key for authentication
   * @param baseUrl - Production API URL
   * @returns UnifiedAPIClient configured for production
   *
   * @example
   * ```typescript
   * const client = UnifiedAPIClient.forProduction(
   *   'sk_live_xxx',
   *   'https://api.OneRouter.com'
   * );
   * ```
   */
  static forProduction(apiKey: string, baseUrl: string): UnifiedAPIClient {
    return new UnifiedAPIClient({
      apiKey,
      baseUrl,
      timeout: 30000,
      maxRetries: 3,
      enableSigning: true,
    });
  }
}
