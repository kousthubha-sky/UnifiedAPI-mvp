const API_KEY_STORAGE_KEY = 'paymenthub_api_key';
const CUSTOMER_ID_STORAGE_KEY = 'paymenthub_customer_id';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// API Key localStorage helpers
export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setStoredApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function clearStoredApiKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(API_KEY_STORAGE_KEY);
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

export class ApiClient {
  private baseUrl: string;
  private apiKey: string | null;

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.apiKey = null;
  }

  setApiKey(key: string | null): void {
    this.apiKey = key;
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  private getHeaders(useBootstrapKey: boolean = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const keyToUse = useBootstrapKey ? getBootstrapApiKey() : this.apiKey;
    if (keyToUse) {
      headers['x-api-key'] = keyToUse;
    }

    return headers;
  }

  async request<T>(
    path: string,
    options: RequestInit & { method?: string; useBootstrapKey?: boolean } = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const method = options.method || 'GET';
    const useBootstrapKey = options.useBootstrapKey || false;

    try {
      const response = await fetch(url, {
        ...options,
        method,
        headers: this.getHeaders(useBootstrapKey),
      });

      // Handle 401 errors
      if (response.status === 401) {
        // Clear stored auth data on 401
        clearAllAuthData();
        return {
          error: 'Authentication failed. Please log in again.',
        };
      }

      const data = await response.json() as ApiResponse<T>;

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        error: errorMessage,
      };
    }
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T>(path: string, body: unknown, useBootstrapKey: boolean = false): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      useBootstrapKey,
    });
  }

  async patch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'DELETE',
    });
  }

  async createPayment<T>(payload: unknown): Promise<ApiResponse<T>> {
    return this.post<T>('/api/v1/payments', payload);
  }

  async refundPayment<T>(paymentId: string, payload: unknown): Promise<ApiResponse<T>> {
    return this.post<T>(`/api/v1/payments/${paymentId}/refund`, payload);
  }

  async generateApiKey<T>(name?: string, useBootstrapKey: boolean = false): Promise<ApiResponse<T>> {
    return this.post<T>('/api/v1/api-keys', { name }, useBootstrapKey);
  }

  async listApiKeys<T>(): Promise<ApiResponse<T>> {
    return this.get<T>('/api/v1/api-keys');
  }
}

// Singleton instance
export const apiClient = new ApiClient();

// Initialize from localStorage
if (typeof window !== 'undefined') {
  const storedKey = getStoredApiKey();
  if (storedKey) {
    apiClient.setApiKey(storedKey);
  }
}

// Helper function to make authenticated API calls
export async function apiCall<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    useBootstrapKey?: boolean;
  } = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, useBootstrapKey = false } = options;

  // Ensure API key is loaded from localStorage
  if (!apiClient.getApiKey() && !useBootstrapKey) {
    const storedKey = getStoredApiKey();
    if (storedKey) {
      apiClient.setApiKey(storedKey);
    }
  }

  if (method === 'GET') {
    return apiClient.get<T>(path);
  }

  if (method === 'POST') {
    return apiClient.post<T>(path, body, useBootstrapKey);
  }

  if (method === 'PATCH') {
    return apiClient.patch<T>(path, body);
  }

  if (method === 'DELETE') {
    return apiClient.delete<T>(path);
  }

  return { error: 'Invalid method' };
}
