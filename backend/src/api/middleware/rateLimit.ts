import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { cacheGet, cacheSet } from '../../utils/cache.js';
import logger from '../../utils/logger.js';

interface TokenBucketState {
  tokens: number;
  lastRefill: number;
}

const REFILL_RATE = 100;
const CAPACITY = 1000;
const REFILL_INTERVAL_MS = 60000;

export const checkRateLimit = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const requestAsUnknown = request as unknown as Record<string, unknown>;
  const apiKey = requestAsUnknown.apiKey as string | undefined;

  if (!apiKey) {
    reply.status(400).send({ error: 'API key required', code: 'MISSING_API_KEY' });
    return;
  }

  const bucketKey = `rate_limit:${apiKey}`;

  try {
    let state: TokenBucketState;
    const cached = await cacheGet(bucketKey);

    if (cached) {
      state = JSON.parse(cached) as TokenBucketState;
    } else {
      state = {
        tokens: CAPACITY,
        lastRefill: Date.now(),
      };
    }

    const now = Date.now();
    const timePassed = now - state.lastRefill;
    const tokensToAdd = (timePassed / REFILL_INTERVAL_MS) * REFILL_RATE;

    state.tokens = Math.min(CAPACITY, state.tokens + tokensToAdd);
    state.lastRefill = now;

    if (state.tokens < 1) {
      logger.warn({
        type: 'RATE_LIMIT_EXCEEDED',
        apiKey: apiKey.substring(0, 8) + '...',
      });

      reply.status(429).send({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
      });
      return;
    }

    state.tokens -= 1;
    await cacheSet(bucketKey, JSON.stringify(state), 3600);

    reply.header('X-RateLimit-Remaining', Math.floor(state.tokens));
  } catch (error) {
    logger.error({ error, context: 'Rate limit check failed' });
    reply.status(500).send({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const registerRateLimitMiddleware = async (app: FastifyInstance) => {
  app.addHook('onRequest', checkRateLimit);
};
