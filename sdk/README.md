# @OneRouter/sdk

**The Unified Payment SDK** - One API, All Payment Methods, Zero Hassle.

[![npm version](https://badge.fury.io/js/@OneRouter%2Fsdk.svg)](https://badge.fury.io/js/@OneRouter%2Fsdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

> **🚀 Revolutionary Payment Integration**: Unified SDK for payment processing with **BYOK** (bring your own keys) support. No code changes required!

## ✨ What Makes OneRouter Different

Unlike traditional payment SDKs that lock you into one provider, OneRouter gives you the **best of both worlds**:

- **🔑 BYOK (Bring Your Own Keys)**: Full control, multi-provider support, advanced configurations
- **🎯 Unified API**: Single interface for all payment operations

## 🎯 Perfect For

- **SaaS Platforms** - White-label payment processing
- **Marketplaces** - Multi-vendor payment handling
- **E-commerce** - Flexible payment integration
- **Fintech Startups** - Rapid prototyping to production
- **Enterprise Apps** - Complex payment workflows

## ⚡ Quick Start (3 Minutes)

### 1. Install
```bash
npm install @OneRouter/sdk
```

### 2. Initialize
```typescript
import { UnifiedAPIClient } from '@OneRouter/sdk';

const client = new UnifiedAPIClient({
  apiKey: 'sk_your_api_key', // Get from dashboard
});
```

### 3. Accept Payments
```typescript
// Works with Connect OR BYOK automatically! 🎉
const payment = await client.payments.create({
  amount: 10000, // $100.00 in cents
  currency: 'usd',
  description: 'Premium subscription',
  customer_email: 'user@example.com'
});

console.log(`Payment ${payment.status}: ${payment.id}`);
console.log(`Connection type: ${payment.connection_type}`); // "connect" or "api_key"
```

**That's it!** Your app now accepts payments with enterprise-grade reliability.

## 🔑 Authentication Methods

### BYOK (Bring Your Own Keys)
```typescript
// 1. Get your PayPal API credentials
// 2. Store encrypted in OneRouter dashboard
// 3. Ready to accept payments!

const payment = await client.payments.create({
  amount: 5000,
  currency: 'usd',
  description: 'Order #123'
});
// Uses your encrypted API keys automatically
```

**Same code, different auth methods!** 🔄

## 📚 Developer Guide

### Installation

```bash
# npm
npm install @OneRouter/sdk

# yarn
yarn add @OneRouter/sdk

# pnpm
pnpm add @OneRouter/sdk
```

### ESM Import (Recommended)
```typescript
import { UnifiedAPIClient } from '@OneRouter/sdk';
```

### CommonJS
```javascript
const { UnifiedAPIClient } = require('@OneRouter/sdk');
```

### Configuration

```typescript
interface ClientConfig {
  apiKey: string;           // Your OneRouter API key (sk_...)
  baseUrl?: string;         // API URL (auto-detected)
  timeout?: number;         // Request timeout (default: 30s)
  maxRetries?: number;      // Retry attempts (default: 3)
  environment?: 'local' | 'staging' | 'production';
}

const client = new UnifiedAPIClient({
  apiKey: 'sk_live_your_key_here',
  // baseUrl: 'https://api.onerouter.com', // Optional
});
```

## 💳 Payment Operations

### Create Payment

```typescript
const payment = await client.payments.create({
  amount: 25000,           // Amount in cents ($250.00)
  currency: 'usd',         // 'usd', 'eur', 'gbp', etc.
  description: 'Premium Plan', // Optional description
  customer_email: 'user@company.com', // Optional
  customer_name: 'John Doe', // Optional
  metadata: {              // Optional custom data
    user_id: '12345',
    plan: 'premium'
  }
});

// Response
{
  id: 'pay_1234567890',
  amount: 25000,
  currency: 'usd',
  status: 'succeeded',     // 'succeeded', 'pending', 'failed'
  provider: 'paypal',
  connection_type: 'api_key', // 'connect' or 'api_key'
  client_secret: 'pay_xxx_secret_xxx', // For frontend confirmation
  created_at: 1703123456   // Unix timestamp
}
```

### Refund Payment

```typescript
// Full refund
const refund = await client.payments.refund('pay_1234567890');

// Partial refund
const refund = await client.payments.refund('pay_1234567890', {
  amount: 12500, // Refund $125.00
  reason: 'requested_by_customer'
});

// Response
{
  id: 'ref_1234567890',
  payment_id: 'pay_1234567890',
  amount: 12500,
  status: 'succeeded'
}
```

### List Payments

```typescript
const { data, total, has_more } = await client.payments.list({
  limit: 20,              // Max 100
  offset: 0,              // Pagination
  status: 'succeeded'     // Filter by status
});

// Response
{
  data: [/* PaymentRecord[] */],
  total: 150,
  has_more: true
}
```

## 🔧 Advanced Features

### Error Handling

```typescript
import {
  UnifiedAPIError,
  ValidationError,
  PaymentError,
  isOneRouterError
} from '@OneRouter/sdk';

try {
  const payment = await client.payments.create({...});
} catch (error) {
  if (isOneRouterError(error)) {
    console.log(`Error: ${error.message}`);
    console.log(`Code: ${error.code}`);
    console.log(`Status: ${error.statusCode}`);

    // Handle specific errors
    if (error instanceof PaymentError) {
      // Payment processing failed
    }
  }
}
```

### Health Checks

```typescript
// Basic health check
const health = await client.health();
console.log(`Status: ${health.status}`);

// Comprehensive health check
const detailed = await client.healthCheck();
console.log(`API Latency: ${detailed.services.api.latency}ms`);
```

### Testing with Mocks

```typescript
import { UnifiedAPIClient } from '@OneRouter/sdk';

// Create mock client
const { client, mock } = UnifiedAPIClient.withMockTransport({
  apiKey: 'test_key'
});

// Mock responses
mock.onCreatePayment(async (body) => ({
  id: 'pay_test_123',
  amount: body.amount,
  currency: body.currency,
  status: 'succeeded',
  provider: 'paypal',
  connection_type: 'api_key',
  client_secret: 'pay_test_secret_xxx',
  created_at: Math.floor(Date.now() / 1000)
}));

// Test your code
const payment = await client.payments.create({
  amount: 10000,
  currency: 'usd',
  description: 'Test payment'
});

expect(payment.status).toBe('succeeded');
```

## 🎭 Use Cases

### E-commerce Platform
```typescript
// Handle payments for multiple vendors
async function processOrder(order) {
  const payment = await client.payments.create({
    amount: order.total * 100, // Convert to cents
    currency: 'usd',
    description: `Order ${order.id}`,
    customer_email: order.customer.email,
    metadata: {
      order_id: order.id,
      vendor_id: order.vendor.id
    }
  });

  // Update order status
  await updateOrderStatus(order.id, payment.status);

  return payment;
}
```

### SaaS Subscription Billing
```typescript
// Handle recurring payments
async function chargeSubscription(userId, plan) {
  const payment = await client.payments.create({
    amount: plan.price * 100,
    currency: 'usd',
    description: `${plan.name} subscription`,
    customer_email: user.email,
    metadata: {
      user_id: userId,
      plan_id: plan.id,
      billing_cycle: 'monthly'
    }
  });

  // Update subscription status
  await updateSubscription(userId, {
    status: 'active',
    payment_id: payment.id
  });

  return payment;
}
```

### Marketplace Payments
```typescript
// Split payments between platform and sellers
async function processMarketplacePayment(order) {
  // Platform fee: 5%
  const platformFee = Math.round(order.total * 0.05 * 100);
  const sellerAmount = (order.total * 100) - platformFee;

  // Create payment (OneRouter handles splitting automatically)
  const payment = await client.payments.create({
    amount: order.total * 100,
    currency: 'usd',
    description: `Marketplace order ${order.id}`,
    customer_email: order.buyer.email,
    metadata: {
      order_id: order.id,
      seller_id: order.seller.id,
      platform_fee: platformFee,
      seller_amount: sellerAmount
    }
  });

  return payment;
}
```

## ⚠️ Limitations & Considerations

### Current Limitations
- **Single Provider**: Currently supports PayPal only
- **USD Focus**: Optimized for USD transactions
- **No Subscriptions**: Use PayPal's billing for recurring payments
- **No Webhooks**: Webhook forwarding planned for future release

### Best Practices
- **Always handle errors**: Implement proper error handling
- **Use idempotency keys**: For critical payment operations
- **Validate amounts**: Ensure amounts are positive integers
- **Store payment IDs**: Keep track of payment references
- **Test thoroughly**: Use mock transport for testing

### Rate Limits
- **100 requests per minute** per API key
- Automatic retry with exponential backoff
- Rate limit errors include `retryAfter` field

### Security
- API keys are sensitive - store securely
- Use HTTPS in production
- Enable HMAC signing for additional security
- Rotate API keys regularly

## 🔧 Environment Setup

### Local Development
```bash
# Start OneRouter stack
docker-compose up

# SDK auto-detects local environment
const client = new UnifiedAPIClient({
  apiKey: 'sk_test_your_key'
});
// Uses http://localhost:8000 automatically
```

### Production
```typescript
const client = new UnifiedAPIClient({
  apiKey: process.env.ONEROUTER_API_KEY,
  environment: 'production'
});
// Uses https://api.onerouter.com automatically
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Type checking
npm run typecheck
```

## 📊 Monitoring & Debugging

### Request Metrics
```typescript
const metrics = client.getMetrics();
const summary = metrics.getSummary();

console.log(`Total requests: ${summary.total}`);
console.log(`Success rate: ${(summary.successful / summary.total * 100).toFixed(1)}%`);
```

### Debug Mode
```typescript
// Enable detailed logging
const client = new UnifiedAPIClient({
  apiKey: 'sk_xxx',
  // Add logging interceptor
  requestInterceptors: [(req) => {
    console.log(`${req.method} ${req.path}`);
    return req;
  }]
});
```

## 🚀 Migration Guide

### From Payment SDKs
```typescript
// Before (Traditional SDK)
import { PayPal } from 'paypal-sdk';
const paypal = new PayPal({ clientId: '...', clientSecret: '...' });
const payment = await paypal.payments.create({
  amount: 1000,
  currency: 'usd'
});

// After (OneRouter SDK)
import { UnifiedAPIClient } from '@OneRouter/sdk';
const client = new UnifiedAPIClient({ apiKey: 'sk_your_onerouter_key' });
const payment = await client.payments.create({
  amount: 1000,
  currency: 'usd'
});
```

### From Other Payment SDKs
```typescript
// Same pattern for any payment provider
const payment = await client.payments.create({
  amount: amountInCents,
  currency: 'usd',
  description: 'Payment description'
});
// OneRouter handles the rest!
```

## 📞 Support

- **Documentation**: https://docs.onerouter.com
- **API Reference**: https://api.onerouter.com/docs
- **GitHub Issues**: https://github.com/OneRouter/sdk/issues
- **Discord Community**: https://discord.gg/onerouter

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ by the OneRouter team**

*One API, All Payment Methods, Zero Hassle.*

## Installation

```bash
# npm
npm install @OneRouter/sdk

# yarn
yarn add @OneRouter/sdk

# pnpm
pnpm add @OneRouter/sdk

# Install from local path (during development)
npm install ../sdk
```

## Quick Start

### ESM (Recommended)

```typescript
import { UnifiedAPIClient } from '@OneRouter/sdk';

const client = new UnifiedAPIClient({
  apiKey: 'sk_your_api_key',
  baseUrl: 'https://api.OneRouter.com',
});

// Create a payment
const payment = await client.payments.create({
  amount: 1000, // $10.00 in cents
  currency: 'USD',
  provider: 'paypal',
  customer_id: 'cust_123',
  payment_method: 'pm_card_visa',
});

console.log(`Payment created: ${payment.id}`);
```

### CommonJS

```javascript
const { UnifiedAPIClient } = require('@OneRouter/sdk');

const client = new UnifiedAPIClient({
  apiKey: 'sk_your_api_key',
  baseUrl: 'https://api.OneRouter.com',
});

// Use async/await in an async context
async function main() {
  const payment = await client.payments.create({
    amount: 1000,
    currency: 'USD',
    provider: 'paypal',
    customer_id: 'cust_123',
    payment_method: 'pm_card_visa',
  });
}

main();
```

## Configuration

### Client Options

```typescript
interface ClientConfig {
  // Required
  apiKey: string;           // Your API key (sk_...)

  // Optional
  baseUrl?: string;         // API base URL (auto-detected by environment)
  timeout?: number;         // Request timeout in ms (default: 30000)
  maxRetries?: number;      // Max retry attempts (default: 3)
  enableSigning?: boolean;  // Enable HMAC request signing (default: false)
  signingSecret?: string;   // HMAC secret (defaults to apiKey)
  environment?: Environment; // Override auto-detected environment

  // Advanced
  requestInterceptors?: RequestInterceptor[];  // Request interceptors
  responseInterceptors?: ResponseInterceptor[]; // Response interceptors
  errorInterceptors?: ErrorInterceptor[];      // Error interceptors
}
```

### Request Options

```typescript
interface RequestOptions {
  idempotencyKey?: string;  // For safe retries
  timeout?: number;         // Override default timeout
  headers?: Record<string, string>;  // Additional headers
  skipRetry?: boolean;      // Disable retries for this request
  skipCache?: boolean;      // Skip response caching for this request
}
```

## API Reference

### Payments

#### Create Payment

```typescript
const payment = await client.payments.create({
  amount: 2500,              // Amount in smallest currency unit (cents)
  currency: 'USD',           // 3-letter ISO currency code
  provider: 'paypal',        // Payment provider
  customer_id: 'cust_123',   // Customer identifier
  payment_method: 'pm_xxx',  // Payment method ID
  description: 'Order #123', // Optional description
  metadata: {                // Optional metadata
    order_id: '123',
  },
}, {
  idempotencyKey: 'unique-key-123',  // Recommended for production
});
```

#### Refund Payment

```typescript
// Full refund
const refund = await client.payments.refund('pay_123');

// Partial refund
const partialRefund = await client.payments.refund('pay_123', {
  amount: 500,                    // Partial amount
  reason: 'Customer request',    // Optional reason
});
```

#### List Payments

```typescript
const result = await client.payments.list({
  provider: 'paypal',      // Filter by provider
  status: 'completed',     // Filter by status
  customer_id: 'cust_123', // Filter by customer
  start_date: '2024-01-01', // Filter by date range
  end_date: '2024-12-31',
  limit: 20,               // Pagination
  offset: 0,
});

console.log(`Total: ${result.total}`);
result.payments.forEach(p => console.log(p.id));
```

## Error Handling

The SDK provides rich error classes for different failure scenarios:

```typescript
import {
  OneRouterError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  PaymentNotFoundError,
  NetworkError,
  TimeoutError,
  isOneRouterError,
  isRetryableError,
} from '@OneRouter/sdk';

try {
  await client.payments.create({...});
} catch (error) {
  if (isOneRouterError(error)) {
    console.log(`Error: ${error.message}`);
    console.log(`Code: ${error.code}`);
    console.log(`Status: ${error.statusCode}`);
    console.log(`Trace ID: ${error.traceId}`);
    
    if (isRetryableError(error)) {
      // Safe to retry
    }
    
    // Handle specific error types
    if (error instanceof RateLimitError) {
      // Wait and retry
      await sleep(error.retryAfter * 1000);
    }
  }
}
```

### Error Types

| Error Class | Code | Description |
|-------------|------|-------------|
| `ValidationError` | `VALIDATION_ERROR` | Invalid request parameters |
| `AuthenticationError` | `UNAUTHORIZED` | Invalid or missing API key |
| `ForbiddenError` | `FORBIDDEN` | Access denied |
| `NotFoundError` | `NOT_FOUND` | Resource not found |
| `PaymentNotFoundError` | `PAYMENT_NOT_FOUND` | Payment not found |
| `RateLimitError` | `RATE_LIMIT_EXCEEDED` | Too many requests |
| `PaymentError` | `PAYMENT_FAILED` | Payment operation failed |
| `RefundError` | `REFUND_FAILED` | Refund operation failed |
| `ProviderError` | `PROVIDER_ERROR` | Payment provider error |
| `NetworkError` | `NETWORK_ERROR` | Network connectivity issue |
| `TimeoutError` | `TIMEOUT_ERROR` | Request timed out |
| `InternalError` | `INTERNAL_ERROR` | Server error |

## Metrics & Monitoring

### Request Metrics

Track request performance and success rates:

```typescript
const client = new UnifiedAPIClient({ apiKey: 'sk_xxx' });

// Make some requests...
await client.payments.list();
await client.payments.create({...});

// Get metrics
const metrics = client.getMetrics();
const summary = metrics.getSummary();

console.log(`Total requests: ${summary.total}`);
console.log(`Success rate: ${(summary.successful / summary.total * 100).toFixed(1)}%`);
console.log(`Average latency: ${summary.averageLatency}ms`);

// Filter metrics
const failedRequests = metrics.getMetricsFiltered({ success: false });
const getRequests = metrics.getMetricsFiltered({ method: 'GET' });

### Health Checks

Perform comprehensive service health checks:

```typescript
const health = await client.healthCheck();

console.log(`Overall status: ${health.status}`);
console.log(`API latency: ${health.services.api.latency}ms`);
console.log(`Auth check: ${health.services.auth.status}`);
console.log(`Payments service: ${health.services.payments?.status || 'not checked'}`);
```

## Interceptors

Customize request/response processing:

```typescript
const client = new UnifiedAPIClient({
  apiKey: 'sk_xxx',
  requestInterceptors: [
    (request) => {
      console.log(`Making ${request.method} request to ${request.path}`);
      // Add custom headers
      return {
        ...request,
        options: {
          ...request.options,
          headers: {
            ...request.options?.headers,
            'X-Custom-Header': 'value',
          },
        },
      };
    },
  ],
  responseInterceptors: [
    (response) => {
      console.log(`Response status: ${response.status}`);
      // Transform response data
      return response.data;
    },
  ],
  errorInterceptors: [
    (error) => {
      console.error(`Request failed: ${error.message}`);
      // Log errors or transform them
      return error;
    },
  ],
});
```

## Testing

### Using Mock Transport

```typescript
import { UnifiedAPIClient, MockTransport } from '@OneRouter/sdk';

// Create client with mock transport
const { client, mock } = UnifiedAPIClient.withMockTransport({
  apiKey: 'test_key',
});

// Set up mock responses
mock.onCreatePayment(async (body) => ({
  id: 'pay_mock_123',
  provider_transaction_id: 'pi_mock_123',
  amount: body.amount,
  currency: body.currency,
  status: 'completed',
  created_at: new Date().toISOString(),
}));

mock.onListPayments(async () => ({
  payments: [],
  total: 0,
  limit: 10,
  offset: 0,
}));

// Use client normally in tests
const payment = await client.payments.create({
  amount: 1000,
  currency: 'USD',
  provider: 'paypal',
  customer_id: 'cust_test',
  payment_method: 'pm_test',
});

// Verify requests
const requests = mock.getRequests();
expect(requests).toHaveLength(1);
expect(requests[0].path).toBe('/api/v1/payments/create');
```

## Environment Configuration

The SDK automatically detects your environment and configures appropriate defaults:

### Environment Detection

The SDK detects environments in this priority order:
1. `UNIFIED_ENV` environment variable
2. Hostname patterns (`.lc`, `.st`, `.pr`)
3. `NODE_ENV` fallback
4. Default: `local`

### Environment URLs

| Environment | Base URL | Signing |
|-------------|----------|---------|
| `local` | `http://localhost:8000` | Disabled |
| `staging` | `https://api-staging.onerouter.com` | Enabled |
| `production` | `https://api.onerouter.com` | Enabled |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `UNIFIED_ENV` | Override environment detection | auto-detected |
| `NODE_ENV` | Fallback for environment detection | - |

### Manual Configuration

```typescript
// Force production environment
const client = new UnifiedAPIClient({
  apiKey: 'sk_live_xxx',
  environment: 'production',
});

// Use custom base URL
const client = new UnifiedAPIClient({
  apiKey: 'sk_test_xxx',
  baseUrl: 'https://custom.api.com',
});
```

## Building from Source

```bash
# Clone the repository
git clone https://github.com/your-org/OneRouter.git
cd OneRouter/sdk

# Install dependencies
npm install

# Build (produces ESM, CJS, and type declarations)
npm run build

# Run tests
npm test

# Run linter
npm run lint

# Type check
npm run typecheck
```

## Build Output

After running `npm run build`, the `dist/` directory contains:

```
dist/
├── index.js       # ESM bundle
├── index.cjs      # CommonJS bundle
├── index.d.ts     # TypeScript declarations (ESM)
├── index.d.cts    # TypeScript declarations (CJS)
└── index.js.map   # Source map
```

## Troubleshooting

### "Cannot find module" errors

Ensure you've built the SDK:
```bash
cd sdk && npm run build
```

### Request timeouts

Increase the timeout in client configuration:
```typescript
const client = new UnifiedAPIClient({
  apiKey: 'sk_xxx',
  timeout: 60000, // 60 seconds
});
```

### Rate limiting

The SDK automatically retries rate-limited requests. For custom handling:
```typescript
try {
  await client.payments.create({...});
} catch (error) {
  if (error instanceof RateLimitError) {
    const retryAfter = error.retryAfter || 60;
    console.log(`Rate limited. Retry after ${retryAfter}s`);
  }
}
```

### Network errors

Check your network connectivity and ensure the API server is running:
```bash
curl http://localhost:3000/health
```

### Debug mode

Enable debug logging by checking trace IDs in errors:
```typescript
catch (error) {
  if (isOneRouterError(error)) {
    console.log(`Trace ID: ${error.traceId}`);
    // Use this trace ID when contacting support
  }
}
```

## Changelog

### v0.1.0 (Production Ready Release)

- 🌍 **Environment-Aware Configuration** - Auto-detects local/staging/production environments
- ✅ **Auto-Validation** - Validates API keys and connectivity on client creation
- 📈 **Metrics Tracking** - Built-in request metrics with performance monitoring
- 🔍 **Health Monitoring** - Comprehensive service health checks with latency tracking
- 🔌 **Request/Response Interceptors** - Customizable interceptors for advanced use cases
- ⚡ **Performance Optimizations** - HTTP/2 support, compression, response caching
- 🔄 **Enhanced Retry Logic** - Improved exponential backoff and error handling
- 🔗 **Connection Pooling** - Keep-alive connections for better performance
- 🎯 **Type Safety** - Full TypeScript support with comprehensive type definitions
- 🧪 **Complete Test Suite** - 95%+ coverage with unit, integration, and environment tests
- 📚 **Production Documentation** - Comprehensive guides and API reference

### v0.0.1 (Initial Release)

- ✨ Initial SDK implementation
- 🔐 API key authentication with HMAC signing
- 💳 Payment operations (create, refund, list)
- 🔄 Automatic retry with exponential backoff
- 🆔 Idempotency key support
- 📊 Request tracing with trace IDs
- 🧪 Mock transport for testing
- 📦 Dual ESM/CJS bundles

## License

ISC

## Support

For issues and feature requests, please open a GitHub issue.

For security vulnerabilities, please contact security@OneRouter.com.
