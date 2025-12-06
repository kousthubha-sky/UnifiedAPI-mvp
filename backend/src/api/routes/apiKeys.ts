import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as apiKeyRepository from '../../repositories/apiKeyRepository.js';
import logger from '../../utils/logger.js';
import { auditLogToDatabase } from '../../utils/logger.js';
import crypto from 'crypto';

const CreateApiKeySchema = z.object({
  name: z.string().optional(),
});

const generateTraceId = (): string => {
  return crypto.randomUUID();
};

export const registerApiKeyRoutes = async (app: FastifyInstance) => {
  app.post<{ Body: Record<string, unknown> }>(
    '/api/v1/api-keys',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const traceId = generateTraceId();
      const startTime = Date.now();

      try {
        const requestAsUnknown = request as unknown as Record<string, unknown>;
        const customerId = requestAsUnknown.customerId as string;

        if (!customerId) {
          await auditLogToDatabase({
            trace_id: traceId,
            endpoint: '/api/v1/api-keys',
            method: 'POST',
            status: 401,
            latency_ms: Date.now() - startTime,
            error_message: 'Unauthorized',
          });

          return reply.status(401).send({
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
          });
        }

        const payload = CreateApiKeySchema.parse(request.body);

        const result = await apiKeyRepository.generate({
          customer_id: customerId,
          name: payload.name,
        });

        if (!result) {
          await auditLogToDatabase({
            trace_id: traceId,
            customer_id: customerId,
            endpoint: '/api/v1/api-keys',
            method: 'POST',
            status: 500,
            latency_ms: Date.now() - startTime,
            error_message: 'Failed to generate API key',
          });

          return reply.status(500).send({
            error: 'Failed to generate API key',
            code: 'INTERNAL_ERROR',
          });
        }

        await auditLogToDatabase({
          trace_id: traceId,
          customer_id: customerId,
          endpoint: '/api/v1/api-keys',
          method: 'POST',
          status: 201,
          latency_ms: Date.now() - startTime,
        });

        reply.status(201).send({
          id: result.apiKey.id,
          key: result.key,
          name: result.apiKey.name,
          is_active: result.apiKey.is_active,
          created_at: result.apiKey.created_at,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const requestAsUnknown = request as unknown as Record<string, unknown>;
          const customerId = requestAsUnknown.customerId as string;

          await auditLogToDatabase({
            trace_id: traceId,
            customer_id: customerId,
            endpoint: '/api/v1/api-keys',
            method: 'POST',
            status: 400,
            latency_ms: Date.now() - startTime,
            error_message: 'Validation failed',
          });

          return reply.status(400).send({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.errors,
          });
        }

        logger.error({ error, traceId }, 'Error generating API key');
        const requestAsUnknown = request as unknown as Record<string, unknown>;
        const customerId = requestAsUnknown.customerId as string;

        await auditLogToDatabase({
          trace_id: traceId,
          customer_id: customerId,
          endpoint: '/api/v1/api-keys',
          method: 'POST',
          status: 500,
          latency_ms: Date.now() - startTime,
          error_message: error instanceof Error ? error.message : 'Internal server error',
        });

        reply.status(500).send({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        });
      }
    }
  );

  app.get('/api/v1/api-keys', async (request: FastifyRequest, reply: FastifyReply) => {
    const traceId = generateTraceId();
    const startTime = Date.now();

    try {
      const requestAsUnknown = request as unknown as Record<string, unknown>;
      const customerId = requestAsUnknown.customerId as string;

      if (!customerId) {
        await auditLogToDatabase({
          trace_id: traceId,
          endpoint: '/api/v1/api-keys',
          method: 'GET',
          status: 401,
          latency_ms: Date.now() - startTime,
          error_message: 'Unauthorized',
        });

        return reply.status(401).send({
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
        });
      }

      const keys = await apiKeyRepository.list(customerId);

      await auditLogToDatabase({
        trace_id: traceId,
        customer_id: customerId,
        endpoint: '/api/v1/api-keys',
        method: 'GET',
        status: 200,
        latency_ms: Date.now() - startTime,
      });

      reply.send({
        keys: keys.map((k) => ({
          id: k.id,
          name: k.name,
          is_active: k.is_active,
          last_used_at: k.last_used_at,
          created_at: k.created_at,
        })),
      });
    } catch (error) {
      logger.error({ error, traceId }, 'Error listing API keys');
      const requestAsUnknown = request as unknown as Record<string, unknown>;
      const customerId = requestAsUnknown.customerId as string;

      await auditLogToDatabase({
        trace_id: traceId,
        customer_id: customerId,
        endpoint: '/api/v1/api-keys',
        method: 'GET',
        status: 500,
        latency_ms: Date.now() - startTime,
        error_message: error instanceof Error ? error.message : 'Internal server error',
      });

      reply.status(500).send({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/v1/api-keys/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const traceId = generateTraceId();
      const startTime = Date.now();

      try {
        const { id } = request.params as { id: string };
        const requestAsUnknown = request as unknown as Record<string, unknown>;
        const customerId = requestAsUnknown.customerId as string;
        const body = request.body as Record<string, unknown>;

        if (!customerId) {
          await auditLogToDatabase({
            trace_id: traceId,
            endpoint: '/api/v1/api-keys/:id',
            method: 'PATCH',
            status: 401,
            latency_ms: Date.now() - startTime,
            error_message: 'Unauthorized',
          });

          return reply.status(401).send({
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
          });
        }

        const action = body.action as string || 'revoke';

        if (action === 'revoke') {
          const success = await apiKeyRepository.revoke(id);

          if (!success) {
            await auditLogToDatabase({
              trace_id: traceId,
              customer_id: customerId,
              endpoint: '/api/v1/api-keys/:id',
              method: 'PATCH',
              status: 404,
              latency_ms: Date.now() - startTime,
              error_message: 'API key not found',
            });

            return reply.status(404).send({
              error: 'API key not found',
              code: 'API_KEY_NOT_FOUND',
            });
          }

          await auditLogToDatabase({
            trace_id: traceId,
            customer_id: customerId,
            endpoint: '/api/v1/api-keys/:id',
            method: 'PATCH',
            status: 200,
            latency_ms: Date.now() - startTime,
          });

          reply.send({ success: true, message: 'API key revoked' });
        } else if (action === 'rotate') {
          const result = await apiKeyRepository.rotate(id);

          if (!result) {
            await auditLogToDatabase({
              trace_id: traceId,
              customer_id: customerId,
              endpoint: '/api/v1/api-keys/:id',
              method: 'PATCH',
              status: 404,
              latency_ms: Date.now() - startTime,
              error_message: 'API key not found',
            });

            return reply.status(404).send({
              error: 'API key not found',
              code: 'API_KEY_NOT_FOUND',
            });
          }

          await auditLogToDatabase({
            trace_id: traceId,
            customer_id: customerId,
            endpoint: '/api/v1/api-keys/:id',
            method: 'PATCH',
            status: 200,
            latency_ms: Date.now() - startTime,
          });

          reply.send({
            id: result.apiKey.id,
            key: result.key,
            name: result.apiKey.name,
            is_active: result.apiKey.is_active,
            created_at: result.apiKey.created_at,
          });
        } else {
          await auditLogToDatabase({
            trace_id: traceId,
            customer_id: customerId,
            endpoint: '/api/v1/api-keys/:id',
            method: 'PATCH',
            status: 400,
            latency_ms: Date.now() - startTime,
            error_message: 'Invalid action',
          });

          return reply.status(400).send({
            error: 'Invalid action',
            code: 'INVALID_ACTION',
          });
        }
      } catch (error) {
        logger.error({ error, traceId }, 'Error updating API key');
        const requestAsUnknown = request as unknown as Record<string, unknown>;
        const customerId = requestAsUnknown.customerId as string;

        await auditLogToDatabase({
          trace_id: traceId,
          customer_id: customerId,
          endpoint: '/api/v1/api-keys/:id',
          method: 'PATCH',
          status: 500,
          latency_ms: Date.now() - startTime,
          error_message: error instanceof Error ? error.message : 'Internal server error',
        });

        reply.status(500).send({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        });
      }
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/api-keys/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const traceId = generateTraceId();
      const startTime = Date.now();

      try {
        const { id } = request.params as { id: string };
        const requestAsUnknown = request as unknown as Record<string, unknown>;
        const customerId = requestAsUnknown.customerId as string;

        if (!customerId) {
          await auditLogToDatabase({
            trace_id: traceId,
            endpoint: '/api/v1/api-keys/:id',
            method: 'DELETE',
            status: 401,
            latency_ms: Date.now() - startTime,
            error_message: 'Unauthorized',
          });

          return reply.status(401).send({
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
          });
        }

        const success = await apiKeyRepository.delete_(id);

        if (!success) {
          await auditLogToDatabase({
            trace_id: traceId,
            customer_id: customerId,
            endpoint: '/api/v1/api-keys/:id',
            method: 'DELETE',
            status: 404,
            latency_ms: Date.now() - startTime,
            error_message: 'API key not found',
          });

          return reply.status(404).send({
            error: 'API key not found',
            code: 'API_KEY_NOT_FOUND',
          });
        }

        await auditLogToDatabase({
          trace_id: traceId,
          customer_id: customerId,
          endpoint: '/api/v1/api-keys/:id',
          method: 'DELETE',
          status: 200,
          latency_ms: Date.now() - startTime,
        });

        reply.send({ success: true, message: 'API key deleted' });
      } catch (error) {
        logger.error({ error, traceId }, 'Error deleting API key');
        const requestAsUnknown = request as unknown as Record<string, unknown>;
        const customerId = requestAsUnknown.customerId as string;

        await auditLogToDatabase({
          trace_id: traceId,
          customer_id: customerId,
          endpoint: '/api/v1/api-keys/:id',
          method: 'DELETE',
          status: 500,
          latency_ms: Date.now() - startTime,
          error_message: error instanceof Error ? error.message : 'Internal server error',
        });

        reply.status(500).send({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        });
      }
    }
  );
};
