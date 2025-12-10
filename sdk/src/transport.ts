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
import { gzipSync } from 'zlib';
import {
  Transport,
  RequestOptions,
  APIErrorResponse,
  ClientConfig,
  RequestInterceptor,
  ResponseInterceptor,
  ErrorInterceptor,
} from './types.js';
import {
  OneRouterError,
  NetworkError,
  TimeoutError,
  isRetryableError,
} from './errors.js';
import { MetricsCollector } from './metrics.js';

/**
 * Response cache with LRU eviction and periodic cleanup
 * 
 * Implements two eviction strategies:
 * 1. Time-based (TTL): Entries expire after a configurable TTL
 * 2. Size-based (LRU): Entries are evicted in LRU order when max size is exceeded
 * 
 * Additionally, a periodic cleanup timer removes expired entries proactively.
 */
class ResponseCache {
  private cache = new Map<string, { data: unknown; expiry: number }>();
  private accessOrder = new Map<string, number>(); // Track access timestamps for LRU
  private readonly ttl: number;
  private readonly maxSize: number;
  private readonly cleanupIntervalMs: number;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private accessCounter = 0;

  constructor(options: {
    ttlMs?: number;
    maxSize?: number;
    cleanupIntervalMs?: number;
  } = {}) {
    this.ttl = options.ttlMs ?? 300000; // 5 minutes default
    this.maxSize = options.maxSize ?? 1000; // Max 1000 entries by default
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60000; // Cleanup every 1 minute
    this.startCleanupTimer();
  }

  /**
   * Start the periodic cleanup timer that removes expired entries
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.removeExpiredEntries();
    }, this.cleanupIntervalMs);
    
    // Ensure timer doesn't prevent process exit (unref for Node.js timers)
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Remove all expired entries from the cache
   */
  private removeExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }
  }

  /**
   * Evict least-recently-used entries until size is below max
   */
  private evictLRU(): void {
    if (this.cache.size <= this.maxSize) {
      return;
    }

    // Find the least-recently-used entries by access order
    const sorted = Array.from(this.accessOrder.entries())
      .sort(([, timeA], [, timeB]) => timeA - timeB);

    // Evict until we're at maxSize
    const toEvict = this.cache.size - this.maxSize;
    for (let i = 0; i < toEvict && i < sorted.length; i++) {
      const [key] = sorted[i];
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }
  }

  get(key: string): unknown | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return null;
    }

    // Update access order for LRU tracking
    this.accessOrder.set(key, ++this.accessCounter);
    return entry.data;
  }

  set(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttl,
    });
    
    // Update access order
    this.accessOrder.set(key, ++this.accessCounter);
    
    // Check if we need to evict LRU entries
    this.evictLRU();
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
  }

  /**
   * Dispose of the cache and stop the cleanup timer
   * Call this when the transport is no longer needed to prevent memory leaks
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

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
 * Generate a normalized cache key from request parameters
 * Includes method, path, normalized query parameters, and cache-affecting headers
 */
