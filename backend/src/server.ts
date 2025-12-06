import 'dotenv/config';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import logger from './utils/logger.js';
import { initCache } from './utils/cache.js';
import { registerLoggingMiddleware } from './api/middleware/logging.js';
import { registerAuthMiddleware } from './api/middleware/auth.js';
import { registerRateLimitMiddleware } from './api/middleware/rateLimit.js';
import { registerErrorHandler } from './api/middleware/errorHandler.js';
import { registerPaymentRoutes } from './api/routes/payments.js';

let app: FastifyInstance | null = null;

const createServer = async (): Promise<FastifyInstance> => {
  app = Fastify({
    logger: false,
  });

  await app.register(fastifyCors, {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  await app.register(fastifySwagger, {
    swagger: {
      info: {
        title: 'Unified Payment API',
        description: 'Payment processing API supporting Stripe and PayPal',
        version: '1.0.0',
      },
      host: process.env.API_HOST || 'localhost:3000',
      schemes: [process.env.API_SCHEME || 'http'],
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        api_key: {
          type: 'apiKey',
          name: 'x-api-key',
          in: 'header',
        },
      },
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
  });

  registerErrorHandler(app);

  registerLoggingMiddleware(app);

  registerAuthMiddleware(app);

  registerRateLimitMiddleware(app);

  await registerPaymentRoutes(app);

  app.get('/health', async (_request, _reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return app;
};

const startServer = async () => {
  try {
    await initCache();

    app = await createServer();

    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });

    logger.info({
      type: 'SERVER_STARTED',
      host,
      port,
      message: `Server listening at http://${host}:${port}`,
    });

    logger.info({
      type: 'SWAGGER_DOCS',
      message: `Swagger documentation available at http://${host}:${port}/docs`,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (app) {
    await app.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (app) {
    await app.close();
  }
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export { createServer, startServer };
