import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import logger from '../../utils/logger.js';

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

export const registerLoggingMiddleware = async (app: FastifyInstance) => {
  app.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    request.startTime = Date.now();

    logger.info({
      type: 'REQUEST',
      method: request.method,
      url: request.url,
      ip: request.ip,
    });
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const duration = Date.now() - (request.startTime || Date.now());

    logger.info({
      type: 'RESPONSE',
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${duration}ms`,
    });
  });
};
