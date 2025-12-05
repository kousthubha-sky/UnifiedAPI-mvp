import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreatePaymentRequestSchema, RefundPaymentRequestSchema } from '../../types/payment.js';
import { StripeAdapter } from '../../adapters/stripe.js';
import { PayPalAdapter } from '../../adapters/paypal.js';
import supabase from '../../utils/supabase.js';
import { cacheGet, cacheSet } from '../../utils/cache.js';
import logger from '../../utils/logger.js';
import { PaymentError } from '../middleware/errorHandler.js';

export const registerPaymentRoutes = async (app: FastifyInstance) => {
  app.post<{ Body: Record<string, unknown> }>('/payments', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = CreatePaymentRequestSchema.parse(request.body);

      const cacheKey = `payment:${payload.customer_id}:${payload.amount}:${payload.currency}`;
      const cached = await cacheGet(cacheKey);

      if (cached) {
        logger.info({ type: 'CACHE_HIT', cacheKey });
        return JSON.parse(cached);
      }

      let adapter;

      if (payload.provider === 'stripe') {
        adapter = new StripeAdapter();
      } else if (payload.provider === 'paypal') {
        adapter = new PayPalAdapter();
      } else {
        throw new PaymentError('INVALID_PROVIDER', 'Invalid payment provider', 400);
      }

      const response = await adapter.createPayment(payload);

      const { error: supabaseError } = await supabase.from('payments').insert({
        provider_transaction_id: response.provider_transaction_id,
        provider: payload.provider,
        amount: payload.amount,
        currency: payload.currency,
        status: response.status,
        customer_id: payload.customer_id,
        metadata: response.metadata || {},
        created_at: response.created_at,
      });

      if (supabaseError) {
        logger.error({ error: supabaseError }, 'Failed to persist payment metadata');
      }

      await cacheSet(cacheKey, JSON.stringify(response), 300);

      reply.status(201).send(response);
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      throw error;
    }
  });

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/payments/:id/refund',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const payload = RefundPaymentRequestSchema.parse(request.body);

        const { data: payment, error: fetchError } = await supabase
          .from('payments')
          .select('*')
          .eq('provider_transaction_id', id)
          .single();

        const paymentRecord = payment as Record<string, unknown> | null;

        if (fetchError || !paymentRecord) {
          throw new PaymentError('PAYMENT_NOT_FOUND', 'Payment not found', 404);
        }

        let adapter;

        if (paymentRecord.provider === 'stripe') {
          adapter = new StripeAdapter();
        } else if (paymentRecord.provider === 'paypal') {
          adapter = new PayPalAdapter();
        } else {
          throw new PaymentError('INVALID_PROVIDER', 'Invalid payment provider', 400);
        }

        const response = await adapter.refundPayment(
          id,
          payload.amount,
          payload.reason as string | undefined
        );

        const { error: updateError } = await supabase
          .from('payments')
          .update({
            status: 'refunded',
            refund_id: response.refund_id,
            refund_status: response.status,
            refund_amount: response.amount,
          })
          .eq('provider_transaction_id', id);

        if (updateError) {
          logger.error({ error: updateError }, 'Failed to update payment refund metadata');
        }

        reply.send(response);
      } catch (error) {
        if (error instanceof PaymentError) {
          throw error;
        }
        throw error;
      }
    }
  );
};
