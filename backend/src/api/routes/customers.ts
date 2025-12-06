import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as customerRepository from '../../repositories/customerRepository.js';
import logger from '../../utils/logger.js';
import { auditLogToDatabase } from '../../utils/logger.js';
import crypto from 'crypto';

const CreateCustomerSchema = z.object({
  email: z.string().email('Invalid email address'),
  tier: z.enum(['starter', 'growth', 'scale']).optional(),
});

const UpdateCustomerSchema = z.object({
  tier: z.enum(['starter', 'growth', 'scale']).optional(),
  stripe_account_id: z.string().optional(),
  paypal_account_id: z.string().optional(),
});

const generateTraceId = (): string => {
  return crypto.randomUUID();
};

export const registerCustomerRoutes = async (app: FastifyInstance) => {
  app.post<{ Body: Record<string, unknown> }>(
    '/api/v1/customers',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const traceId = generateTraceId();
      const startTime = Date.now();

      try {
        const payload = CreateCustomerSchema.parse(request.body);

        const existing = await customerRepository.findByEmail(payload.email);
        if (existing) {
          await auditLogToDatabase({
            trace_id: traceId,
            endpoint: '/api/v1/customers',
            method: 'POST',
            status: 409,
            latency_ms: Date.now() - startTime,
            error_message: 'Customer already exists',
          });

          return reply.status(409).send({
            error: 'Customer with this email already exists',
            code: 'CUSTOMER_EXISTS',
          });
        }

        const customer = await customerRepository.create({
          email: payload.email,
          tier: payload.tier || 'starter',
        });

        if (!customer) {
          await auditLogToDatabase({
            trace_id: traceId,
            endpoint: '/api/v1/customers',
            method: 'POST',
            status: 500,
            latency_ms: Date.now() - startTime,
            error_message: 'Failed to create customer',
          });

          return reply.status(500).send({
            error: 'Failed to create customer',
            code: 'INTERNAL_ERROR',
          });
        }

        await auditLogToDatabase({
          trace_id: traceId,
          customer_id: customer.id,
          endpoint: '/api/v1/customers',
          method: 'POST',
          status: 201,
          latency_ms: Date.now() - startTime,
        });

        reply.status(201).send({
          id: customer.id,
          email: customer.email,
          tier: customer.tier,
          created_at: customer.created_at,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          await auditLogToDatabase({
            trace_id: traceId,
            endpoint: '/api/v1/customers',
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

        logger.error({ error, traceId }, 'Error creating customer');
        await auditLogToDatabase({
          trace_id: traceId,
          endpoint: '/api/v1/customers',
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

  app.get<{ Params: { id: string } }>(
    '/api/v1/customers/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const traceId = generateTraceId();
      const startTime = Date.now();

      try {
        const { id } = request.params as { id: string };
        const requestAsUnknown = request as unknown as Record<string, unknown>;
        const customerId = requestAsUnknown.customerId as string;

        if (id !== customerId && customerId !== 'admin') {
          await auditLogToDatabase({
            trace_id: traceId,
            customer_id: customerId,
            endpoint: '/api/v1/customers/:id',
            method: 'GET',
            status: 403,
            latency_ms: Date.now() - startTime,
            error_message: 'Unauthorized',
          });

          return reply.status(403).send({
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
          });
        }

        const customer = await customerRepository.findById(id);

        if (!customer) {
          await auditLogToDatabase({
            trace_id: traceId,
            customer_id: customerId,
            endpoint: '/api/v1/customers/:id',
            method: 'GET',
            status: 404,
            latency_ms: Date.now() - startTime,
            error_message: 'Customer not found',
          });

          return reply.status(404).send({
            error: 'Customer not found',
            code: 'CUSTOMER_NOT_FOUND',
          });
        }

        await auditLogToDatabase({
          trace_id: traceId,
          customer_id: customerId,
          endpoint: '/api/v1/customers/:id',
          method: 'GET',
          status: 200,
          latency_ms: Date.now() - startTime,
        });

        reply.send({
          id: customer.id,
          email: customer.email,
          tier: customer.tier,
          stripe_account_id: customer.stripe_account_id,
          paypal_account_id: customer.paypal_account_id,
          created_at: customer.created_at,
          updated_at: customer.updated_at,
        });
      } catch (error) {
        logger.error({ error, traceId }, 'Error fetching customer');
        const requestAsUnknown = request as unknown as Record<string, unknown>;
        const customerId = requestAsUnknown.customerId as string;

        await auditLogToDatabase({
          trace_id: traceId,
          customer_id: customerId,
          endpoint: '/api/v1/customers/:id',
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
    }
  );

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/v1/customers/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const traceId = generateTraceId();
      const startTime = Date.now();

      try {
        const { id } = request.params as { id: string };
        const requestAsUnknown = request as unknown as Record<string, unknown>;
        const customerId = requestAsUnknown.customerId as string;

        if (id !== customerId && customerId !== 'admin') {
          await auditLogToDatabase({
            trace_id: traceId,
            customer_id: customerId,
            endpoint: '/api/v1/customers/:id',
            method: 'PATCH',
            status: 403,
            latency_ms: Date.now() - startTime,
            error_message: 'Unauthorized',
          });

          return reply.status(403).send({
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
          });
        }

        const payload = UpdateCustomerSchema.parse(request.body);

        const customer = await customerRepository.update(id, payload);

        if (!customer) {
          await auditLogToDatabase({
            trace_id: traceId,
            customer_id: customerId,
            endpoint: '/api/v1/customers/:id',
            method: 'PATCH',
            status: 404,
            latency_ms: Date.now() - startTime,
            error_message: 'Customer not found',
          });

          return reply.status(404).send({
            error: 'Customer not found',
            code: 'CUSTOMER_NOT_FOUND',
          });
        }

        await auditLogToDatabase({
          trace_id: traceId,
          customer_id: customerId,
          endpoint: '/api/v1/customers/:id',
          method: 'PATCH',
          status: 200,
          latency_ms: Date.now() - startTime,
        });

        reply.send({
          id: customer.id,
          email: customer.email,
          tier: customer.tier,
          stripe_account_id: customer.stripe_account_id,
          paypal_account_id: customer.paypal_account_id,
          created_at: customer.created_at,
          updated_at: customer.updated_at,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const requestAsUnknown = request as unknown as Record<string, unknown>;
          const customerId = requestAsUnknown.customerId as string;

          await auditLogToDatabase({
            trace_id: traceId,
            customer_id: customerId,
            endpoint: '/api/v1/customers/:id',
            method: 'PATCH',
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

        logger.error({ error, traceId }, 'Error updating customer');
        const requestAsUnknown = request as unknown as Record<string, unknown>;
        const customerId = requestAsUnknown.customerId as string;

        await auditLogToDatabase({
          trace_id: traceId,
          customer_id: customerId,
          endpoint: '/api/v1/customers/:id',
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
};
