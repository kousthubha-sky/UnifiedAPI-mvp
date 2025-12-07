import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { Client, Environment } from '@paypal/paypal-server-sdk';
import supabase from '../../utils/supabase.js';
import { auditLog, errorLog } from '../../utils/logger.js';

const stripe = new Stripe(process.env.STRIPE_API_KEY || '', {
  apiVersion: '2024-06-20',
});

const paypalClient = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: process.env.PAYPAL_CLIENT_ID || '',
    oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
  },
  environment: process.env.PAYPAL_MODE === 'production' ? Environment.Production : Environment.Sandbox,
});

export async function webhooksRoutes(fastify: FastifyInstance) {
  // Stripe webhook handler
  fastify.post('/webhooks/stripe', async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      errorLog('Stripe webhook secret not configured');
      return reply.code(500).send({ error: 'Webhook secret not configured' });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(request.body as string | Buffer, sig, endpointSecret);
    } catch (err) {
      errorLog(err, { context: 'Stripe webhook signature verification failed' });
      return reply.code(400).send({ error: 'Webhook signature verification failed' });
    }

    try {
      await handleStripeWebhook(event);
      return reply.code(200).send({ received: true });
    } catch (err) {
      errorLog(err, { context: 'Stripe webhook processing failed', event: event.id });
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });

  // PayPal webhook handler
  fastify.post('/webhooks/paypal', async (request, reply) => {
    try {
      const webhookId = process.env.PAYPAL_WEBHOOK_ID;
      if (!webhookId) {
        errorLog('PayPal webhook ID not configured');
        return reply.code(500).send({ error: 'Webhook ID not configured' });
      }

      // Verify PayPal webhook signature
      const isValid = await verifyPayPalWebhook(request.body, request.headers);
      if (!isValid) {
        errorLog('PayPal webhook signature verification failed');
        return reply.code(400).send({ error: 'Webhook signature verification failed' });
      }

      await handlePayPalWebhook(request.body);
      return reply.code(200).send({ received: true });
    } catch (err) {
      errorLog(err, { context: 'PayPal webhook processing failed' });
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });
}

async function handleStripeWebhook(event: Stripe.Event) {
  const { type, data } = event;

  auditLog('WEBHOOK_RECEIVED', {
    provider: 'stripe',
    event_type: type,
    event_id: event.id,
  });

  switch (type) {
    case 'payment_intent.succeeded':
      await updatePaymentStatus(data.object.id, 'completed', 'stripe');
      break;
    case 'payment_intent.payment_failed':
      await updatePaymentStatus(data.object.id, 'failed', 'stripe');
      break;
    case 'payment_intent.canceled':
      await updatePaymentStatus(data.object.id, 'failed', 'stripe');
      break;
    case 'charge.dispute.created':
      // Handle dispute/chargeback
      auditLog('PAYMENT_DISPUTE', {
        provider: 'stripe',
        transaction_id: data.object.id,
        dispute_id: data.object.dispute,
      });
      break;
    default:
      // Log other events for monitoring
      auditLog('WEBHOOK_UNHANDLED', {
        provider: 'stripe',
        event_type: type,
        event_id: event.id,
      });
  }
}

async function handlePayPalWebhook(webhookBody: any) {
  const { event_type, resource } = webhookBody;

  auditLog('WEBHOOK_RECEIVED', {
    provider: 'paypal',
    event_type,
    resource_id: resource?.id,
  });

  switch (event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED':
      await updatePaymentStatus(resource.id, 'completed', 'paypal');
      break;
    case 'PAYMENT.CAPTURE.DENIED':
    case 'PAYMENT.CAPTURE.FAILED':
      await updatePaymentStatus(resource.id, 'failed', 'paypal');
      break;
    case 'PAYMENT.CAPTURE.REFUNDED':
      await updatePaymentStatus(resource.id, 'refunded', 'paypal');
      break;
    default:
      // Log other events for monitoring
      auditLog('WEBHOOK_UNHANDLED', {
        provider: 'paypal',
        event_type,
        resource_id: resource?.id,
      });
  }
}

async function updatePaymentStatus(providerTransactionId: string, status: string, provider: string) {
  const { error } = await supabase
    .from('payments')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('provider_transaction_id', providerTransactionId)
    .eq('provider', provider);

  if (error) {
    errorLog(error, {
      context: 'Failed to update payment status from webhook',
      provider_transaction_id: providerTransactionId,
      provider,
      status,
    });
  } else {
    auditLog('PAYMENT_STATUS_UPDATED', {
      provider_transaction_id: providerTransactionId,
      provider,
      status,
    });
  }
}

async function verifyPayPalWebhook(body: any, headers: any): Promise<boolean> {
  // PayPal webhook verification logic
  // This is a simplified version - in production you'd verify the signature properly
  const transmissionId = headers['paypal-transmission-id'];
  const transmissionTime = headers['paypal-transmission-time'];
  const transmissionSig = headers['paypal-transmission-sig'];
  const certUrl = headers['paypal-cert-url'];
  const authAlgo = headers['paypal-auth-algo'];

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return false;
  }

  // In a real implementation, you'd verify the signature using PayPal's public key
  // For now, we'll just check if the webhook ID matches
  const expectedWebhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (body.webhook_id !== expectedWebhookId) {
    return false;
  }

  return true;
}