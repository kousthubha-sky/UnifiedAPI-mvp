import { createClient } from 'redis';
import logger from './logger.js';

let redisClient: ReturnType<typeof createClient> | null = null;

export const initCache = async () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  redisClient = createClient({
    url: redisUrl,
  });

  redisClient.on('error', (err) => logger.error({ error: err }, 'Redis error'));

  await redisClient.connect();
  logger.info('Redis connected');

  return redisClient;
};

export const getCache = (): ReturnType<typeof createClient> => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initCache() first.');
  }
  return redisClient;
};

export const closeCache = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};

export const cacheGet = async (key: string): Promise<string | null> => {
  const client = getCache();
  return client.get(key);
};

export const cacheSet = async (key: string, value: string, expirationSeconds?: number) => {
  const client = getCache();
  if (expirationSeconds) {
    await client.setEx(key, expirationSeconds, value);
  } else {
    await client.set(key, value);
  }
};

export const cacheDel = async (key: string) => {
  const client = getCache();
  await client.del(key);
};
