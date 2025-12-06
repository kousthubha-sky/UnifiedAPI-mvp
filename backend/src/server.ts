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
      host: process.env.API_HOST || 'localhost:3000',
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
      definitions: {
        CreatePaymentRequest: {
          type: 'object',
          required: ['currency', 'provider', 'customer_id', 'payment_method'],
          properties: {
            amount: { type: 'number', description: 'Payment amount in major units (e.g., dollars)' },
            amount_in_minor: { type: 'integer', description: 'Payment amount in the smallest currency unit (e.g., cents)' },
            amount_in_cents: { type: 'integer', description: 'Alias for amount_in_minor' },
            amount_minor: { type: 'integer', description: 'Alias for amount_in_minor' },
            currency: { type: 'string', description: '3-letter currency code (e.g., USD, EUR)', minLength: 3, maxLength: 3 },
            provider: { type: 'string', enum: ['stripe', 'paypal'], description: 'Payment provider' },
            customer_id: { type: 'string', description: 'Customer identifier' },
            payment_method: { type: 'string', description: 'Payment method identifier' },
            description: { type: 'string', description: 'Payment description' },
            metadata: { type: 'object', description: 'Additional metadata' },
          },
        },
        CreatePaymentResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Payment ID' },
            provider_transaction_id: { type: 'string', description: 'Provider transaction ID' },
            amount: { type: 'number', description: 'Payment amount' },
            currency: { type: 'string', description: 'Currency code' },
            status: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded', 'processing'] },
            created_at: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
            trace_id: { type: 'string', description: 'Request trace ID' },
            metadata: { type: 'object', description: 'Payment metadata' },
            provider_metadata: { type: 'object', description: 'Provider-specific metadata' },
          },
        },
        RefundPaymentRequest: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Refund amount (optional, defaults to full refund)' },
            reason: { type: 'string', description: 'Refund reason' },
          },
        },
        RefundPaymentResponse: {
          type: 'object',
          properties: {
            refund_id: { type: 'string', description: 'Refund ID' },
            original_transaction_id: { type: 'string', description: 'Original payment transaction ID' },
            amount: { type: 'number', description: 'Refund amount' },
            status: { type: 'string', enum: ['pending', 'completed', 'failed'] },
            created_at: { type: 'string', format: 'date-time', description: 'Refund timestamp' },
            trace_id: { type: 'string', description: 'Request trace ID' },
          },
        },
        PaymentRecord: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            provider_transaction_id: { type: 'string' },
            provider: { type: 'string', enum: ['stripe', 'paypal'] },
            amount: { type: 'number' },
            currency: { type: 'string' },
            status: { type: 'string' },
            customer_id: { type: 'string' },
            metadata: { type: 'object' },
            refund_id: { type: 'string' },
            refund_status: { type: 'string' },
            refund_amount: { type: 'number' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        ListPaymentsResponse: {
          type: 'object',
          properties: {
            payments: {
              type: 'array',
              items: { $ref: 'PaymentRecord#' },
            },
            total: { type: 'number', description: 'Total number of payments matching filters' },
            limit: { type: 'number', description: 'Pagination limit' },
            offset: { type: 'number', description: 'Pagination offset' },
            trace_id: { type: 'string', description: 'Request trace ID' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error message' },
            code: { type: 'string', description: 'Error code' },
            trace_id: { type: 'string', description: 'Request trace ID' },
            details: { type: 'object', description: 'Additional error details' },
          },
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
