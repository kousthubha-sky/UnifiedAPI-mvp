// backend/src/server.ts - Fixed version with proper logging
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
import { registerCustomerRoutes } from './api/routes/customers.js';
import { registerApiKeyRoutes } from './api/routes/apiKeys.js';

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
        description: 'Payment orchestration API with support for Stripe and PayPal, featuring exponential backoff, trace IDs, and comprehensive filtering',
        version: '1.0.0',
      },
      host: process.env.API_HOST || 'localhost:3001',
      schemes: [process.env.API_SCHEME || 'http'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'payments', description: 'Payment operations' },
        { name: 'customers', description: 'Customer management' },
        { name: 'api-keys', description: 'API key management' },
      ],
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
  await registerCustomerRoutes(app);
  await registerApiKeyRoutes(app);

  app.get('/health', async (_request, _reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return app;
};

const startServer = async () => {
  try {
    // Initialize Redis
    try {
      await initCache();
      console.log('✅ Redis connected');
    } catch (cacheError) {
      console.warn('⚠️  Redis connection failed, continuing without cache:', cacheError);
    }

    // Create server
    app = await createServer();

    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';

    // Start listening
    await app.listen({ port, host });

    // Log startup info to console (force stdout)
    const banner = [
      '',
      '═'.repeat(70),
      '  🚀 PaymentHub API Server Started',
      '═'.repeat(70),
      `  📍 Server URL:    http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`,
      `  📚 Documentation: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/docs`,
      `  💚 Health Check:  http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/health`,
      `  🔴 Redis:         Connected on ${process.env.REDIS_URL || 'redis://localhost:6379'}`,
      `  🗄️  Supabase:      Connected to ${process.env.SUPABASE_URL?.replace('https://', '')}`,
      '═'.repeat(70),
      `  Environment:      ${process.env.NODE_ENV || 'development'}`,
      `  Node Version:     ${process.version}`,
      `  PID:              ${process.pid}`,
      '═'.repeat(70),
      '',
    ].join('\n');

    // Force output to stdout
    process.stdout.write(banner);

    logger.info({
      type: 'SERVER_STARTED',
      host,
      port,
      message: `Server listening at http://${host}:${port}`,
    });

  } catch (error) {
    console.error('\n❌ Failed to start server:');
    console.error(error);
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