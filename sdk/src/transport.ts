/**
 * HTTP Transport layer for OneRouter SDK
 *
 * Handles HTTP requests with:
 * - HMAC request signing
 * - Trace headers
 * - Configurable retry/backoff
 * - Idempotency key support
 * - Timeout handling
 */

import { createHmac, randomUUID } from 'crypto';
import {
  Transport,
  RequestOptions,
  APIErrorResponse,
  ClientConfig,
} from './types.js';
import {
  OneRouterError,
  NetworkError,
  TimeoutError,
  isRetryableError,
} from './errors.js';

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_URL = 'http://localhost:3000';

/**
 * Calculate exponential backoff with jitter
 */
function calculateBackoff(attempt: number, baseMs: number = 1000): number {
  // Exponential backoff: 1s, 2s, 4s, etc.
  const exponentialDelay = baseMs * Math.pow(2, attempt);
  // Add jitter (±25%)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * HTTP Transport implementation
 */
export class HttpTransport implements Transport {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly enableSigning: boolean;
  private readonly signingSecret: string;

  constructor(config: ClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.enableSigning = config.enableSigning ?? false;
    this.signingSecret = config.signingSecret || config.apiKey;
  }

  /**
   * Generate HMAC signature for a request
   */
  private generateSignature(
    method: string,
    path: string,
    timestamp: string,
    body?: string
  ): string {
    const payload = [method.toUpperCase(), path, timestamp, body || ''].join(
      '\n'
    );
    return createHmac('sha256', this.signingSecret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Generate a trace ID for request tracking
   */
  private generateTraceId(): string {
    return randomUUID();
  }

  /**
   * Build request headers
   */
  private buildHeaders(
    method: string,
    path: string,
    body?: string,
    options?: RequestOptions
  ): Record<string, string> {
    const timestamp = new Date().toISOString();
    const traceId = this.generateTraceId();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-Key': this.apiKey,
      'X-Trace-Id': traceId,
      'X-Request-Timestamp': timestamp,
      'X-SDK-Version': '0.1.0',
      'User-Agent': 'OneRouter-SDK/0.1.0 Node.js',
    };

    // Add HMAC signature if enabled
    if (this.enableSigning) {
      const signature = this.generateSignature(method, path, timestamp, body);
      headers['X-Signature'] = signature;
    }

    // Add idempotency key if provided
    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    // Merge custom headers
    if (options?.headers) {
      Object.assign(headers, options.headers);
    }

    return headers;
  }

  /**
   * Execute a single HTTP request
   */
  private async executeRequest<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const headers = this.buildHeaders(method, path, bodyStr, options);
    const timeout = options?.timeout || this.timeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: bodyStr,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response body
      const responseText = await response.text();
      let responseData: unknown;

      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch {
        responseData = { error: responseText };
      }

      // Handle error responses
      if (!response.ok) {
        const errorResponse = responseData as APIErrorResponse;
        throw OneRouterError.fromResponse(
          {
            error: errorResponse.error || `HTTP ${response.status}`,
            code: errorResponse.code || 'UNKNOWN_ERROR',
            details: errorResponse.details,
            trace_id: errorResponse.trace_id || response.headers.get('X-Trace-Id') || undefined,
          },
          response.status
        );
      }

      return responseData as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`Request timed out after ${timeout}ms`);
      }

      // Handle fetch errors (network issues)
      if (
        error instanceof TypeError &&
        (error.message.includes('fetch') || error.message.includes('network'))
      ) {
        throw new NetworkError(error.message);
      }

      // Re-throw OneRouterErrors
      if (error instanceof OneRouterError) {
        throw error;
      }

      // Wrap unknown errors
      throw new NetworkError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  /**
   * Execute request with retry logic
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const maxRetries = options?.skipRetry ? 0 : this.maxRetries;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeRequest<T>(method, path, body, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry
        const shouldRetry =
          attempt < maxRetries &&
          isRetryableError(error) &&
          !options?.skipRetry;

        if (shouldRetry) {
          const backoff = calculateBackoff(attempt);
          await sleep(backoff);
          continue;
        }

        throw error;
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Request failed');
  }
}

/**
 * Mock Transport for testing
 *
 * Allows you to mock API responses without making actual HTTP requests.
 */
export class MockTransport implements Transport {
  private handlers: Map<
    string,
    (body?: unknown, options?: RequestOptions) => Promise<unknown>
  > = new Map();
  private defaultResponse: unknown = {};
  public requestLog: Array<{
    method: string;
    path: string;
    body?: unknown;
    options?: RequestOptions;
  }> = [];

  /**
   * Set a handler for a specific method/path combination
   */
  onRequest<T>(
    method: string,
    path: string,
    handler: (body?: unknown, options?: RequestOptions) => Promise<T>
  ): this {
    this.handlers.set(`${method.toUpperCase()}:${path}`, handler);
    return this;
  }

  /**
   * Set a handler for creating payments
   */
  onCreatePayment<T>(
    handler: (body?: unknown, options?: RequestOptions) => Promise<T>
  ): this {
    return this.onRequest('POST', '/api/v1/payments/create', handler);
  }

  /**
   * Set a handler for refunding payments
   */
  onRefundPayment<T>(
    paymentId: string,
    handler: (body?: unknown, options?: RequestOptions) => Promise<T>
  ): this {
    return this.onRequest('POST', `/api/v1/payments/${paymentId}/refund`, handler);
  }

  /**
   * Set a handler for listing payments
   */
  onListPayments<T>(
    handler: (body?: unknown, options?: RequestOptions) => Promise<T>
  ): this {
    return this.onRequest('GET', '/api/v1/payments', handler);
  }

  /**
   * Set a handler for creating customers
   */
  onCreateCustomer<T>(
    handler: (body?: unknown, options?: RequestOptions) => Promise<T>
  ): this {
    return this.onRequest('POST', '/api/v1/customers', handler);
  }

  /**
   * Set a handler for updating customers
   */
  onUpdateCustomer<T>(
    customerId: string,
    handler: (body?: unknown, options?: RequestOptions) => Promise<T>
  ): this {
    return this.onRequest('PUT', `/api/v1/customers/${customerId}`, handler);
  }

  /**
   * Set a handler for listing customers
   */
  onListCustomers<T>(
    handler: (body?: unknown, options?: RequestOptions) => Promise<T>
  ): this {
    return this.onRequest('GET', '/api/v1/customers', handler);
  }

  /**
   * Set a handler for deleting customers
   */
  onDeleteCustomer<T>(
    customerId: string,
    handler: (body?: unknown, options?: RequestOptions) => Promise<T>
  ): this {
    return this.onRequest('DELETE', `/api/v1/customers/${customerId}`, handler);
  }

  /**
   * Set a handler for creating API keys
   */
  onCreateApiKey<T>(
    handler: (body?: unknown, options?: RequestOptions) => Promise<T>
  ): this {
    return this.onRequest('POST', '/api/v1/api-keys', handler);
  }

  /**
   * Set a handler for updating API keys
   */
  onUpdateApiKey<T>(
    keyId: string,
    handler: (body?: unknown, options?: RequestOptions) => Promise<T>
  ): this {
    return this.onRequest('PUT', `/api/v1/api-keys/${keyId}`, handler);
  }

  /**
   * Set a handler for listing API keys
   */
  onListApiKeys<T>(
    handler: (body?: unknown, options?: RequestOptions) => Promise<T>
  ): this {
    return this.onRequest('GET', '/api/v1/api-keys', handler);
  }

  /**
   * Set a handler for deleting API keys
   */
  onDeleteApiKey<T>(
    keyId: string,
    handler: (body?: unknown, options?: RequestOptions) => Promise<T>
  ): this {
    return this.onRequest('DELETE', `/api/v1/api-keys/${keyId}`, handler);
  }

  /**
   * Set a handler for health checks
   */
  onHealth<T>(
    handler: (body?: unknown, options?: RequestOptions) => Promise<T>
  ): this {
    return this.onRequest('GET', '/health', handler);
  }

  /**
   * Set default response for unhandled requests
   */
  setDefaultResponse(response: unknown): this {
    this.defaultResponse = response;
    return this;
  }

  /**
   * Clear all handlers and request log
   */
  reset(): this {
    this.handlers.clear();
    this.requestLog = [];
    this.defaultResponse = {};
    return this;
  }

  /**
   * Get all logged requests
   */
  getRequests(): Array<{
    method: string;
    path: string;
    body?: unknown;
    options?: RequestOptions;
  }> {
    return [...this.requestLog];
  }

  /**
   * Execute a mock request
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    // Log the request
    this.requestLog.push({ method, path, body, options });

    // Find handler - try exact match first, then pattern match for paths with IDs
    const key = `${method.toUpperCase()}:${path}`;
    let handler = this.handlers.get(key);

    // If no exact match, try to match patterns (for dynamic IDs)
    if (!handler) {
      for (const [pattern, h] of this.handlers.entries()) {
        // Simple pattern matching for /api/v1/payments/:id/refund
        const patternRegex = pattern.replace(/:[^/]+/g, '[^/]+');
        if (new RegExp(`^${patternRegex}$`).test(key)) {
          handler = h;
          break;
        }
      }
    }

    if (handler) {
      return (await handler(body, options)) as T;
    }

    return this.defaultResponse as T;
  }
}
