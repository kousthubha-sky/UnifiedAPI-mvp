/**
 * Basic Usage Example
 *
 * Demonstrates the basic usage of the PaymentHub SDK.
 *
 * Run with: npx tsx examples/node/basic-usage.ts
 *
 * Prerequisites:
 * 1. Start the backend server: cd backend && npm run dev
 * 2. Set environment variables or use defaults:
 *    - PAYMENTHUB_API_KEY (default: sk_test_example)
 *    - PAYMENTHUB_API_URL (default: http://localhost:3000)
 */

import { UnifiedAPIClient, PaymentHubError, isRetryableError } from '../../sdk/src/index.js';

// Configuration from environment
const API_KEY = process.env.PAYMENTHUB_API_KEY || 'sk_test_example';
const API_URL = process.env.PAYMENTHUB_API_URL || 'http://localhost:3000';

async function main() {
  console.log('🚀 PaymentHub SDK - Basic Usage Example\n');

  // Initialize the client
  const client = new UnifiedAPIClient({
    apiKey: API_KEY,
    baseUrl: API_URL,
    timeout: 30000,
    maxRetries: 3,
  });

  console.log(`📡 Connected to: ${API_URL}\n`);

  try {
    // 1. Create a payment
    console.log('1️⃣  Creating a payment...');
    const payment = await client.payments.create({
      amount: 2500, // $25.00 in cents
      currency: 'USD',
      provider: 'stripe',
      customer_id: 'cust_example_123',
      payment_method: 'pm_card_visa',
      description: 'Example payment from SDK',
      metadata: {
        order_id: 'order_456',
        source: 'sdk_example',
      },
    });

    console.log('✅ Payment created:');
    console.log(`   ID: ${payment.id}`);
    console.log(`   Provider TX: ${payment.provider_transaction_id}`);
    console.log(`   Amount: $${(payment.amount / 100).toFixed(2)} ${payment.currency}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Trace ID: ${payment.trace_id}`);
    console.log();

    // 2. List recent payments
    console.log('2️⃣  Listing recent payments...');
    const paymentsResult = await client.payments.list({
      limit: 5,
      offset: 0,
    });

    console.log(`✅ Found ${paymentsResult.total} total payments`);
    console.log(`   Showing ${paymentsResult.payments.length} payments:`);
    paymentsResult.payments.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.id} - $${(p.amount / 100).toFixed(2)} ${p.currency} (${p.status})`);
    });
    console.log();

    // 3. Refund the payment
    console.log('3️⃣  Refunding the payment...');
    const refund = await client.payments.refund(payment.id, {
      reason: 'Example refund from SDK',
    });

    console.log('✅ Payment refunded:');
    console.log(`   Refund ID: ${refund.refund_id}`);
    console.log(`   Original TX: ${refund.original_transaction_id}`);
    console.log(`   Amount: $${(refund.amount / 100).toFixed(2)}`);
    console.log(`   Status: ${refund.status}`);
    console.log();

    console.log('🎉 Example completed successfully!');

  } catch (error) {
    console.error('\n❌ Error occurred:');

    if (error instanceof PaymentHubError) {
      console.error(`   Code: ${error.code}`);
      console.error(`   Message: ${error.message}`);
      console.error(`   Status: ${error.statusCode}`);
      if (error.traceId) {
        console.error(`   Trace ID: ${error.traceId}`);
      }
      if (error.details) {
        console.error(`   Details:`, error.details);
      }
      console.error(`   Retryable: ${isRetryableError(error)}`);
    } else {
      console.error(`   ${error}`);
    }

    process.exit(1);
  }
}

main();
