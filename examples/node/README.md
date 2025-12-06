# PaymentHub SDK Examples

This directory contains example scripts demonstrating how to use the PaymentHub SDK.

## Prerequisites

1. **Install SDK dependencies:**
   ```bash
   cd sdk
   npm install
   npm run build
   ```

2. **Start the backend server:**
   ```bash
   cd backend
   npm run dev
   ```

3. **Set environment variables (optional):**
   ```bash
   export PAYMENTHUB_API_KEY=sk_your_api_key
   export PAYMENTHUB_API_URL=http://localhost:3000
   ```

## Running Examples

All examples can be run using `npx tsx`:

```bash
# Basic usage - create, list, and refund a payment
npx tsx examples/node/basic-usage.ts

# Create payments with various options
npx tsx examples/node/create-payment.ts

# Refund payments (full and partial)
npx tsx examples/node/refund-payment.ts

# List and filter payments
npx tsx examples/node/list-payments.ts

# Error handling patterns
npx tsx examples/node/error-handling.ts
```

## Example Overview

### basic-usage.ts
Demonstrates the complete payment lifecycle:
- Initialize the SDK client
- Create a payment
- List recent payments
- Refund a payment

### create-payment.ts
Shows various payment creation scenarios:
- Basic Stripe payment
- PayPal payment
- Payment with metadata
- Payment with idempotency key
- Different currencies

### refund-payment.ts
Demonstrates refund operations:
- Full refund
- Partial refund
- Refund with reason
- Multiple partial refunds
- Error handling for non-existent payments

### list-payments.ts
Shows how to query and filter payments:
- Basic pagination
- Filter by provider
- Filter by status
- Filter by customer
- Filter by date range
- Combined filters
- Fetching all payments with pagination helper

### error-handling.ts
Demonstrates proper error handling:
- Client-side validation errors
- Server-side errors
- Authentication errors
- Network and timeout errors
- Using type guards
- Error serialization for logging
- Retry patterns with rate limiting

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PAYMENTHUB_API_KEY` | API key for authentication | `sk_test_example` |
| `PAYMENTHUB_API_URL` | Base URL of the API | `http://localhost:3000` |

## Tips

1. **Use idempotency keys** for payment creation to safely retry failed requests
2. **Handle errors properly** using the type guards (`isPaymentHubError`, `isRetryableError`)
3. **Implement retry logic** for retryable errors with exponential backoff
4. **Log trace IDs** from errors for debugging
5. **Use pagination** when listing large numbers of payments
