import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as apiKeyRepository from '../../repositories/apiKeyRepository.js';
import * as customerRepository from '../../repositories/customerRepository.js';
import { cacheGet, cacheSet } from '../../utils/cache.js';
import logger from '../../utils/logger.js';

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: string;
    customerId?: string;
    tier?: string;
  }
}

const getAllowedKeys = (): string[] => {
  const envKeys = process.env.ALLOWED_API_KEYS;
  return envKeys ? envKeys.split(',').map((k) => k.trim()) : [];
};

const PUBLIC_PATHS = ['/health', '/docs', '/swagger'];
const PUBLIC_METHODS: Record<string, string[]> = {
  POST: ['/api/v1/customers'],
};

export const validateApiKey = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const pathMatch = PUBLIC_PATHS.some((path) => request.url.startsWith(path));
  if (pathMatch) {
    return;
  }

  const methodRoutes = PUBLIC_METHODS[request.method] || [];
  const publicMethodMatch = methodRoutes.some((path) => request.url.startsWith(path));
  if (publicMethodMatch) {
    return;
  }

  const apiKey = request.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    logger.warn({ type: 'AUTH_FAILED', reason: 'Missing API key' });
    reply.status(401).send({ error: 'Missing API key', code: 'MISSING_API_KEY' });
    return;
  }

  const allowedKeys = getAllowedKeys();

  if (allowedKeys.includes(apiKey)) {
    const requestAsUnknown = request as unknown as Record<string, unknown>;
    requestAsUnknown.apiKey = apiKey;
    requestAsUnknown.customerId = 'admin';
    requestAsUnknown.tier = 'admin';
    return;
  }

  try {
    const cacheKey = `auth:${apiKey}`;
    const cached = await cacheGet(cacheKey);

    let keyData;
    let customer;

    if (cached) {
      const parsed = JSON.parse(cached) as Record<string, unknown>;
      keyData = parsed;
      customer = parsed.customer as Record<string, unknown>;
    } else {
      keyData = await apiKeyRepository.findByKey(apiKey);

      if (!keyData) {
        logger.warn({ type: 'AUTH_FAILED', reason: 'Invalid API key' });
        reply.status(401).send({ error: 'Invalid API key', code: 'INVALID_API_KEY' });
        return;
      }

      if (!keyData.is_active) {
        logger.warn({ type: 'AUTH_FAILED', reason: 'Inactive API key', key: keyData.id });
        reply.status(401).send({ error: 'API key is inactive', code: 'INACTIVE_API_KEY' });
        return;
      }

      customer = await customerRepository.findById(keyData.customer_id);

      if (!customer) {
        logger.warn({ type: 'AUTH_FAILED', reason: 'Customer not found for API key' });
        reply.status(401).send({ error: 'Invalid API key', code: 'INVALID_API_KEY' });
        return;
      }

      await cacheSet(cacheKey, JSON.stringify({ ...keyData, customer }), 3600);
    }

    const requestAsUnknown = request as unknown as Record<string, unknown>;
    requestAsUnknown.apiKey = apiKey;
    requestAsUnknown.customerId = keyData.customer_id as string;
    requestAsUnknown.tier = (customer?.tier as string) || 'starter';
  } catch (error) {
    logger.error({ error, context: 'API key validation failed' });
    reply.status(500).send({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const registerAuthMiddleware = async (app: FastifyInstance) => {
  app.addHook('onRequest', validateApiKey);
};
