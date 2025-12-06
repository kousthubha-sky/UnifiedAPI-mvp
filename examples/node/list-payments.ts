/**
 * List Payments Example
 *
 * Demonstrates listing and filtering payments.
 *
 * Run with: npx tsx examples/node/list-payments.ts
 */

import { UnifiedAPIClient, PaymentHubError } from '../../sdk/src/index.js';

const API_KEY = process.env.PAYMENTHUB_API_KEY || 'sk_test_example';
const API_URL = process.env.PAYMENTHUB_API_URL || 'http://localhost:3000';

async function main() {
  console.log('📋 PaymentHub SDK - List Payments Example\n');

  const client = new UnifiedAPIClient({
    apiKey: API_KEY,
    baseUrl: API_URL,
  });

  // Example 1: Basic listing with pagination
  console.log('Example 1: Basic Listing with Pagination');
  console.log('─'.repeat(50));

  try {
    // First page
    const page1 = await client.payments.list({
      limit: 5,
      offset: 0,
    });

    console.log(`Total payments: ${page1.total}`);
    console.log(`Showing page 1 (${page1.payments.length} items):`);

    page1.payments.forEach((payment, i) => {
      const amount = `$${(payment.amount / 100).toFixed(2)} ${payment.currency}`;
      console.log(`  ${i + 1}. ${payment.id}`);
      console.log(`     Amount: ${amount} | Status: ${payment.status} | Provider: ${payment.provider}`);
    });

    // Second page (if available)
    if (page1.total > 5) {
      const page2 = await client.payments.list({
        limit: 5,
        offset: 5,
      });
      console.log(`\nPage 2 (${page2.payments.length} items):`);
      page2.payments.forEach((payment, i) => {
        console.log(`  ${i + 6}. ${payment.id} - ${payment.status}`);
      });
    }
    console.log();
  } catch (error) {
    handleError('Basic listing', error);
  }

  // Example 2: Filter by provider
  console.log('Example 2: Filter by Provider');
  console.log('─'.repeat(50));

  try {
    const stripePayments = await client.payments.list({
      provider: 'stripe',
      limit: 10,
    });

    console.log(`Stripe payments: ${stripePayments.total}`);
    stripePayments.payments.slice(0, 3).forEach((p) => {
      console.log(`  - ${p.id}: $${(p.amount / 100).toFixed(2)} (${p.status})`);
    });

    const paypalPayments = await client.payments.list({
      provider: 'paypal',
      limit: 10,
    });

    console.log(`\nPayPal payments: ${paypalPayments.total}`);
    paypalPayments.payments.slice(0, 3).forEach((p) => {
      console.log(`  - ${p.id}: $${(p.amount / 100).toFixed(2)} (${p.status})`);
    });
    console.log();
  } catch (error) {
    handleError('Filter by provider', error);
  }

  // Example 3: Filter by status
  console.log('Example 3: Filter by Status');
  console.log('─'.repeat(50));

  const statuses = ['completed', 'pending', 'failed', 'refunded'] as const;

  for (const status of statuses) {
    try {
      const result = await client.payments.list({
        status,
        limit: 5,
      });
      console.log(`${status.charAt(0).toUpperCase() + status.slice(1)}: ${result.total} payment(s)`);
    } catch (error) {
      handleError(`Status filter (${status})`, error);
    }
  }
  console.log();

  // Example 4: Filter by customer
  console.log('Example 4: Filter by Customer');
  console.log('─'.repeat(50));

  try {
    // Create a few payments for a specific customer
    const customerId = `cust_list_example_${Date.now()}`;

    for (let i = 1; i <= 3; i++) {
      await client.payments.create({
        amount: i * 1000,
        currency: 'USD',
        provider: 'stripe',
        customer_id: customerId,
        payment_method: 'pm_card_visa',
      });
    }

    // Now list payments for this customer
    const customerPayments = await client.payments.list({
      customer_id: customerId,
      limit: 10,
    });

    console.log(`Payments for customer ${customerId}:`);
    console.log(`Found ${customerPayments.total} payment(s)`);
    customerPayments.payments.forEach((p) => {
      console.log(`  - ${p.id}: $${(p.amount / 100).toFixed(2)}`);
    });
    console.log();
  } catch (error) {
    handleError('Customer filter', error);
  }

  // Example 5: Filter by date range
  console.log('Example 5: Filter by Date Range');
  console.log('─'.repeat(50));

  try {
    // Last 30 days
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const recentPayments = await client.payments.list({
      start_date: startDate,
      end_date: endDate,
      limit: 10,
    });

    console.log(`Payments from ${startDate} to ${endDate}:`);
    console.log(`Found ${recentPayments.total} payment(s)`);

    // Group by date
    const byDate = new Map<string, number>();
    recentPayments.payments.forEach((p) => {
      const date = p.created_at.split('T')[0];
      byDate.set(date, (byDate.get(date) || 0) + 1);
    });

    console.log('\nPayments by date:');
    Array.from(byDate.entries())
      .sort()
      .forEach(([date, count]) => {
        console.log(`  ${date}: ${count} payment(s)`);
      });
    console.log();
  } catch (error) {
    handleError('Date range filter', error);
  }

  // Example 6: Combined filters
  console.log('Example 6: Combined Filters');
  console.log('─'.repeat(50));

  try {
    const filtered = await client.payments.list({
      provider: 'stripe',
      status: 'completed',
      limit: 20,
      offset: 0,
    });

    console.log(`Completed Stripe payments: ${filtered.total}`);

    // Calculate total revenue
    const totalRevenue = filtered.payments.reduce((sum, p) => sum + p.amount, 0);
    console.log(`Total revenue (this page): $${(totalRevenue / 100).toFixed(2)}`);

    // Group by currency
    const byCurrency = new Map<string, number>();
    filtered.payments.forEach((p) => {
      byCurrency.set(p.currency, (byCurrency.get(p.currency) || 0) + p.amount);
    });

    console.log('\nRevenue by currency:');
    byCurrency.forEach((amount, currency) => {
      console.log(`  ${currency}: ${(amount / 100).toFixed(2)}`);
    });
    console.log();
  } catch (error) {
    handleError('Combined filters', error);
  }

  // Example 7: Pagination helper
  console.log('Example 7: Fetch All with Pagination');
  console.log('─'.repeat(50));

  try {
    const allPayments = await fetchAllPayments(client, { limit: 10 });
    console.log(`Fetched all ${allPayments.length} payment(s) using pagination`);

    // Calculate stats
    if (allPayments.length > 0) {
      const stats = {
        total: allPayments.length,
        completed: allPayments.filter((p) => p.status === 'completed').length,
        pending: allPayments.filter((p) => p.status === 'pending').length,
        failed: allPayments.filter((p) => p.status === 'failed').length,
        refunded: allPayments.filter((p) => p.status === 'refunded').length,
        totalAmount: allPayments.reduce((sum, p) => sum + p.amount, 0),
      };

      console.log('\nPayment statistics:');
      console.log(`  Total: ${stats.total}`);
      console.log(`  Completed: ${stats.completed}`);
      console.log(`  Pending: ${stats.pending}`);
      console.log(`  Failed: ${stats.failed}`);
      console.log(`  Refunded: ${stats.refunded}`);
      console.log(`  Total Amount: $${(stats.totalAmount / 100).toFixed(2)}`);
    }
  } catch (error) {
    handleError('Fetch all', error);
  }

  console.log('\n🎉 List payments examples completed!');
}

/**
 * Helper function to fetch all payments using pagination
 */
async function fetchAllPayments(
  client: UnifiedAPIClient,
  options: { limit?: number; provider?: 'stripe' | 'paypal'; status?: string } = {}
) {
  const pageSize = options.limit || 100;
  const allPayments: Awaited<ReturnType<typeof client.payments.list>>['payments'] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await client.payments.list({
      ...options,
      limit: pageSize,
      offset,
    });

    allPayments.push(...result.payments);
    offset += result.payments.length;
    hasMore = offset < result.total;

    // Safety limit to prevent infinite loops
    if (allPayments.length >= 1000) {
      console.log('  (Stopped at 1000 payments for safety)');
      break;
    }
  }

  return allPayments;
}

function handleError(context: string, error: unknown) {
  if (error instanceof PaymentHubError) {
    console.log(`❌ ${context} failed: ${error.message} (${error.code})`);
  } else {
    console.log(`❌ ${context} error:`, error);
  }
  console.log();
}

main();
