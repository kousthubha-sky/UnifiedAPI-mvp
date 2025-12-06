import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { cacheGet, cacheSet } from '../../utils/cache.js';
import logger from '../../utils/logger.js';

interface TokenBucketState {
  tokens: number;
  lastRefill: number;
}

const TIER_LIMITS: Record<string, { perHour: number }> = {
  starter: { perHour: 1000 },
  growth: { perHour: 5000 },
  scale: { perHour: 20000 },
  admin: { perHour: Infinity },
};

const getRefillRate = (tier: string): number => {
  const tierLimit = TIER_LIMITS[tier] || TIER_LIMITS.starter;
  return tierLimit.perHour / 60;
};

const getCapacity = (tier: string): number => {
  const tierLimit = TIER_LIMITS[tier] || TIER_LIMITS.starter;
  return tierLimit.perHour;
};

const PUBLIC_PATHS = ['/health', '/docs', '/swagger'];
const PUBLIC_METHODS: Record<string, string[]> = {
  POST: ['/api/v1/customers'],
};

export const checkRateLimit = async (
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

  const requestAsUnknown = request as unknown as Record<string, unknown>;
  const apiKey = requestAsUnknown.apiKey as string | undefined;
  const tier = requestAsUnknown.tier as string || 'starter';

  if (!apiKey) {
    reply.status(400).send({ error: 'API key required', code: 'MISSING_API_KEY' });
    return;
  }

  const bucketKey = `rate_limit:${apiKey}`;
  const capacity = getCapacity(tier);
  const refillRate = getRefillRate(tier);

  if (capacity === Infinity) {
    return;
  }

  try {
    let state: TokenBucketState;
    const cached = await cacheGet(bucketKey);

    if (cached) {
      state = JSON.parse(cached) as TokenBucketState;
    } else {
      state = {
        tokens: capacity,
        lastRefill: Date.now(),
      };
    }

    const now = Date.now();
    const timePassed = now - state.lastRefill;
    const refillIntervalMs = 60000;
    const tokensToAdd = (timePassed / refillIntervalMs) * refillRate;

    state.tokens = Math.min(capacity, state.tokens + tokensToAdd);
    state.lastRefill = now;

    if (state.tokens < 1) {
      logger.warn({
        type: 'RATE_LIMIT_EXCEEDED',
        tier,
        apiKey: apiKey.substring(0, 8) + '...',
      });

      reply.status(429).send({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        limit: TIER_LIMITS[tier]?.perHour || TIER_LIMITS.starter.perHour,
      });
      return;
    }

    state.tokens -= 1;
    await cacheSet(bucketKey, JSON.stringify(state), 3600);

    reply.header('X-RateLimit-Limit', String(capacity));
    reply.header('X-RateLimit-Remaining', String(Math.floor(state.tokens)));
    reply.header('X-RateLimit-Reset', String(Math.ceil((state.lastRefill + 3600000) / 1000)));
  } catch (error) {
    logger.error({ error, context: 'Rate limit check failed' });
    reply.status(500).send({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const registerRateLimitMiddleware = async (app: FastifyInstance) => {
  app.addHook('onRequest', checkRateLimit);
};
