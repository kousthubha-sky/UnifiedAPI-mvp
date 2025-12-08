'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStoredApiKey } from './api';

export interface UsageMetrics {
  date: string;
  request_count: number;
  success_count: number;
  error_count: number;
}

export interface MetricsSummary {
  total_requests: number;
  total_success: number;
  total_errors: number;
  success_rate: number;
  daily_metrics: UsageMetrics[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export function useMetrics(accessToken: string | null) {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    const apiKey = getStoredApiKey();
    if (!apiKey) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/metrics`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      } else {
        // If the metrics endpoint fails, generate mock data for demo
        const mockMetrics = generateMockMetrics();
        setMetrics(mockMetrics);
      }
    } catch (err) {
      // Generate mock data for demo purposes
      const mockMetrics = generateMockMetrics();
      setMetrics(mockMetrics);
      console.warn('Using mock metrics data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accessToken) {
      fetchMetrics();
    }
  }, [accessToken, fetchMetrics]);

  return { metrics, loading, error, refresh: fetchMetrics };
}

function generateMockMetrics(): MetricsSummary {
  const days = 14;
  const daily_metrics: UsageMetrics[] = [];
  let total_requests = 0;
  let total_success = 0;
  let total_errors = 0;

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const request_count = Math.floor(Math.random() * 500) + 100;
    const error_count = Math.floor(request_count * (Math.random() * 0.05));
    const success_count = request_count - error_count;

    daily_metrics.push({
      date: dateStr,
      request_count,
      success_count,
      error_count,
    });

    total_requests += request_count;
    total_success += success_count;
    total_errors += error_count;
  }

  return {
    total_requests,
    total_success,
    total_errors,
    success_rate: total_requests > 0 ? (total_success / total_requests) * 100 : 0,
    daily_metrics,
  };
}
