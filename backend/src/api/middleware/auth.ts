import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import supabase from '../../utils/supabase.js';
import logger from '../../utils/logger.js';

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: string;
  }
}

const getAllowedKeys = (): string[] => {
  const envKeys = process.env.ALLOWED_API_KEYS;
  return envKeys ? envKeys.split(',').map((k) => k.trim()) : [];
};

export const validateApiKey = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
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
    return;
  }

  try {
    const { data, error } = await supabase.from('api_keys').select('*').eq('key', apiKey).single();

    const keyData = data as Record<string, unknown> | null;

    if (error || !keyData) {
      logger.warn({ type: 'AUTH_FAILED', reason: 'Invalid API key' });
      reply.status(401).send({ error: 'Invalid API key', code: 'INVALID_API_KEY' });
      return;
    }

    if (!keyData.active) {
      logger.warn({ type: 'AUTH_FAILED', reason: 'Inactive API key', key: keyData.id });
      reply.status(401).send({ error: 'API key is inactive', code: 'INACTIVE_API_KEY' });
      return;
    }

    const requestAsUnknown = request as unknown as Record<string, unknown>;
    requestAsUnknown.apiKey = apiKey;
  } catch (error) {
    logger.error({ error, context: 'API key validation failed' });
    reply.status(500).send({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const registerAuthMiddleware = async (app: FastifyInstance) => {
  app.addHook('onRequest', validateApiKey);
};
