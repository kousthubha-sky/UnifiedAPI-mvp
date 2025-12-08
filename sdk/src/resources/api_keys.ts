/**
 * API Keys Resource
 *
 * Provides methods for managing API keys through the OneRouter API.
 */

import {
  Transport,
  RequestOptions,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
  CreateApiKeyResponse,
  RotateApiKeyResponse,
  ListApiKeysResponse,
  DeleteApiKeyResponse,
  RevokeApiKeyResponse,
} from '../types.js';
import { ValidationError } from '../errors.js';

/**
 * API Keys resource class
 */
export class ApiKeysResource {
  constructor(private readonly transport: Transport) {}

  /**
   * Create a new API key
   *
   * @param request - API key creation parameters
   * @param options - Request options
   * @returns Created API key details (includes the key itself)
   *
   * @example
   * ```typescript
   * const apiKey = await client.apiKeys.create({
   *   name: 'My App Key',
   *   customer_id: 'cust_123'
   * });
   * console.log(apiKey.key); // Save this - only shown once!
   * ```
   */
  async create(
    request: CreateApiKeyRequest,
    options?: RequestOptions
  ): Promise<CreateApiKeyResponse> {
    return this.transport.request<CreateApiKeyResponse>(
      'POST',
      '/api/v1/api-keys',
      request,
      options
    );
  }

  /**
   * Update an API key (revoke or rotate)
   *
   * @param keyId - ID of the API key to update
   * @param request - Update parameters
   * @param options - Request options
   * @returns Updated API key details
   *
   * @example
   * ```typescript
   * // Revoke a key
   * const revoked = await client.apiKeys.update('key_123', {
   *   action: 'revoke'
   * });
   *
   * // Rotate a key
   * const rotated = await client.apiKeys.update('key_123', {
   *   action: 'rotate',
   *   name: 'New Name'
   * });
   * ```
   */
  async update(
    keyId: string,
    request: UpdateApiKeyRequest,
    options?: RequestOptions
  ): Promise<RotateApiKeyResponse | RevokeApiKeyResponse> {
    if (!keyId || typeof keyId !== 'string') {
      throw new ValidationError('API key ID is required');
    }

    this.validateUpdateRequest(request);

    return this.transport.request<RotateApiKeyResponse | RevokeApiKeyResponse>(
      'PUT',
      `/api/v1/api-keys/${encodeURIComponent(keyId)}`,
      request,
      options
    );
  }

  /**
   * List API keys
   *
   * @param options - Request options
   * @returns List of API keys
   *
   * @example
   * ```typescript
   * const keys = await client.apiKeys.list();
   * console.log(`Found ${keys.total} API keys`);
   * ```
   */
  async list(
    options?: RequestOptions
  ): Promise<ListApiKeysResponse> {
    return this.transport.request<ListApiKeysResponse>(
      'GET',
      '/api/v1/api-keys',
      undefined,
      options
    );
  }

  /**
   * Delete an API key
   *
   * @param keyId - ID of the API key to delete
   * @param options - Request options
   * @returns Deletion confirmation
   *
   * @example
   * ```typescript
   * const result = await client.apiKeys.delete('key_123');
   * console.log(result.message); // "API key deleted successfully"
   * ```
   */
  async delete(
    keyId: string,
    options?: RequestOptions
  ): Promise<DeleteApiKeyResponse> {
    if (!keyId || typeof keyId !== 'string') {
      throw new ValidationError('API key ID is required');
    }

    return this.transport.request<DeleteApiKeyResponse>(
      'DELETE',
      `/api/v1/api-keys/${encodeURIComponent(keyId)}`,
      undefined,
      options
    );
  }

  /**
   * Validate update API key request
   */
  private validateUpdateRequest(request: UpdateApiKeyRequest): void {
    const errors: string[] = [];

    if (!request.action) {
      errors.push('Action is required');
    } else if (!['revoke', 'rotate'].includes(request.action)) {
      errors.push('Action must be "revoke" or "rotate"');
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid API key update request', undefined, {
        errors,
      });
    }
  }
}