/**
 * Basic metrics tracking for OneRouter SDK
 *
 * Tracks request metrics with automatic cleanup and memory efficiency.
 */

import { RequestMetrics, Environment } from './types.js';

/**
 * Metrics collector with automatic cleanup
 */
export class MetricsCollector {
  private metrics: RequestMetrics[] = [];
  private readonly maxMetrics: number;
  private environment: Environment;

  constructor(maxMetrics: number = 150, environment: Environment = 'local') {
    this.maxMetrics = maxMetrics;
    this.environment = environment;
  }

  /**
   * Record a request metric
   */
  record(metrics: Omit<RequestMetrics, 'environment'>): void {
    const fullMetrics: RequestMetrics = {
      ...metrics,
      environment: this.environment,
    };

    this.metrics.push(fullMetrics);

    // Automatic cleanup when exceeding max metrics
    if (this.metrics.length > this.maxMetrics) {
      // Keep only the most recent metrics
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Get all metrics
   * Returns a deep copy to prevent callers from mutating internal metric objects
   */
  getMetrics(): RequestMetrics[] {
    return structuredClone(this.metrics);
  }

  /**
   * Get metrics filtered by criteria
   * Returns deep copies to prevent callers from mutating internal metric objects
   */
  getMetricsFiltered(filter: {
    method?: string;
    path?: string;
    success?: boolean;
    since?: number;
  }): RequestMetrics[] {
    const filtered = this.metrics.filter(metric => {
      if (filter.method && metric.method !== filter.method) return false;
      if (filter.path && !metric.path.includes(filter.path)) return false;
      if (filter.success !== undefined && metric.success !== filter.success) return false;
      if (filter.since && metric.timestamp < filter.since) return false;
      return true;
    });
    return structuredClone(filtered);
  }

  /**
   * Get metrics summary
   */
  getSummary(): {
    total: number;
    successful: number;
    failed: number;
    averageLatency: number;
    lastRequestAt?: number;
  } {
    if (this.metrics.length === 0) {
      return { total: 0, successful: 0, failed: 0, averageLatency: 0 };
    }

    const successful = this.metrics.filter(m => m.success).length;
    const failed = this.metrics.length - successful;
    const averageLatency = this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length;
    const lastRequestAt = Math.max(...this.metrics.map(m => m.timestamp));

    return {
      total: this.metrics.length,
      successful,
      failed,
      averageLatency: Math.round(averageLatency),
      lastRequestAt,
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Get environment
   */
  getEnvironment(): Environment {
    return this.environment;
  }

  /**
   * Update environment (useful if environment changes)
   */
  setEnvironment(environment: Environment): void {
    this.environment = environment;
  }
}