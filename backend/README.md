# Unified Payment API - Backend

A robust Node.js + TypeScript backend service for processing payments across multiple providers (Stripe and PayPal) with built-in rate limiting, authentication, and comprehensive logging.

## Features

- **Multi-Provider Payment Processing**: Support for Stripe and PayPal adapters
- **Type-Safe**: Full TypeScript support with strict mode enabled
- **REST API with Swagger UI**: Interactive API documentation
- **Authentication**: Database-backed API key validation with Redis caching
- **Rate Limiting**: Per-tier rate limiting with Redis token bucket algorithm
- **Structured Logging**: Pino logger with database audit trail capabilities
- **Error Handling**: Centralized error handler with domain-specific error mapping
- **Caching**: Redis-backed caching for performance optimization
- **Database Integration**: Supabase PostgreSQL for schema, customers, and audit logs
- **Customer Management**: Full customer lifecycle management with API keys
- **Audit Logging**: Comprehensive audit logs with trace IDs and performance metrics

## Project Structure

```
src/
├── server.ts                 # Fastify server bootstrap
├── repositories/             # Database access layer
│   ├── customerRepository.ts # Customer CRUD operations
│   ├── apiKeyRepository.ts   # API key generation & management
│   └── auditRepository.ts    # Audit log persistence
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
    │   ├── customers.ts     # Customer management endpoints
    │   ├── apiKeys.ts       # API key management endpoints
    │   └── payments.ts      # Payment endpoints
    └── middleware/
        ├── auth.ts          # API key validation with caching
        ├── logging.ts       # Request/response logging
        ├── rateLimit.ts     # Redis-backed rate limiter with tier support
        └── errorHandler.ts  # Error mapping and handling
db/
├── migrations/
│   └── 001_initial_schema.sql # Database schema creation
└── README.md                  # Database setup guide
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

### Customer Management

#### Create Customer

```
POST /api/v1/customers

{
  "email": "customer@example.com",
  "tier": "starter"  # Optional: starter, growth, scale
}
```

Response:
```json
{
  "id": "uuid",
  "email": "customer@example.com",
  "tier": "starter",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### Get Customer Profile

```
GET /api/v1/customers/:id
X-API-Key: your-api-key
```

#### Update Customer Profile

```
PATCH /api/v1/customers/:id
X-API-Key: your-api-key

{
  "tier": "growth",
  "stripe_account_id": "acct_123",
  "paypal_account_id": "acct_456"
}
```

### API Key Management

#### Generate API Key

```
POST /api/v1/api-keys
X-API-Key: your-api-key

{
  "name": "Production Key"  # Optional
}
```

Response:
```json
{
  "id": "uuid",
  "key": "sk_...",
  "name": "Production Key",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### List API Keys

```
GET /api/v1/api-keys
X-API-Key: your-api-key
```

#### Revoke API Key

```
PATCH /api/v1/api-keys/:id
X-API-Key: your-api-key

{
  "action": "revoke"
}
```

#### Rotate API Key

```
PATCH /api/v1/api-keys/:id
X-API-Key: your-api-key

{
  "action": "rotate"
}
```

Response:
```json
{
  "id": "uuid",
  "key": "sk_...",  # New key
  "name": "Production Key",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### Delete API Key

```
DELETE /api/v1/api-keys/:id
X-API-Key: your-api-key
```

### Payment Operations

#### Create Payment

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

#### Refund Payment

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

## Database Setup

### Supabase Configuration

1. Create a Supabase project at https://supabase.com
2. Run the migrations from `db/migrations/001_initial_schema.sql` in the Supabase SQL editor
3. Add your Supabase credentials to `.env`:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

### Database Schema

The application uses the following Supabase tables:

- **customers**: Customer accounts and subscription tiers
- **api_keys**: API keys for authentication
- **audit_logs**: Audit trail of all API requests
- **usage_stats**: Daily usage statistics per customer
- **payments**: Payment transaction records

For complete schema details, see `db/README.md`.

### Rate Limiting Tiers

```
starter:  1,000  requests/hour
growth:   5,000  requests/hour
scale:   20,000  requests/hour
admin:   Unlimited
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

- Per-tier limits (see above)
- Refill interval: 1 minute
- Tracked per API Key in Redis
- Response headers include X-RateLimit-* information

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1704067200
```

## API Key Flow

1. **Create Customer**: POST /api/v1/customers
2. **Generate API Key**: POST /api/v1/api-keys (requires authentication)
3. **Use API Key**: Include `X-API-Key: your-key` in requests
4. **Manage Keys**: List, revoke, rotate, or delete keys as needed

## Authentication Flow

1. Client sends request with `X-API-Key` header
2. Auth middleware validates the key against the database
3. Customer and tier information are cached in Redis for 1 hour
4. Rate limiting is applied based on customer tier
5. Request proceeds with customerId and tier attached to request object

## Audit Logging

All API requests are logged to the `audit_logs` table with:

- Trace ID (for request tracing)
- Customer ID
- Endpoint and HTTP method
- Response status code
- Request latency
- Error messages (if applicable)
- Request/response bodies (optional)

## License

ISC
