import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as customerRepository from '../src/repositories/customerRepository.js';
import * as apiKeyRepository from '../src/repositories/apiKeyRepository.js';
import * as auditRepository from '../src/repositories/auditRepository.js';

const hasValidSupabase = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  return url && key && !url.includes('placeholder') && !key.includes('placeholder');
};

describe.skipIf(!hasValidSupabase())('Repository Layer Tests', () => {
  describe('Customer Repository', () => {
    it('should create a new customer', async () => {
      const customer = await customerRepository.create({
        email: `test-${Date.now()}@example.com`,
        tier: 'starter',
      });

      expect(customer).toBeDefined();
      expect(customer?.email).toBeDefined();
      expect(customer?.tier).toBe('starter');
    });

    it('should find customer by email', async () => {
      const email = `test-${Date.now()}@example.com`;
      const created = await customerRepository.create({
        email,
        tier: 'growth',
      });

      expect(created).toBeDefined();

      const found = await customerRepository.findByEmail(email);

      expect(found).toBeDefined();
      expect(found?.email).toBe(email);
    });

    it('should find customer by ID', async () => {
      const created = await customerRepository.create({
        email: `test-${Date.now()}@example.com`,
        tier: 'scale',
      });

      expect(created).toBeDefined();

      const found = await customerRepository.findById(created!.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created?.id);
    });

    it('should update customer', async () => {
      const created = await customerRepository.create({
        email: `test-${Date.now()}@example.com`,
        tier: 'starter',
      });

      expect(created).toBeDefined();

      const updated = await customerRepository.update(created!.id, {
        tier: 'growth',
      });

      expect(updated).toBeDefined();
      expect(updated?.tier).toBe('growth');
    });

    it('should return null for non-existent customer', async () => {
      const found = await customerRepository.findById('non-existent-id');

      expect(found).toBeNull();
    });
  });

  describe('API Key Repository', () => {
    let customerId: string;

    beforeAll(async () => {
      const customer = await customerRepository.create({
        email: `test-${Date.now()}@example.com`,
        tier: 'starter',
      });
      customerId = customer!.id;
    });

    it('should generate a new API key', async () => {
      const result = await apiKeyRepository.generate({
        customer_id: customerId,
        name: 'Test Key',
      });

      expect(result).toBeDefined();
      expect(result?.key).toBeDefined();
      expect(result?.key).toMatch(/^sk_/);
      expect(result?.apiKey.is_active).toBe(true);
    });

    it('should list API keys for a customer', async () => {
      const keys = await apiKeyRepository.list(customerId);

      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThanOrEqual(1);
    });

    it('should find API key by key', async () => {
      const generated = await apiKeyRepository.generate({
        customer_id: customerId,
        name: 'Findable Key',
      });

      expect(generated).toBeDefined();

      const found = await apiKeyRepository.findByKey(generated!.key);

      expect(found).toBeDefined();
      expect(found?.id).toBe(generated?.apiKey.id);
    });

    it('should revoke an API key', async () => {
      const generated = await apiKeyRepository.generate({
        customer_id: customerId,
        name: 'Revocable Key',
      });

      expect(generated).toBeDefined();

      const success = await apiKeyRepository.revoke(generated!.apiKey.id);

      expect(success).toBe(true);

      const found = await apiKeyRepository.findByKey(generated!.key);

      expect(found?.is_active).toBe(false);
    });

    it('should rotate an API key', async () => {
      const generated = await apiKeyRepository.generate({
        customer_id: customerId,
        name: 'Rotatable Key',
      });

      expect(generated).toBeDefined();
      const oldKey = generated!.key;

      const rotated = await apiKeyRepository.rotate(generated!.apiKey.id);

      expect(rotated).toBeDefined();
      expect(rotated?.key).toBeDefined();
      expect(rotated?.key).not.toBe(oldKey);
    });

    it('should delete an API key', async () => {
      const generated = await apiKeyRepository.generate({
        customer_id: customerId,
        name: 'Deletable Key',
      });

      expect(generated).toBeDefined();

      const success = await apiKeyRepository.delete_(generated!.apiKey.id);

      expect(success).toBe(true);
    });
  });

  describe('Audit Repository', () => {
    let customerId: string;

    beforeAll(async () => {
      const customer = await customerRepository.create({
        email: `test-${Date.now()}@example.com`,
        tier: 'starter',
      });
      customerId = customer!.id;
    });

    it('should log an audit entry', async () => {
      const traceId = `trace-${Date.now()}`;
      const success = await auditRepository.log({
        trace_id: traceId,
        customer_id: customerId,
        endpoint: '/api/v1/test',
        method: 'POST',
        status: 200,
        latency_ms: 100,
      });

      expect(success).toBe(true);
    });

    it('should list audit logs by customer', async () => {
      await auditRepository.log({
        trace_id: `trace-${Date.now()}`,
        customer_id: customerId,
        endpoint: '/api/v1/test',
        method: 'GET',
        status: 200,
        latency_ms: 50,
      });

      const logs = await auditRepository.listByCustomer(customerId, 10, 0);

      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    it('should list audit logs by trace ID', async () => {
      const traceId = `trace-${Date.now()}`;
      await auditRepository.log({
        trace_id: traceId,
        customer_id: customerId,
        endpoint: '/api/v1/test',
        method: 'DELETE',
        status: 204,
        latency_ms: 75,
      });

      const logs = await auditRepository.listByTraceId(traceId);

      expect(Array.isArray(logs)).toBe(true);
    });
  });
});
