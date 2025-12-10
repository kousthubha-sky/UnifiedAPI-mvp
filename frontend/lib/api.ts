// import {
//   UnifiedAPIClient,
//   detectEnvironment,
//   HealthCheckResult,
//   MetricsCollector,
//   CreatePaymentResponse,
//   RefundPaymentResponse,
//   CreateApiKeyResponse,
//   ListApiKeysResponse,
// } from '@OneRouter/sdk';

// Temporary mock types for development
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  latency: number;
  services: {
    api: { status: 'ok' | 'error'; latency: number };
    auth: { status: 'ok' | 'error'; latency: number };
    payments: { status: 'ok' | 'error'; latency: number };
    customers: { status: 'ok' | 'error'; latency: number };
  };
  error?: string;
}

interface MetricsCollector {
  getSummary(): {
    total: number;
    successful: number;
    failed: number;
    averageLatency: number;
    lastRequestAt?: number;
  };
}

interface CreatePaymentResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
}

interface RefundPaymentResponse {
  id: string;
  status: string;
  amount: number;
}

interface CreateApiKeyResponse {
  id: string;
  key: string;
  name?: string;
}

interface ListApiKeysResponse {
  keys: Array<{
    id: string;
    name?: string;
    created_at: string;
    last_used_at?: string;
    is_active: boolean;
  }>;
}

class UnifiedAPIClient {
    constructor(_config: any) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[UnifiedAPIClient] Using mock implementation. Replace with real SDK before production.');
    }
  }
  async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      latency: 50,
      services: {
        api: { status: 'ok', latency: 20 },
        auth: { status: 'ok', latency: 20 },
        payments: { status: 'ok', latency: 20 },
        customers: { status: 'ok', latency: 20 },
      },
    };
  }
  getMetrics(): MetricsCollector {
    return {
      getSummary: () => ({
        total: 100,
        successful: 95,
        failed: 5,
        averageLatency: 150,
        lastRequestAt: Date.now(),
      }),
    };
  }
  payments = {
    create: async (payload: any): Promise<CreatePaymentResponse> => ({
      id: 'pay_mock_' + Date.now(),
      status: 'completed',
      amount: payload.amount,
      currency: payload.currency,
    }),
    refund: async (_paymentId: string, options?: any): Promise<RefundPaymentResponse> => ({
      id: 'ref_mock_' + Date.now(),
      status: 'completed',
      amount: options?.amount || 100,
    }),
    list: async (_options?: any) => [],
  };
  apiKeys = {
    create: async (payload: any): Promise<CreateApiKeyResponse> => ({
      id: 'key_mock_' + Date.now(),
      key: 'sk_mock_' + Math.random().toString(36).substring(2),
      name: payload.name,
    }),
    list: async (): Promise<ListApiKeysResponse> => ({
      keys: [],
    }),
  };
}

function detectEnvironment(): 'local' | 'staging' | 'production' {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('.lc')) return 'local';
    if (hostname.includes('.st')) return 'staging';
    if (hostname.includes('.pr')) return 'production';
  }
  return 'local';
}

const API_KEY_STORAGE_KEY = 'OneRouter_api_key';
const CUSTOMER_ID_STORAGE_KEY = 'OneRouter_customer_id';

// API Key localStorage helpers
export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setStoredApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
  resetSDKClient(); // Reset SDK client when API key changes
}

export function clearStoredApiKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  resetSDKClient();
}

// Customer ID localStorage helpers
export function getStoredCustomerId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CUSTOMER_ID_STORAGE_KEY);
}

export function setStoredCustomerId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CUSTOMER_ID_STORAGE_KEY, id);
}

export function clearStoredCustomerId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CUSTOMER_ID_STORAGE_KEY);
}

// Clear all auth data
export function clearAllAuthData(): void {
  clearStoredApiKey();
  clearStoredCustomerId();
}

// Get bootstrap API key for signup
export function getBootstrapApiKey(): string | null {
  return process.env.NEXT_PUBLIC_BOOTSTRAP_API_KEY || null;
}

// SDK-based API client
let sdkClient: UnifiedAPIClient | null = null;

export function getSDKClient(): UnifiedAPIClient {
  if (!sdkClient) {
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      throw new Error('No API key available');
    }

    // Auto-detect environment from hostname
    const environment = detectEnvironment();

    sdkClient = new UnifiedAPIClient({
      apiKey,
      environment,
      // Add request interceptor for error handling
      requestInterceptors: [
        (request: any) => {
          console.log(`SDK Request: ${request.method} ${request.path}`);
          return request;
        }
      ],
      // Add response interceptor for error handling
      responseInterceptors: [
        (response: any) => {
          if (response.status === 401) {
            // Clear stored auth data on 401
            clearAllAuthData();
            throw new Error('Authentication failed. Please log in again.');
          }
          return response.data;
        }
      ],
      // Add error interceptor for logging
      errorInterceptors: [
        (error: any) => {
          console.error('SDK Error:', error.message);
          return error;
        }
      ],
    });
  }
  return sdkClient;
}

export function resetSDKClient(): void {
  sdkClient = null;
}



// SDK-based API functions
export async function getHealthCheck(): Promise<HealthCheckResult> {
  const client = getSDKClient();
  return client.healthCheck();
}

export async function getMetrics(): Promise<MetricsCollector> {
  const client = getSDKClient();
  return client.getMetrics();
}

export async function createPaymentSDK(payload: {
  amount: number;
  currency: string;
  provider: 'stripe' | 'paypal';
  customer_id: string;
  payment_method: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  const client = getSDKClient();
  return client.payments.create(payload);
}

export async function refundPaymentSDK(paymentId: string, options?: {
  amount?: number;
  reason?: string;
}) {
  const client = getSDKClient();
  return client.payments.refund(paymentId, options);
}

export async function listPaymentsSDK(options?: {
  provider?: 'stripe' | 'paypal';
  status?: 'pending' | 'completed' | 'failed' | 'refunded' | 'processing';
  customer_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}) {
  const client = getSDKClient();
  return client.payments.list(options);
}

// Legacy compatibility - redirect to SDK
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export class ApiClient {
  private apiKey: string | null;

  constructor() {
    this.apiKey = null;
  }

  setApiKey(key: string | null): void {
    this.apiKey = key;
    if (key) {
      setStoredApiKey(key);
    } else {
      clearStoredApiKey();
    }
  }

  getApiKey(): string | null {
    return this.apiKey || getStoredApiKey();
  }

  async createPayment(payload: unknown): Promise<ApiResponse<CreatePaymentResponse>> {
    try {
      const result = await createPaymentSDK(payload as any);
      return { data: result };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async refundPayment(paymentId: string, payload: unknown): Promise<ApiResponse<RefundPaymentResponse>> {
    try {
      const result = await refundPaymentSDK(paymentId, payload as any);
      return { data: result };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async generateApiKey(name?: string): Promise<ApiResponse<CreateApiKeyResponse>> {
    try {
      const client = getSDKClient();
      const result = await client.apiKeys.create({ name });
      return { data: result };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async listApiKeys(): Promise<ApiResponse<ListApiKeysResponse>> {
    try {
      const client = getSDKClient();
      const result = await client.apiKeys.list();
      return { data: result };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Singleton instance for backward compatibility
export const apiClient = new ApiClient();

// Helper function to make authenticated API calls (legacy)
export async function apiCall<T>(): Promise<ApiResponse<T>> {
  // For now, return an error - this should be migrated to use the SDK
  return { error: 'Legacy apiCall not implemented. Use SDK functions instead.' };
}
