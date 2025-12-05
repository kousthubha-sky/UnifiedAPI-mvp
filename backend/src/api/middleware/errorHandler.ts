import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import logger from '../../utils/logger.js';
import { ErrorResponse } from '../../types/payment.js';

export class PaymentError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

export const registerErrorHandler = async (app: FastifyInstance) => {
  app.setErrorHandler(async (error: unknown, _request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const errorRecord = error as Record<string, unknown>;
    logger.error(
      {
        error: String(errorRecord.message),
        stack: String(errorRecord.stack),
      },
      'Unhandled error'
    );

    let statusCode = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: Record<string, unknown> | undefined;

    if (error instanceof PaymentError) {
      statusCode = error.statusCode;
      code = error.code;
      message = error.message;
      details = error.details;
    } else if (error instanceof ZodError) {
      statusCode = 400;
      code = 'VALIDATION_ERROR';
      message = 'Invalid request payload';
      details = {
        errors: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      };
    } else if (Number(errorRecord.statusCode) === 404) {
      statusCode = 404;
      code = 'NOT_FOUND';
      message = 'Resource not found';
    }

    const response: ErrorResponse = {
      error: message,
      code,
      details,
    };

    reply.status(statusCode).send(response);
  });
};