function generateCacheKey(
  method: string,
  path: string,
  options?: RequestOptions
): string {
  const upperMethod = method.toUpperCase();
  
  // Parse URL to extract and normalize query parameters
  let normalizedPath = path;
  let queryString = '';
  
  const hashIndex = path.indexOf('#');
  const queryIndex = path.indexOf('?');
  
  if (queryIndex !== -1) {
    const endIndex = hashIndex !== -1 ? hashIndex : path.length;
    normalizedPath = path.substring(0, queryIndex);
    const rawQuery = path.substring(queryIndex + 1, endIndex);
    
    // Parse and sort query parameters for consistency
    const params = new URLSearchParams(rawQuery);
    const sortedParams = new URLSearchParams(
      [...params.entries()].sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    );
    queryString = sortedParams.toString();
  }
  
  // Build cache key: method:path?sortedParams
  let cacheKey = `${upperMethod}:${normalizedPath}`;
  if (queryString) {
    cacheKey += `?${queryString}`;
  }
  
  // Optionally include cache-affecting headers (e.g., Accept-Language)
  if (options?.headers) {
    const acceptLanguage = options.headers['Accept-Language'] || 
                          options.headers['accept-language'];
    if (acceptLanguage) {
      cacheKey += `:lang=${acceptLanguage}`;
    }
  }
  
  return cacheKey;
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
  private readonly metrics: MetricsCollector;
  private readonly requestInterceptors: RequestInterceptor[];
  private readonly responseInterceptors: ResponseInterceptor<unknown>[];
  private readonly errorInterceptors: ErrorInterceptor[];
  private readonly cache: ResponseCache;

  constructor(config: ClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.enableSigning = config.enableSigning ?? false;
    this.signingSecret = config.signingSecret || config.apiKey;
    this.metrics = new MetricsCollector(150, config.environment || 'local');
    this.requestInterceptors = config.requestInterceptors || [];
    this.responseInterceptors = config.responseInterceptors || [];
    this.errorInterceptors = config.errorInterceptors || [];
    this.cache = new ResponseCache({
      ttlMs: config.cacheTtlMs,
      maxSize: config.cacheMaxSize,
      cleanupIntervalMs: config.cacheCleanupIntervalMs,
    });
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
    options?: RequestOptions,
    isCompressed: boolean = false
  ): Record<string, string> {
    const timestamp = new Date().toISOString();
    const traceId = this.generateTraceId();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'X-API-Key': this.apiKey,
      'X-Trace-Id': traceId,
      'X-Request-Timestamp': timestamp,
      'X-SDK-Version': '0.1.0',
      'User-Agent': 'OneRouter-SDK/0.1.0 Node.js',
    };

    // Set Content-Encoding header if body was compressed
    if (isCompressed) {
      headers['Content-Encoding'] = 'gzip';
    }

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
  ): Promise<{ data: T; status: number; headers: Record<string, string> }> {
    const url = `${this.baseUrl}${path}`;
    const bodyStr = body ? JSON.stringify(body) : undefined;
    
    // Compress body if it exceeds the threshold (1024 bytes)
    let requestBody: string | Buffer | undefined = bodyStr;
    let isCompressed = false;
    if (bodyStr && bodyStr.length > 1024) {
      try {
        requestBody = gzipSync(bodyStr);
        isCompressed = true;
      } catch {
        // If compression fails, use uncompressed body
        requestBody = bodyStr;
        isCompressed = false;
      }
    }
    
    const headers = this.buildHeaders(method, path, bodyStr, options, isCompressed);
    const timeout = options?.timeout || this.timeout;
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      // Parse response body
      const responseText = await response.text();
      let responseData: unknown;

      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch {
        responseData = { error: responseText };
      }

      // Record metrics
      const traceId = response.headers.get('X-Trace-Id') || headers['X-Trace-Id'];
      this.metrics.record({
        method,
        path,
        duration,
        statusCode: response.status,
        success: response.ok,
        timestamp: startTime,
        traceId,
      });

      // Handle error responses
      if (!response.ok) {
        const errorResponse = responseData as APIErrorResponse;
        throw OneRouterError.fromResponse(
          {
            detail: errorResponse.detail || errorResponse.error || `HTTP ${response.status}`,
            errors: errorResponse.errors || errorResponse.details,
          },
          response.status
        );
      }

      // Extract headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        data: responseData as T,
        status: response.status,
        headers: responseHeaders,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      // Record failed request metrics
      const traceId = headers['X-Trace-Id'];
      this.metrics.record({
        method,
        path,
        duration,
        statusCode: 0, // No status code for failed requests
        success: false,
        timestamp: startTime,
        traceId,
      });

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
   * Execute request with retry logic and interceptors
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    // Apply request interceptors
    let interceptedRequest = { method, path, body, options };
    for (const interceptor of this.requestInterceptors) {
      const result = await interceptor(interceptedRequest);
      interceptedRequest = {
        method: result.method,
        path: result.path,
        body: result.body,
        options: result.options,
      };
    }

    // Check cache for GET requests
    const cacheKey = generateCacheKey(interceptedRequest.method, interceptedRequest.path, interceptedRequest.options);
    if (interceptedRequest.method.toUpperCase() === 'GET' && !interceptedRequest.options?.skipCache) {
      const cached = this.cache.get(cacheKey);
      if (cached !== null) {
        return cached as T;
      }
    }

    const maxRetries = interceptedRequest.options?.skipRetry ? 0 : this.maxRetries;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.executeRequest<T>(
          interceptedRequest.method,
          interceptedRequest.path,
          interceptedRequest.body,
          interceptedRequest.options
        );

        // Apply response interceptors
        let interceptedResponse: unknown = response.data;
        for (const interceptor of this.responseInterceptors) {
          interceptedResponse = await (interceptor as ResponseInterceptor<unknown>)({
            data: interceptedResponse,
            status: response.status,
            headers: response.headers,
          });
        }

        // Cache successful GET responses
        if (interceptedRequest.method.toUpperCase() === 'GET' && response.status === 200) {
          this.cache.set(cacheKey, interceptedResponse);
        }

        return interceptedResponse as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Apply error interceptors with protection against interceptor failures
        let interceptedError = lastError;
        for (const interceptor of this.errorInterceptors) {
          try {
            interceptedError = await interceptor(interceptedError);
          } catch (interceptorError) {
            // Log interceptor failure but continue with previous error state
            // This ensures interceptor exceptions don't mask the original error
            console.warn(
              '[OneRouter] Error interceptor failed:',
              interceptorError instanceof Error ? interceptorError.message : String(interceptorError),
              'Proceeding with original error'
            );
            // Don't update interceptedError - continue with the previous state
          }
        }

        // Check if we should retry
        const shouldRetry =
          attempt < maxRetries &&
          isRetryableError(interceptedError) &&
          !interceptedRequest.options?.skipRetry;

        if (shouldRetry) {
          const backoff = calculateBackoff(attempt);
          await sleep(backoff);
          continue;
        }

        throw interceptedError;
      }
    }

    // This should never be reached
    throw new Error('Request failed');
  }

  /**
   * Get metrics collector
   */
  getMetricsCollector(): MetricsCollector {
    return this.metrics;
  }

  /**
   * Get response cache
   */
  getCache(): ResponseCache {
    return this.cache;
  }

  /**
   * Dispose of the transport and clean up resources
   * 
   * This should be called when the transport is no longer needed to prevent
   * memory leaks (especially from the cache cleanup timer).
   */
  dispose(): void {
    this.cache.dispose();
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
      const result = await handler(body, options);
      // For mock transport, return the result directly (not wrapped)
      return result as T;
    }

    return this.defaultResponse as T;
  }
}
