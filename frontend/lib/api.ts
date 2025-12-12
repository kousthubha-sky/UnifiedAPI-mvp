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
  private baseUrl: string;
  private apiKey: string;
  private environment: string;

  constructor(config: { apiKey: string; environment: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.environment = config.environment;
    this.baseUrl = config.baseUrl || this.getBaseUrl();
  }

  private getBaseUrl(): string {
    switch (this.environment) {
      case 'production':
        return 'https://api.yourdomain.com'; // Replace with actual production URL
      case 'staging':
        return 'https://api-staging.yourdomain.com'; // Replace with actual staging URL
      default:
        return 'http://localhost:8000'; // Local development
    }
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const data = await this.makeRequest<{ status: string; checks?: any }>('/health');
    const latency = Date.now() - startTime;

    return {
      status: data.status === 'healthy' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      latency,
      services: {
        api: { status: 'ok', latency },
        auth: { status: 'ok', latency },
        payments: { status: 'ok', latency },
        customers: { status: 'ok', latency },
      },
    };
  }

  getMetrics(): MetricsCollector {
    // For now, return mock metrics since backend may not have this endpoint
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
    create: async (payload: any): Promise<CreatePaymentResponse> => {
      const data = await this.makeRequest<{ id: string; status: string; amount: number; currency: string }>('/payments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return data;
    },
    refund: async (paymentId: string, options?: any): Promise<RefundPaymentResponse> => {
      const data = await this.makeRequest<{ id: string; status: string; amount: number }>(`/payments/${paymentId}/refund`, {
        method: 'POST',
        body: JSON.stringify(options || {}),
      });
      return data;
    },
    list: async (options?: any) => {
      const params = new URLSearchParams();
      if (options) {
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined) params.append(key, String(value));
        });
      }
      const data = await this.makeRequest<any[]>(`/payments?${params}`);
      return data;
    },
  };

  apiKeys = {
    create: async (payload: any): Promise<CreateApiKeyResponse> => {
      const data = await this.makeRequest<{ id: string; key: string; name?: string }>('/api-keys', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return data;
    },
    list: async (): Promise<ListApiKeysResponse> => {
      const data = await this.makeRequest<{ keys: any[] }>('/api-keys');
      return data;
    },
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
  provider: 'paypal';
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
  provider?: 'paypal';
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
