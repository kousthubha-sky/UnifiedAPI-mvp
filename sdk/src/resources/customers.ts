/**
 * Customers Resource
 *
 * Provides methods for managing customers through the OneRouter API.
 */

import {
  Transport,
  RequestOptions,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerResponse,
  ListCustomersRequest,
  ListCustomersResponse,
} from '../types.js';
import { ValidationError } from '../errors.js';

/**
 * Customers resource class
 */
export class CustomersResource {
  constructor(private readonly transport: Transport) {}

  /**
   * Create a new customer
   *
   * @param request - Customer creation parameters
   * @param options - Request options
   * @returns Created customer details
   *
   * @example
   * ```typescript
   * const customer = await client.customers.create({
   *   email: 'user@example.com',
   *   tier: 'starter',
   *   stripe_account_id: 'acct_123'
   * });
   * ```
   */
  async create(
    request: CreateCustomerRequest,
    options?: RequestOptions
  ): Promise<CustomerResponse> {
    // Validate required fields
    this.validateCreateRequest(request);

    return this.transport.request<CustomerResponse>(
      'POST',
      '/api/v1/customers',
      request,
      options
    );
  }

  /**
   * Update an existing customer
   *
   * @param customerId - ID of the customer to update
   * @param request - Customer update parameters
   * @param options - Request options
   * @returns Updated customer details
   *
   * @example
   * ```typescript
   * const customer = await client.customers.update('cust_123', {
   *   email: 'newemail@example.com',
   *   tier: 'growth'
   * });
   * ```
   */
  async update(
    customerId: string,
    request: UpdateCustomerRequest,
    options?: RequestOptions
  ): Promise<CustomerResponse> {
    if (!customerId || typeof customerId !== 'string') {
      throw new ValidationError('Customer ID is required');
    }

    return this.transport.request<CustomerResponse>(
      'PUT',
      `/api/v1/customers/${encodeURIComponent(customerId)}`,
      request,
      options
    );
  }

  /**
   * List customers with optional filters
   *
   * @param request - Filter and pagination parameters
   * @param options - Request options
   * @returns Paginated list of customers
   *
   * @example
   * ```typescript
   * // List all customers
   * const customers = await client.customers.list();
   *
   * // List with pagination
   * const paginated = await client.customers.list({
   *   limit: 20,
   *   offset: 0
   * });
   * ```
   */
  async list(
    request?: ListCustomersRequest,
    options?: RequestOptions
  ): Promise<ListCustomersResponse> {
    // Build query string from request parameters
    const queryParams = this.buildQueryString(request);
    const path = queryParams ? `/api/v1/customers?${queryParams}` : '/api/v1/customers';

    return this.transport.request<ListCustomersResponse>(
      'GET',
      path,
      undefined,
      options
    );
  }

  /**
   * Delete a customer
   *
   * @param customerId - ID of the customer to delete
   * @param options - Request options
   * @returns Empty response (204)
   *
   * @example
   * ```typescript
   * await client.customers.delete('cust_123');
   * ```
   */
  async delete(
    customerId: string,
    options?: RequestOptions
  ): Promise<void> {
    if (!customerId || typeof customerId !== 'string') {
      throw new ValidationError('Customer ID is required');
    }

    return this.transport.request<void>(
      'DELETE',
      `/api/v1/customers/${encodeURIComponent(customerId)}`,
      undefined,
      options
    );
  }

  /**
   * Validate create customer request
   */
  private validateCreateRequest(request: CreateCustomerRequest): void {
    const errors: string[] = [];

    if (!request.email || typeof request.email !== 'string') {
      errors.push('Email is required');
    } else if (!request.email.includes('@')) {
      errors.push('Email must be valid');
    }

    if (request.tier && !['starter', 'growth', 'scale', 'admin'].includes(request.tier)) {
      errors.push('Tier must be one of: starter, growth, scale, admin');
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid customer request', undefined, {
        errors,
      });
    }
  }

  /**
   * Build query string from request parameters
   */
  private buildQueryString(request?: ListCustomersRequest): string {
    if (!request) return '';

    const params = new URLSearchParams();

    if (request.limit !== undefined) {
      params.set('limit', String(request.limit));
    }
    if (request.offset !== undefined) {
      params.set('offset', String(request.offset));
    }

    return params.toString();
  }
}