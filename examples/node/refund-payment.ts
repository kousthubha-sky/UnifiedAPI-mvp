/**
 * Refund Payment Example
 *
 * Demonstrates refunding payments (full and partial).
 *
 * Run with: npx tsx examples/node/refund-payment.ts
 */

import { UnifiedAPIClient, OneRouterError, PaymentNotFoundError } from '../../sdk/src/index.js';

const API_KEY = process.env.OneRouter_API_KEY || 'sk_test_example';
const API_URL = process.env.OneRouter_API_URL || 'http://localhost:3000';

async function main() {
  console.log('💸 OneRouter SDK - Refund Payment Example\n');

  const client = new UnifiedAPIClient({
    apiKey: API_KEY,
    baseUrl: API_URL,
  });

  // Example 1: Full refund
  console.log('Example 1: Full Refund');
  console.log('─'.repeat(40));

  try {
    // First, create a payment to refund
    console.log('Creating a payment to refund...');
    const payment = await client.payments.create({
      amount: 5000, // $50.00
      currency: 'USD',
      provider: 'stripe',
      customer_id: 'cust_refund_full',
      payment_method: 'pm_card_visa',
      description: 'Payment to be fully refunded',
    });
    console.log(`✅ Created payment: ${payment.id} ($${(payment.amount / 100).toFixed(2)})`);

    // Now refund it
    console.log('Processing full refund...');
    const refund = await client.payments.refund(payment.id);

    console.log('✅ Full refund processed:');
    console.log(`   Refund ID: ${refund.refund_id}`);
    console.log(`   Amount: $${(refund.amount / 100).toFixed(2)}`);
    console.log(`   Status: ${refund.status}`);
    console.log();
  } catch (error) {
    handleError('Full refund', error);
  }

  // Example 2: Partial refund
  console.log('Example 2: Partial Refund');
  console.log('─'.repeat(40));

  try {
    // Create a payment
    console.log('Creating a payment for partial refund...');
    const payment = await client.payments.create({
      amount: 10000, // $100.00
      currency: 'USD',
      provider: 'stripe',
      customer_id: 'cust_refund_partial',
      payment_method: 'pm_card_visa',
      description: 'Payment for partial refund',
    });
    console.log(`✅ Created payment: ${payment.id} ($${(payment.amount / 100).toFixed(2)})`);

    // Partial refund (50%)
    console.log('Processing partial refund (50%)...');
    const refund = await client.payments.refund(payment.id, {
      amount: 5000, // $50.00
      reason: 'Partial order return',
    });

    console.log('✅ Partial refund processed:');
    console.log(`   Refund ID: ${refund.refund_id}`);
    console.log(`   Amount: $${(refund.amount / 100).toFixed(2)} (50% of original)`);
    console.log(`   Status: ${refund.status}`);
    console.log();
  } catch (error) {
    handleError('Partial refund', error);
  }

  // Example 3: Refund with reason
  console.log('Example 3: Refund with Reason');
  console.log('─'.repeat(40));

  try {
    const payment = await client.payments.create({
      amount: 2500,
      currency: 'USD',
      provider: 'stripe',
      customer_id: 'cust_refund_reason',
      payment_method: 'pm_card_visa',
    });
    console.log(`✅ Created payment: ${payment.id}`);

    const refund = await client.payments.refund(payment.id, {
      reason: 'Customer requested refund - product not as described',
    });

    console.log('✅ Refund with reason processed:');
    console.log(`   Refund ID: ${refund.refund_id}`);
    console.log(`   Reason was recorded in request`);
    console.log();
  } catch (error) {
    handleError('Refund with reason', error);
  }

  // Example 4: Multiple partial refunds
  console.log('Example 4: Multiple Partial Refunds');
  console.log('─'.repeat(40));

  try {
    const payment = await client.payments.create({
      amount: 10000, // $100.00
      currency: 'USD',
      provider: 'stripe',
      customer_id: 'cust_refund_multi',
      payment_method: 'pm_card_visa',
    });
    console.log(`✅ Created payment: ${payment.id} ($100.00)`);

    // First partial refund
    const refund1 = await client.payments.refund(payment.id, {
      amount: 3000,
      reason: 'First item return',
    });
    console.log(`✅ First partial refund: $${(refund1.amount / 100).toFixed(2)}`);

    // Second partial refund
    const refund2 = await client.payments.refund(payment.id, {
      amount: 2000,
      reason: 'Second item return',
    });
    console.log(`✅ Second partial refund: $${(refund2.amount / 100).toFixed(2)}`);

    console.log(`   Total refunded: $50.00 of $100.00`);
    console.log();
  } catch (error) {
    handleError('Multiple partial refunds', error);
  }

  // Example 5: Error handling - non-existent payment
  console.log('Example 5: Error Handling');
  console.log('─'.repeat(40));

  try {
    console.log('Attempting to refund non-existent payment...');
    await client.payments.refund('non_existent_payment_id_12345');
    console.log('⚠️  Expected error was not thrown');
  } catch (error) {
    if (error instanceof PaymentNotFoundError) {
      console.log('✅ Correctly caught PaymentNotFoundError');
      console.log(`   Message: ${error.message}`);
    } else if (error instanceof OneRouterError) {
      console.log('✅ Caught OneRouterError as expected');
      console.log(`   Code: ${error.code}`);
      console.log(`   Message: ${error.message}`);
    } else {
      console.log('⚠️  Unexpected error type:', error);
    }
  }

  console.log('\n🎉 Refund examples completed!');
}

function handleError(context: string, error: unknown) {
  if (error instanceof OneRouterError) {
    console.log(`❌ ${context} failed:`);
    console.log(`   Code: ${error.code}`);
    console.log(`   Message: ${error.message}`);
    if (error.traceId) {
      console.log(`   Trace ID: ${error.traceId}`);
    }
  } else {
    console.log(`❌ ${context} error:`, error);
  }
  console.log();
}

main();
