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
    isBootstrapAuth?: boolean;
  }
}

const getAllowedKeys = (): string[] => {
  const envKeys = process.env.ALLOWED_API_KEYS;
  return envKeys ? envKeys.split(',').map((k) => k.trim()) : [];
};

// Get bootstrap API key for signup flows
const getBootstrapKey = (): string | null => {
  return process.env.BOOTSTRAP_API_KEY || null;
};

const PUBLIC_PATHS = ['/health', '/docs', '/swagger'];
const PUBLIC_METHODS: Record<string, string[]> = {
  POST: ['/api/v1/customers'],
};

// Routes that accept bootstrap key authentication
// These routes allow customer_id to be passed in the request body
const BOOTSTRAP_ALLOWED_ROUTES: Record<string, string[]> = {
  POST: ['/api/v1/api-keys'],
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

  // Check if this is an admin key
  if (allowedKeys.includes(apiKey)) {
    const requestAsUnknown = request as unknown as Record<string, unknown>;
    requestAsUnknown.apiKey = apiKey;
    requestAsUnknown.customerId = 'admin';
    requestAsUnknown.tier = 'admin';
    return;
  }

  // Check if this is a bootstrap key for specific routes
  const bootstrapKey = getBootstrapKey();
  const bootstrapRoutes = BOOTSTRAP_ALLOWED_ROUTES[request.method] || [];
  const isBootstrapRoute = bootstrapRoutes.some((path) => request.url.startsWith(path));

  if (bootstrapKey && apiKey === bootstrapKey && isBootstrapRoute) {
    // For bootstrap auth, get customer_id from request body
    const body = request.body as Record<string, unknown> | undefined;
    const customerIdFromBody = body?.customer_id as string | undefined;

    if (customerIdFromBody) {
      // Verify the customer exists
      const customer = await customerRepository.findById(customerIdFromBody);
      if (customer) {
        const requestAsUnknown = request as unknown as Record<string, unknown>;
        requestAsUnknown.apiKey = apiKey;
        requestAsUnknown.customerId = customerIdFromBody;
        requestAsUnknown.tier = customer.tier || 'starter';
        requestAsUnknown.isBootstrapAuth = true;
        logger.info({ type: 'BOOTSTRAP_AUTH', customerId: customerIdFromBody }, 'Bootstrap authentication successful');
        return;
      }
    }

    // Bootstrap key without valid customer_id
    logger.warn({ type: 'AUTH_FAILED', reason: 'Bootstrap key requires valid customer_id in body' });
    reply.status(401).send({ error: 'Bootstrap authentication requires customer_id', code: 'BOOTSTRAP_AUTH_INVALID' });
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
    requestAsUnknown.isBootstrapAuth = false;
  } catch (error) {
    logger.error({ error, context: 'API key validation failed' });
    reply.status(500).send({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const registerAuthMiddleware = async (app: FastifyInstance) => {
  app.addHook('onRequest', validateApiKey);
};
