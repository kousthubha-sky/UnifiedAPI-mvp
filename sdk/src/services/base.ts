// src/services/base.ts
import { Transport } from '../transport.js';

/**
 * Base class for all service implementations
 */
export abstract class BaseService {
  protected transport: Transport;

  constructor(transport: Transport) {
    this.transport = transport;
  }

  /**
   * Make a request to the service router
   */
  protected async request<T>(
    service: string,
    action: string,
    data?: any
  ): Promise<T> {
    return this.transport.request('POST', `/api/v1/services/${service}`, {
      action,
      data
    });
  }
}