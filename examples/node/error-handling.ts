/**
 * Error Handling Example
 *
 * Demonstrates proper error handling with the SDK.
 *
 * Run with: npx tsx examples/node/error-handling.ts
 */

import {
  UnifiedAPIClient,
  OneRouterError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  PaymentNotFoundError,
  NetworkError,
  TimeoutError,
  isOneRouterError,
  isRetryableError,
} from '../../sdk/src/index.js';

const API_KEY = process.env.OneRouter_API_KEY || 'sk_test_example';
const API_URL = process.env.OneRouter_API_URL || 'http://localhost:3000';

async function main() {
  console.log('🛡️  OneRouter SDK - Error Handling Example\n');

  const client = new UnifiedAPIClient({
    apiKey: API_KEY,
    baseUrl: API_URL,
    maxRetries: 0, // Disable retries to see errors immediately
  });

  // Example 1: Validation errors (client-side)
  console.log('Example 1: Client-side Validation Errors');
  console.log('─'.repeat(50));

  try {
    await client.payments.create({
      amount: -100, // Invalid: negative amount
      currency: 'USD',
      provider: 'stripe',
      customer_id: 'cust_123',
      payment_method: 'pm_card_visa',
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log('✅ Caught ValidationError');
      console.log(`   Message: ${error.message}`);
      console.log(`   Code: ${error.code}`);
      if (error.details?.errors) {
        console.log('   Validation errors:', error.details.errors);
      }
    }
  }

  try {
    await client.payments.create({
      amount: 1000,
      currency: 'INVALID', // Invalid: 7 characters instead of 3
      provider: 'stripe',
      customer_id: 'cust_123',
      payment_method: 'pm_card_visa',
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log('\n✅ Caught ValidationError for invalid currency');
      console.log(`   Message: ${error.message}`);
    }
  }

  try {
    await client.payments.refund(''); // Invalid: empty payment ID
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log('\n✅ Caught ValidationError for empty payment ID');
      console.log(`   Message: ${error.message}`);
    }
  }
  console.log();

  // Example 2: Server-side errors
  console.log('Example 2: Server-side Errors');
  console.log('─'.repeat(50));

  try {
    await client.payments.refund('non_existent_payment_id');
  } catch (error) {
    if (error instanceof PaymentNotFoundError) {
      console.log('✅ Caught PaymentNotFoundError');
      console.log(`   Message: ${error.message}`);
      console.log(`   Code: ${error.code}`);
    } else if (error instanceof OneRouterError) {
      console.log('✅ Caught OneRouterError');
      console.log(`   Message: ${error.message}`);
      console.log(`   Code: ${error.code}`);
    }
  }
  console.log();

  // Example 3: Authentication errors
  console.log('Example 3: Authentication Errors');
  console.log('─'.repeat(50));

  const badClient = new UnifiedAPIClient({
    apiKey: 'invalid_api_key',
    baseUrl: API_URL,
    maxRetries: 0,
  });

  try {
    await badClient.payments.list();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.log('✅ Caught AuthenticationError');
      console.log(`   Message: ${error.message}`);
      console.log(`   Status Code: ${error.statusCode}`);
    } else if (error instanceof OneRouterError) {
      console.log('✅ Caught OneRouterError (auth check may be disabled)');
      console.log(`   Code: ${error.code}`);
    }
  }
  console.log();

  // Example 4: Network and timeout errors
  console.log('Example 4: Network and Timeout Errors');
  console.log('─'.repeat(50));

  // Network error (unreachable host)
  const unreachableClient = new UnifiedAPIClient({
    apiKey: API_KEY,
    baseUrl: 'http://10.255.255.1:3000', // Non-routable IP
    timeout: 2000, // Short timeout
    maxRetries: 0,
  });

  try {
    await unreachableClient.payments.list();
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.log('✅ Caught TimeoutError');
      console.log(`   Message: ${error.message}`);
    } else if (error instanceof NetworkError) {
      console.log('✅ Caught NetworkError');
      console.log(`   Message: ${error.message}`);
    } else if (error instanceof OneRouterError) {
      console.log('✅ Caught OneRouterError');
      console.log(`   Code: ${error.code}`);
    }
  }
  console.log();

  // Example 5: Using type guards
  console.log('Example 5: Using Type Guards');
  console.log('─'.repeat(50));

  async function safePaymentCreate() {
    try {
      return await client.payments.create({
        amount: 1000,
        currency: 'USD',
        provider: 'stripe',
        customer_id: 'cust_test',
        payment_method: 'pm_card_visa',
      });
    } catch (error) {
      if (isOneRouterError(error)) {
        console.log('✅ isOneRouterError returned true');
        console.log(`   Error type: ${error.name}`);
        console.log(`   Code: ${error.code}`);

        if (isRetryableError(error)) {
          console.log('   This error is retryable');
        } else {
          console.log('   This error is NOT retryable');
        }

        // Handle specific error types
        switch (error.code) {
          case 'VALIDATION_ERROR':
            console.log('   → Fix the request and try again');
            break;
          case 'RATE_LIMIT_EXCEEDED':
            console.log('   → Wait and retry');
            break;
          case 'UNAUTHORIZED':
            console.log('   → Check API key');
            break;
          default:
            console.log('   → Investigate error');
        }
      } else {
        console.log('Unknown error:', error);
      }
      return null;
    }
  }

  await safePaymentCreate();
  console.log();

  // Example 6: Error serialization
  console.log('Example 6: Error Serialization (for logging)');
  console.log('─'.repeat(50));

  try {
    throw new OneRouterError(
      'Payment declined',
      'PAYMENT_FAILED',
      400,
      'trace_12345',
      { decline_code: 'insufficient_funds' }
    );
  } catch (error) {
    if (error instanceof OneRouterError) {
      const serialized = error.toJSON();
      console.log('✅ Serialized error for logging:');
      console.log(JSON.stringify(serialized, null, 2));
    }
  }
  console.log();

  // Example 7: Retry pattern with rate limiting
  console.log('Example 7: Retry Pattern');
  console.log('─'.repeat(50));

  async function createPaymentWithRetry(
    request: Parameters<typeof client.payments.create>[0],
    maxAttempts = 3
  ) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`   Attempt ${attempt}/${maxAttempts}...`);
        return await client.payments.create(request);
      } catch (error) {
        if (isOneRouterError(error)) {
          if (error instanceof RateLimitError && error.retryAfter) {
            console.log(`   Rate limited. Waiting ${error.retryAfter}s...`);
            await sleep(error.retryAfter * 1000);
            continue;
          }

          if (isRetryableError(error) && attempt < maxAttempts) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            console.log(`   Retryable error. Waiting ${delay}ms...`);
            await sleep(delay);
            continue;
          }
        }

        // Non-retryable error or max attempts reached
        throw error;
      }
    }
  }

  try {
    await createPaymentWithRetry({
      amount: 1000,
      currency: 'USD',
      provider: 'stripe',
      customer_id: 'cust_retry_test',
      payment_method: 'pm_card_visa',
    });
    console.log('✅ Payment created successfully');
  } catch (error) {
    if (isOneRouterError(error)) {
      console.log(`❌ Failed after retries: ${error.message}`);
    }
  }

  console.log('\n🎉 Error handling examples completed!');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main();
