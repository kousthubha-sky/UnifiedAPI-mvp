import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../src/server.js';
import { FastifyInstance } from 'fastify';

const hasValidSupabase = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  return url && key && !url.includes('placeholder') && !key.includes('placeholder');
};

describe.skipIf(!hasValidSupabase())('Routes Integration Tests', () => {
  let app: FastifyInstance;
  let testEmail: string;
  let testCustomerId: string;
  let testApiKey: string;
  let testKeyId: string;

  beforeAll(async () => {
    app = await createServer();
    testEmail = `integration-test-${Date.now()}@example.com`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Customer Routes', () => {
    it('should create a new customer via POST /api/v1/customers', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/customers',
        payload: {
          email: testEmail,
          tier: 'starter',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.email).toBe(testEmail);
      expect(body.tier).toBe('starter');

      testCustomerId = body.id;
    });

    it('should not create duplicate customer', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/customers',
        payload: {
          email: testEmail,
          tier: 'starter',
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should get customer profile via GET /api/v1/customers/:id', async () => {
      const testApiKey2 = 'key1';
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/customers/${testCustomerId}`,
        headers: {
          'x-api-key': testApiKey2,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.email).toBe(testEmail);
    });

    it('should update customer profile via PATCH /api/v1/customers/:id', async () => {
      const testApiKey2 = 'key1';
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/customers/${testCustomerId}`,
        headers: {
          'x-api-key': testApiKey2,
        },
        payload: {
          tier: 'growth',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tier).toBe('growth');
    });

    it('should return 404 for non-existent customer', async () => {
      const testApiKey2 = 'key1';
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/customers/non-existent-id',
        headers: {
          'x-api-key': testApiKey2,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('API Key Routes', () => {
    it('should generate API key via POST /api/v1/api-keys', async () => {
      const testApiKey2 = 'key1';
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: {
          'x-api-key': testApiKey2,
        },
        payload: {
          name: 'Integration Test Key',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.key).toBeDefined();
      expect(body.key).toMatch(/^sk_/);
      expect(body.is_active).toBe(true);

      testApiKey = body.key;
      testKeyId = body.id;
    });

    it('should list API keys via GET /api/v1/api-keys', async () => {
      const testApiKey2 = 'key1';
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/api-keys',
        headers: {
          'x-api-key': testApiKey2,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.keys)).toBe(true);
    });

    it('should revoke API key via PATCH /api/v1/api-keys/:id', async () => {
      const testApiKey2 = 'key1';
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/api-keys/${testKeyId}`,
        headers: {
          'x-api-key': testApiKey2,
        },
        payload: {
          action: 'revoke',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should delete API key via DELETE /api/v1/api-keys/:id', async () => {
      const testApiKey2 = 'key1';
      const generateResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: {
          'x-api-key': testApiKey2,
        },
        payload: {
          name: 'Deletable Key',
        },
      });

      const generatedKey = JSON.parse(generateResponse.body);

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/v1/api-keys/${generatedKey.id}`,
        headers: {
          'x-api-key': testApiKey2,
        },
      });

      expect(deleteResponse.statusCode).toBe(200);
      const body = JSON.parse(deleteResponse.body);
      expect(body.success).toBe(true);
    });

    it('should rotate API key via PATCH /api/v1/api-keys/:id with rotate action', async () => {
      const testApiKey2 = 'key1';
      const generateResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: {
          'x-api-key': testApiKey2,
        },
        payload: {
          name: 'Rotatable Key',
        },
      });

      const generatedKey = JSON.parse(generateResponse.body);
      const oldKey = generatedKey.key;

      const rotateResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/api-keys/${generatedKey.id}`,
        headers: {
          'x-api-key': testApiKey2,
        },
        payload: {
          action: 'rotate',
        },
      });

      expect(rotateResponse.statusCode).toBe(200);
      const body = JSON.parse(rotateResponse.body);
      expect(body.key).toBeDefined();
      expect(body.key).not.toBe(oldKey);
    });
  });

  describe('Health Check', () => {
    it('should return OK from health endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
    });
  });
});
