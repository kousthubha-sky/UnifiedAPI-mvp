/**
 * Create Payment Example
 *
 * Demonstrates creating payments with various options.
 *
 * Run with: npx tsx examples/node/create-payment.ts
 */

import { UnifiedAPIClient, ValidationError, PaymentHubError } from '../../sdk/src/index.js';

const API_KEY = process.env.PAYMENTHUB_API_KEY || 'sk_test_example';
const API_URL = process.env.PAYMENTHUB_API_URL || 'http://localhost:3000';

async function main() {
  console.log('💳 PaymentHub SDK - Create Payment Example\n');

  const client = new UnifiedAPIClient({
    apiKey: API_KEY,
    baseUrl: API_URL,
  });

  // Example 1: Basic Stripe payment
  console.log('Example 1: Basic Stripe payment');
  console.log('─'.repeat(40));

  try {
    const stripePayment = await client.payments.create({
      amount: 1000, // $10.00
      currency: 'USD',
      provider: 'stripe',
      customer_id: 'cust_stripe_001',
      payment_method: 'pm_card_visa',
    });

    console.log('✅ Stripe payment created:', stripePayment.id);
    console.log(`   Amount: $${(stripePayment.amount / 100).toFixed(2)}`);
    console.log();
  } catch (error) {
    handleError('Stripe payment', error);
  }

  // Example 2: PayPal payment
  console.log('Example 2: PayPal payment');
  console.log('─'.repeat(40));

  try {
    const paypalPayment = await client.payments.create({
      amount: 2500, // $25.00
      currency: 'USD',
      provider: 'paypal',
      customer_id: 'cust_paypal_001',
      payment_method: 'paypal_account',
    });

    console.log('✅ PayPal payment created:', paypalPayment.id);
    console.log(`   Amount: $${(paypalPayment.amount / 100).toFixed(2)}`);
    console.log();
  } catch (error) {
    handleError('PayPal payment', error);
  }

  // Example 3: Payment with metadata
  console.log('Example 3: Payment with metadata');
  console.log('─'.repeat(40));

  try {
    const metadataPayment = await client.payments.create({
      amount: 5000, // $50.00
      currency: 'USD',
      provider: 'stripe',
      customer_id: 'cust_metadata_001',
      payment_method: 'pm_card_mastercard',
      description: 'Subscription payment - Pro Plan',
      metadata: {
        subscription_id: 'sub_12345',
        plan: 'pro',
        billing_cycle: 'monthly',
        user_email: 'user@example.com',
      },
    });

    console.log('✅ Payment with metadata created:', metadataPayment.id);
    console.log('   Metadata included in request');
    console.log();
  } catch (error) {
    handleError('Metadata payment', error);
  }

  // Example 4: Payment with idempotency key
  console.log('Example 4: Payment with idempotency key');
  console.log('─'.repeat(40));

  const idempotencyKey = `order_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  console.log(`   Using idempotency key: ${idempotencyKey}`);

  try {
    // First request
    const payment1 = await client.payments.create(
      {
        amount: 3000,
        currency: 'USD',
        provider: 'stripe',
        customer_id: 'cust_idem_001',
        payment_method: 'pm_card_visa',
      },
      { idempotencyKey }
    );

    console.log('✅ First request:', payment1.id);

    // Second request with same key (should be safe)
    const payment2 = await client.payments.create(
      {
        amount: 3000,
        currency: 'USD',
        provider: 'stripe',
        customer_id: 'cust_idem_001',
        payment_method: 'pm_card_visa',
      },
      { idempotencyKey }
    );

    console.log('✅ Second request (same key):', payment2.id);
    console.log(`   Same payment ID: ${payment1.id === payment2.id}`);
    console.log();
  } catch (error) {
    handleError('Idempotent payment', error);
  }

  // Example 5: Different currencies
  console.log('Example 5: Different currencies');
  console.log('─'.repeat(40));

  const currencies = [
    { currency: 'EUR', amount: 1000 },
    { currency: 'GBP', amount: 800 },
    { currency: 'JPY', amount: 1500 },
  ];

  for (const { currency, amount } of currencies) {
    try {
      const payment = await client.payments.create({
        amount,
        currency,
        provider: 'stripe',
        customer_id: `cust_${currency.toLowerCase()}_001`,
        payment_method: 'pm_card_visa',
      });

      const displayAmount = currency === 'JPY' 
        ? `¥${amount}` 
        : `${amount / 100} ${currency}`;
      console.log(`✅ ${currency} payment: ${payment.id} (${displayAmount})`);
    } catch (error) {
      handleError(`${currency} payment`, error);
    }
  }

  console.log('\n🎉 Create payment examples completed!');
}

function handleError(context: string, error: unknown) {
  if (error instanceof ValidationError) {
    console.log(`⚠️  ${context} validation error: ${error.message}`);
    if (error.details?.errors) {
      console.log('   Errors:', error.details.errors);
    }
  } else if (error instanceof PaymentHubError) {
    console.log(`❌ ${context} failed: ${error.message} (${error.code})`);
  } else {
    console.log(`❌ ${context} error:`, error);
  }
  console.log();
}

main();
