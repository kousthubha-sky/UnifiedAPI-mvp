# Unified Payment API - Backend

A robust Node.js + TypeScript backend service for processing payments across multiple providers (Stripe and PayPal) with built-in rate limiting, authentication, and comprehensive logging.

## Features

- **Multi-Provider Payment Processing**: Support for Stripe and PayPal adapters
- **Type-Safe**: Full TypeScript support with strict mode enabled
- **REST API with Swagger UI**: Interactive API documentation
- **Authentication**: API key validation via headers
- **Rate Limiting**: Redis-backed token bucket rate limiter
- **Structured Logging**: Pino logger with audit trail capabilities
- **Error Handling**: Centralized error handler with domain-specific error mapping
- **Caching**: Redis-backed caching for performance optimization
- **Database Integration**: Supabase for metadata persistence

## Project Structure

```
src/
├── server.ts                 # Fastify server bootstrap
├── types/
│   └── payment.ts           # Shared DTOs and validation schemas
├── utils/
│   ├── logger.ts            # Pino logger configuration
│   ├── supabase.ts          # Supabase client singleton
│   └── cache.ts             # Redis connection helpers
├── adapters/
│   ├── base.ts              # Payment adapter interface
│   ├── stripe.ts            # Stripe adapter implementation
│   └── paypal.ts            # PayPal adapter implementation
└── api/
    ├── routes/
    │   └── payments.ts      # Payment endpoints
    └── middleware/
        ├── auth.ts          # API key validation
        ├── logging.ts       # Request/response logging
        ├── rateLimit.ts     # Redis-backed rate limiter
        └── errorHandler.ts  # Error mapping and handling
```

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure the required environment variables:

```bash
cp .env.example .env
```

### Required Environment Variables

- `STRIPE_API_KEY`: Stripe API key
- `PAYPAL_CLIENT_ID`: PayPal client ID
- `PAYPAL_CLIENT_SECRET`: PayPal client secret
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `REDIS_URL`: Redis connection URL

### Optional Environment Variables

- `NODE_ENV`: Environment (development/production)
- `LOG_LEVEL`: Logging level (debug/info/warn/error)
- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: 0.0.0.0)
- `ALLOWED_API_KEYS`: Comma-separated list of allowed API keys
- `CORS_ORIGIN`: CORS origin (default: *)

## Development

Start the development server with hot reload:

```bash
npm run dev
```

## Building

Build TypeScript to JavaScript:

```bash
npm run build
```

## Running

Start the production server:

```bash
npm start
```

## Linting

Run ESLint:

```bash
npm run lint
```

## Testing

Run tests:

```bash
npm test
```

## API Endpoints

### Health Check

```
GET /health
```

Returns server health status.

### Create Payment

```
POST /payments
X-API-Key: your-api-key

{
  "amount": 100.00,
  "currency": "USD",
  "provider": "stripe",
  "description": "Payment description",
  "customer_id": "cust_123",
  "payment_method": "tok_visa",
  "metadata": {
    "order_id": "order_456"
  }
}
```

### Refund Payment

```
POST /payments/:id/refund
X-API-Key: your-api-key

{
  "reason": "customer_request",
  "amount": 50.00
}
```

## API Documentation

Once the server is running, visit http://localhost:3000/docs for interactive Swagger documentation.

## Middleware Order

Middleware is executed in the following order:

1. Error Handler (registered first to catch all errors)
2. Logging Middleware (logs all requests/responses)
3. Authentication Middleware (validates API keys)
4. Rate Limiting Middleware (enforces rate limits)
5. Route Handlers

## TypeScript Configuration

The project uses `NodeNext` module resolution to enforce `.js` extensions on all imports. This ensures compatibility with ES modules and future-proof code.

## Database Schema

The application expects the following Supabase tables:

### `api_keys` Table

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `payments` Table

```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  provider_transaction_id TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL,
  amount DECIMAL(19, 4) NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  metadata JSONB,
  refund_id TEXT,
  refund_status TEXT,
  refund_amount DECIMAL(19, 4),
  created_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Error Codes

Common error codes returned by the API:

- `MISSING_API_KEY`: API key header not provided
- `INVALID_API_KEY`: API key is invalid or revoked
- `INACTIVE_API_KEY`: API key is marked as inactive
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded for this API key
- `VALIDATION_ERROR`: Request payload validation failed
- `INVALID_PROVIDER`: Invalid payment provider specified
- `PAYMENT_NOT_FOUND`: Payment transaction not found
- `INTERNAL_ERROR`: Internal server error

## Logging

The application uses Pino for structured logging. In development mode, logs are pretty-printed. In production, logs are in JSON format suitable for log aggregation services.

### Audit Logs

Audit logs are automatically generated for payment operations:

```json
{
  "type": "AUDIT",
  "action": "PAYMENT_CREATED",
  "provider": "stripe",
  "transaction_id": "ch_123",
  "amount": 100,
  "currency": "USD",
  "customer_id": "cust_123",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Rate Limiting

Rate limiting uses a token bucket algorithm with Redis:

- Refill Rate: 100 tokens per minute
- Capacity: 1000 tokens
- Per API Key

## License

ISC
