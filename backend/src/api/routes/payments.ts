import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { normalizeCreatePaymentRequest, normalizeRefundPaymentRequest, normalizeListPaymentsQuery } from '../normalizers/request.js';
import * as paymentService from '../services/paymentService.js';
import { PaymentError } from '../middleware/errorHandler.js';
import { ErrorCode } from '../../types/payment.js';

interface CreatePaymentBody {
  Body: Record<string, unknown>;
}

interface RefundPaymentParams {
  Params: { id: string };
  Body: Record<string, unknown>;
}

interface ListPaymentsQuery {
  Querystring: Record<string, unknown>;
}

interface CheckPaymentStatusParams {
  Params: { id: string };
}

const ensurePaymentSchemas = (app: FastifyInstance) => {
  const schemas = app.getSchemas();

  if (!schemas.CreatePaymentRequest) {
    app.addSchema({
      $id: 'CreatePaymentRequest',
      type: 'object',
      required: ['currency', 'provider', 'customer_id', 'payment_method'],
      properties: {
        amount: { type: ['number', 'string'] },
        amount_in_minor: { type: ['number', 'integer'] },
        amount_in_cents: { type: ['number', 'integer'] },
        amount_minor: { type: ['number', 'integer'] },
        currency: { type: 'string' },
        provider: { type: 'string' },
        customer_id: { type: 'string' },
        payment_method: { type: 'string' },
        description: { type: 'string' },
        metadata: { type: ['object', 'null'] },
      },
      additionalProperties: true,
    });
  }

  if (!schemas.CreatePaymentResponse) {
    app.addSchema({
      $id: 'CreatePaymentResponse',
      type: 'object',
      properties: {
        id: { type: 'string' },
        provider_transaction_id: { type: 'string' },
        amount: { type: 'number' },
        currency: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded', 'processing'] },
        created_at: { type: 'string' },
        trace_id: { type: 'string' },
        metadata: { type: ['object', 'null'] },
        provider_metadata: { type: ['object', 'null'] },
      },
    });
  }

  if (!schemas.RefundPaymentRequest) {
    app.addSchema({
      $id: 'RefundPaymentRequest',
      type: 'object',
      properties: {
        amount: { type: 'number' },
        reason: { type: 'string' },
      },
    });
  }

  if (!schemas.RefundPaymentResponse) {
    app.addSchema({
      $id: 'RefundPaymentResponse',
      type: 'object',
      properties: {
        refund_id: { type: 'string' },
        original_transaction_id: { type: 'string' },
        amount: { type: 'number' },
        status: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded', 'processing'] },
        created_at: { type: 'string' },
        trace_id: { type: 'string' },
      },
    });
  }

  if (!schemas.PaymentRecord) {
    app.addSchema({
      $id: 'PaymentRecord',
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
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
      },
    });
  }

  if (!schemas.ListPaymentsResponse) {
    app.addSchema({
      $id: 'ListPaymentsResponse',
      type: 'object',
      properties: {
        payments: {
          type: 'array',
          items: { $ref: 'PaymentRecord#' },
        },
        total: { type: 'number' },
        limit: { type: 'number' },
        offset: { type: 'number' },
        trace_id: { type: 'string' },
      },
    });
  }

  if (!schemas.ErrorResponse) {
    app.addSchema({
      $id: 'ErrorResponse',
      type: 'object',
      properties: {
        error: { type: 'string' },
        code: { type: 'string' },
        trace_id: { type: 'string' },
        details: { type: 'object' },
      },
    });
  }
};

