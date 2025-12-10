/**
 * Tests for health monitoring and validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UnifiedAPIClient, MockTransport, ValidationError } from '../src/index.js';

describe('Health Monitoring', () => {
  describe('health method', () => {
    it('should return health status', async () => {
      const { client, mock } = UnifiedAPIClient.withMockTransport({
        apiKey: 'sk_test_123',
      });

      mock.onHealth(async () => ({ status: 'healthy', timestamp: new Date().toISOString() }));

      const result = await client.health();
      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('healthCheck method', () => {
    let client: UnifiedAPIClient;
    let mock: MockTransport;

    beforeEach(() => {
      const result = UnifiedAPIClient.withMockTransport({
        apiKey: 'sk_test_123',
      });
      client = result.client;
      mock = result.mock;
    });

    it('should return comprehensive health check results', async () => {
      const healthResponse = { status: 'healthy', timestamp: '2024-01-01T00:00:00Z' };

      mock.onHealth(async () => healthResponse);

      const result = await client.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.services.api.status).toBe('ok');
      expect(result.services.auth.status).toBe('ok');
      expect(typeof result.latency).toBe('number');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should mark overall status as unhealthy if any service fails', async () => {
      mock.onHealth(async () => {
        throw new Error('Service unavailable');
      });

      const result = await client.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.services.api.status).toBe('error');
      expect(result.services.api.error).toBe('Service unavailable');
    });

    it('should handle network errors gracefully', async () => {
      mock.onHealth(async () => {
        throw new Error('Connection refused');
      });

      const result = await client.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.services.api.status).toBe('error');
      expect(result.services.api.error).toBe('Connection refused');
    });
  });

  describe('getMetrics', () => {
    it('should return metrics collector for HTTP transport', () => {
      const client = new UnifiedAPIClient({
        apiKey: 'sk_test_123',
      });

      const metrics = client.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.getEnvironment()).toBe('local');
    });

    it('should throw error for mock transport', () => {
      const { client } = UnifiedAPIClient.withMockTransport({
        apiKey: 'sk_test_123',
      });

      expect(() => client.getMetrics()).toThrow('Metrics are only available for HTTP transport');
    });
  });
});