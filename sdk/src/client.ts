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
  HealthCheckResult,
} from './types.js';
import { HttpTransport, MockTransport } from './transport.js';
import { PaymentsResource } from './resources/payments.js';

import { ValidationError } from './errors.js';
import { mergeConfig, validateApiKey } from './config.js';

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
   * @throws {ValidationError} If required configuration is missing or invalid
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
      // Validate API key
      try {
        validateApiKey(config.apiKey);
      } catch (error) {
        throw new ValidationError(error instanceof Error ? error.message : 'Invalid API key');
      }

      // Merge configuration with environment-aware defaults
      this.config = mergeConfig(config);

      // Use provided transport or create HTTP transport
      this.transport = transport || new HttpTransport(this.config);

      // Initialize resources
      this.payments = new PaymentsResource(this.transport);
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
   *   id: 'pi_test_123',
   *   amount: (body as any).amount,
   *   currency: (body as any).currency,
   *   status: 'succeeded',
   *   provider: 'paypal',
   *   connection_type: 'connect',
   *   client_secret: 'pi_test_secret_...',
   *   created_at: Math.floor(Date.now() / 1000)
   * }));
   *
   * // Use client normally
   * const payment = await client.payments.create({
   *   amount: 10000,
   *   currency: 'usd',
   *   description: 'Test payment'
   * });
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
   * Create a client configured for development
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
      environment: 'local',
    });
  }

  /**
   * Create a client configured for production
   *
   * @param apiKey - API key for authentication
   * @param baseUrl - Production API URL (optional, uses environment default)
   * @returns UnifiedAPIClient configured for production
   *
   * @example
   * ```typescript
   * const client = UnifiedAPIClient.forProduction('sk_live_xxx');
   * ```
   */
  static forProduction(apiKey: string, baseUrl?: string): UnifiedAPIClient {
    return new UnifiedAPIClient({
      apiKey,
      baseUrl,
      environment: 'production',
    });
  }

  /**
   * Get request metrics
   *
   * @returns Metrics collector instance
   *
   * @example
   * ```typescript
   * const metrics = client.getMetrics();
   * const summary = metrics.getSummary();
   * console.log(`Total requests: ${summary.total}, Success rate: ${summary.successful / summary.total * 100}%`);
   * ```
   */
  getMetrics() {
    if (this.transport instanceof HttpTransport) {
      return this.transport.getMetricsCollector();
    }
    throw new Error('Metrics are only available for HTTP transport');
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
   * Perform comprehensive health check with detailed service validation
   *
   * @param options - Request options
   * @returns Detailed health check results
   *
   * @example
   * ```typescript
   * const healthCheck = await client.healthCheck();
   * console.log(`Overall status: ${healthCheck.status}`);
   * console.log(`API latency: ${healthCheck.services.api.latency}ms`);
   * ```
   */
  async healthCheck(options?: RequestOptions): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const results: HealthCheckResult = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      latency: 0,
      services: {
        api: { status: 'ok', latency: 0 },
        auth: { status: 'ok', latency: 0 },
      },
    };

    try {
      // Check basic API connectivity
      const apiStart = Date.now();
      await this.transport.request(
        'GET',
        '/health',
        undefined,
        { ...options, skipRetry: true, timeout: 5000 }
      );
      results.services.api.latency = Date.now() - apiStart;

      // Check authentication by making an authenticated request
      try {
        const authStart = Date.now();
        await this.transport.request(
          'GET',
          '/api/v1/customers',
          undefined,
          { ...options, skipRetry: true, timeout: 5000, headers: { 'X-Test-Auth': 'true' } }
        );
        results.services.auth.latency = Date.now() - authStart;
      } catch (error) {
        results.services.auth = {
          status: 'error',
          latency: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        results.status = 'unhealthy';
      }

      // Optional: Check payments service
      try {
        const paymentsStart = Date.now();
        await this.transport.request(
          'GET',
          '/api/v1/payments',
          undefined,
          { ...options, skipRetry: true, timeout: 5000, headers: { 'X-Test-Service': 'true' } }
        );
        results.services.payments = {
          status: 'ok',
          latency: Date.now() - paymentsStart,
        };
      } catch (error) {
        results.services.payments = {
          status: 'error',
          latency: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        results.status = 'unhealthy';
      }



    } catch (error) {
      results.status = 'unhealthy';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Mark all services as failed
      results.services.api = { status: 'error', latency: 0, error: errorMessage };
      results.services.auth = { status: 'error', latency: 0, error: errorMessage };
    }

    results.latency = Date.now() - startTime;
    return results;
  }




}