export const registerPaymentRoutes = async (app: FastifyInstance) => {
  ensurePaymentSchemas(app);

  app.post<CreatePaymentBody>(
    '/api/v1/payments/create',
    {
      schema: {
        tags: ['payments'],
        summary: 'Create a new payment',
        body: { $ref: 'CreatePaymentRequest#' },
        response: {
          201: { $ref: 'CreatePaymentResponse#' },
          400: { $ref: 'ErrorResponse#' },
          500: { $ref: 'ErrorResponse#' },
        },
      },
    },
     async (request: FastifyRequest<CreatePaymentBody>, reply: FastifyReply) => {
       try {
         const normalized = normalizeCreatePaymentRequest(request.body);
         const idempotencyKey = request.headers['idempotency-key'] as string;

         const response = await paymentService.createPayment(normalized, idempotencyKey);

         if (response.trace_id) {
           reply.header('X-Trace-Id', response.trace_id);
         }

         reply.status(201).send(response);
       } catch (error) {
        if (error instanceof PaymentError) {
          throw error;
        }
        throw new PaymentError(
          ErrorCode.PAYMENT_FAILED,
          error instanceof Error ? error.message : 'Payment creation failed',
          500
        );
      }
    }
  );

  app.post<RefundPaymentParams>(
    '/api/v1/payments/:id/refund',
    {
      schema: {
        tags: ['payments'],
        summary: 'Refund a payment',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Payment transaction ID' },
          },
        },
        body: { $ref: 'RefundPaymentRequest#' },
        response: {
          200: { $ref: 'RefundPaymentResponse#' },
          404: { $ref: 'ErrorResponse#' },
          500: { $ref: 'ErrorResponse#' },
        },
      },
    },
    async (request: FastifyRequest<RefundPaymentParams>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const normalized = normalizeRefundPaymentRequest(request.body);

        const customerId = (request as FastifyRequest & { customerId?: string }).customerId;

        const response = await paymentService.refundPayment(
          id,
          normalized.amount,
          normalized.reason,
          customerId
        );

        if (response.trace_id) {
          reply.header('X-Trace-Id', response.trace_id);
        }

        reply.send(response);
      } catch (error) {
        if (error instanceof PaymentError) {
          throw error;
        }
        throw new PaymentError(
          ErrorCode.REFUND_FAILED,
          error instanceof Error ? error.message : 'Refund failed',
          500
        );
      }
    }
  );

  app.get<CheckPaymentStatusParams>(
    '/api/v1/payments/:id/status',
    {
      schema: {
        tags: ['payments'],
        summary: 'Check payment status',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Payment ID' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded', 'processing'] },
              trace_id: { type: 'string' },
            },
          },
          404: { $ref: 'ErrorResponse#' },
          500: { $ref: 'ErrorResponse#' },
        },
      },
    },
    async (request: FastifyRequest<CheckPaymentStatusParams>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const traceId = randomUUID();

        const status = await paymentService.checkPaymentStatus(id);

        reply.header('X-Trace-Id', traceId);
        reply.send({
          status,
          trace_id: traceId,
        });
      } catch (error) {
        if (error instanceof PaymentError) {
          throw error;
        }
        throw new PaymentError(
          ErrorCode.INTERNAL_ERROR,
          error instanceof Error ? error.message : 'Failed to check payment status',
          500
        );
      }
    }
  );

  app.get<ListPaymentsQuery>(
    '/api/v1/payments',
    {
      schema: {
        tags: ['payments'],
        summary: 'List payments with filtering',
        querystring: {
          type: 'object',
          properties: {
            provider: { type: 'string' },
            status: { type: 'string' },
            customer_id: { type: 'string' },
            start_date: { type: 'string' },
            end_date: { type: 'string' },
            limit: { type: ['number', 'string'] },
            offset: { type: ['number', 'string'] },
          },
          additionalProperties: true,
        },
        response: {
          200: { $ref: 'ListPaymentsResponse#' },
          500: { $ref: 'ErrorResponse#' },
        },
      },
    },
    async (request: FastifyRequest<ListPaymentsQuery>, reply: FastifyReply) => {
      try {
        const normalized = normalizeListPaymentsQuery(request.query);

        const response = await paymentService.listPayments(normalized);

        if (response.trace_id) {
          reply.header('X-Trace-Id', response.trace_id);
        }

        reply.send(response);
      } catch (error) {
        if (error instanceof PaymentError) {
          throw error;
        }
        throw new PaymentError(
          ErrorCode.INTERNAL_ERROR,
          error instanceof Error ? error.message : 'Failed to list payments',
          500
        );
      }
    }
  );
};
