/**
 * Tests for metrics tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../src/metrics.js';
import { RequestMetrics } from '../src/types.js';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector(10, 'local'); // Small limit for testing
  });

  describe('record', () => {
    it('should record metrics', () => {
      const metrics: Omit<RequestMetrics, 'environment'> = {
        method: 'GET',
        path: '/api/v1/payments',
        duration: 150,
        statusCode: 200,
        success: true,
        timestamp: Date.now(),
        traceId: 'trace_123',
      };

      collector.record(metrics);

      const allMetrics = collector.getMetrics();
      expect(allMetrics).toHaveLength(1);
      expect(allMetrics[0]).toMatchObject({
        ...metrics,
        environment: 'local',
      });
    });

    it('should automatically cleanup old metrics when limit exceeded', () => {
      const baseTime = Date.now();

      // Record 15 metrics (limit is 10)
      for (let i = 0; i < 15; i++) {
        collector.record({
          method: 'GET',
          path: `/api/v1/test${i}`,
          duration: 100 + i,
          statusCode: 200,
          success: true,
          timestamp: baseTime + i,
        });
      }

      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(10);
      // Should keep the most recent 10
      expect(metrics[0].path).toBe('/api/v1/test5');
      expect(metrics[9].path).toBe('/api/v1/test14');
    });
  });

  describe('getMetricsFiltered', () => {
    beforeEach(() => {
      const baseTime = Date.now();
      collector.record({
        method: 'GET',
        path: '/api/v1/payments',
        duration: 100,
        statusCode: 200,
        success: true,
        timestamp: baseTime,
      });
      collector.record({
        method: 'POST',
        path: '/api/v1/payments',
        duration: 200,
        statusCode: 201,
        success: true,
        timestamp: baseTime + 1000,
      });
      collector.record({
        method: 'GET',
        path: '/api/v1/payments',
        duration: 150,
        statusCode: 500,
        success: false,
        timestamp: baseTime + 2000,
      });
    });

    it('should filter by method', () => {
      const getMetrics = collector.getMetricsFiltered({ method: 'GET' });
      expect(getMetrics).toHaveLength(2);
      expect(getMetrics.every(m => m.method === 'GET')).toBe(true);
    });

    it('should filter by path', () => {
      const paymentMetrics = collector.getMetricsFiltered({ path: 'payments' });
      expect(paymentMetrics).toHaveLength(3);
      expect(paymentMetrics.every(m => m.path.includes('payments'))).toBe(true);
    });

    it('should filter by success', () => {
      const failedMetrics = collector.getMetricsFiltered({ success: false });
      expect(failedMetrics).toHaveLength(1);
      expect(failedMetrics[0].statusCode).toBe(500);
    });

    it('should filter by timestamp', () => {
      const allMetrics = collector.getMetrics();
      const baseTime = allMetrics[0].timestamp;
      const recentMetrics = collector.getMetricsFiltered({ since: baseTime + 1500 });
      expect(recentMetrics).toHaveLength(1);
      expect(recentMetrics[0].path).toBe('/api/v1/payments');
    });

    it('should combine multiple filters', () => {
      const filtered = collector.getMetricsFiltered({
        method: 'GET',
        success: true,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].path).toBe('/api/v1/payments');
      expect(filtered[0].method).toBe('GET');
    });
  });

  describe('getSummary', () => {
    it('should return empty summary for no metrics', () => {
      const summary = collector.getSummary();
      expect(summary.total).toBe(0);
      expect(summary.successful).toBe(0);
      expect(summary.failed).toBe(0);
      expect(summary.averageLatency).toBe(0);
    });

    it('should calculate summary statistics', () => {
      const baseTime = Date.now();
      collector.record({
        method: 'GET',
        path: '/api/v1/test1',
        duration: 100,
        statusCode: 200,
        success: true,
        timestamp: baseTime,
      });
      collector.record({
        method: 'POST',
        path: '/api/v1/test2',
        duration: 200,
        statusCode: 201,
        success: true,
        timestamp: baseTime + 1000,
      });
      collector.record({
        method: 'GET',
        path: '/api/v1/test3',
        duration: 300,
        statusCode: 500,
        success: false,
        timestamp: baseTime + 2000,
      });

      const summary = collector.getSummary();
      expect(summary.total).toBe(3);
      expect(summary.successful).toBe(2);
      expect(summary.failed).toBe(1);
      expect(summary.averageLatency).toBe(200); // (100 + 200 + 300) / 3
      expect(summary.lastRequestAt).toBe(baseTime + 2000);
    });
  });

  describe('environment management', () => {
    it('should track environment', () => {
      expect(collector.getEnvironment()).toBe('local');
    });

    it('should allow environment updates', () => {
      collector.setEnvironment('production');
      expect(collector.getEnvironment()).toBe('production');

      // New metrics should use the updated environment
      collector.record({
        method: 'GET',
        path: '/api/v1/test',
        duration: 100,
        statusCode: 200,
        success: true,
        timestamp: Date.now(),
      });

      const metrics = collector.getMetrics();
      expect(metrics[0].environment).toBe('production');
    });
  });

  describe('clear', () => {
    it('should clear all metrics', () => {
      collector.record({
        method: 'GET',
        path: '/api/v1/test',
        duration: 100,
        statusCode: 200,
        success: true,
        timestamp: Date.now(),
      });

      expect(collector.getMetrics()).toHaveLength(1);

      collector.clear();
      expect(collector.getMetrics()).toHaveLength(0);
    });
  });
});