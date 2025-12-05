export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export class ApiClient {
  private baseUrl: string;
  private apiKey: string | null;

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.apiKey = null;
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    return headers;
  }

  async request<T>(
    path: string,
    options: RequestInit & { method?: string } = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const method = options.method || 'GET';

    try {
      const response = await fetch(url, {
        ...options,
        method,
        headers: this.getHeaders(),
      });

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

  async post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async createPayment<T>(payload: unknown): Promise<ApiResponse<T>> {
    return this.post<T>('/payments', payload);
  }

  async refundPayment<T>(paymentId: string, payload: unknown): Promise<ApiResponse<T>> {
    return this.post<T>(`/payments/${paymentId}/refund`, payload);
  }

  async generateApiKey<T>(): Promise<ApiResponse<T>> {
    return this.post<T>('/api-keys/generate', {});
  }

  async listApiKeys<T>(): Promise<ApiResponse<T>> {
    return this.get<T>('/api-keys');
  }
}

export const apiClient = new ApiClient();
