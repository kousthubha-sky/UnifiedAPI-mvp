# Complete Setup Guide for PaymentHub API

This guide walks through the complete setup process for the PaymentHub API, including database schema initialization, customer management, and API key generation.

## Prerequisites

- Node.js 20.x or later
- npm 9.x or 10.x
- Redis (for caching and rate limiting)
- A Supabase account (free tier available)
- Stripe account (for payment processing)
- PayPal account (for payment processing)

## Step 1: Database Setup

### 1.1 Create Supabase Project

1. Visit [https://supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Enter your project details:
   - Project name: e.g., "PaymentHub"
   - Database password: Use a strong password
   - Region: Select closest to your location
5. Wait for project initialization (1-2 minutes)

### 1.2 Run Database Migrations

1. In your Supabase project, go to the SQL Editor
2. Click "New Query"
3. Open `backend/db/migrations/001_initial_schema.sql` locally
4. Copy the entire SQL content
5. Paste it into the SQL Editor
6. Click "Run" to execute the migration

You should see success messages for all table creations.

### 1.3 Verify Database Tables

In Supabase Dashboard:
1. Go to Table Editor
2. Verify the following tables exist:
   - customers
   - api_keys
   - audit_logs
   - usage_stats
   - payments

## Step 2: Backend Configuration

### 2.1 Environment Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 2.2 Update .env File

Edit `backend/.env` with your credentials:

```bash
# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Payment Providers (Required)
STRIPE_API_KEY=sk_test_...
PAYPAL_CLIENT_ID=AZvZ...
PAYPAL_CLIENT_SECRET=...

# Redis (Required for rate limiting)
REDIS_URL=redis://localhost:6379

# Optional
NODE_ENV=development
LOG_LEVEL=debug
PORT=3000
HOST=0.0.0.0
```

To get these values:

**Supabase Keys:**
1. In Supabase Dashboard → Settings → API
2. Copy `Project URL` → SUPABASE_URL
3. Copy `anon public` key → SUPABASE_ANON_KEY
4. Copy `service_role` secret → SUPABASE_SERVICE_KEY

**Stripe:**
1. Go to [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Get your test API key from Developers → API keys

**PayPal:**
1. Go to [https://developer.sandbox.paypal.com](https://developer.sandbox.paypal.com)
2. Get your sandbox credentials

### 2.3 Build and Test

```bash
# Build TypeScript
npm run build

# Run linter
npm run lint

# Start development server
npm run dev
```

The server should start on http://localhost:3000

Verify it's running:
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

## Step 3: Frontend Configuration

### 3.1 Environment Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 3.2 Update .env File

Edit `frontend/.env`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3.3 Start Frontend

```bash
npm run dev
```

The frontend should start on http://localhost:3001

## Step 4: API Usage Flow

### 4.1 Create Your First Customer

```bash
curl -X POST http://localhost:3000/api/v1/customers \
  -H "Content-Type: application/json" \
  -d '{
    "email": "merchant@example.com",
    "tier": "starter"
  }'
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "merchant@example.com",
  "tier": "starter",
  "created_at": "2024-01-01T12:00:00Z"
}
```

Save the `id` - you'll need it for the next step.

### 4.2 Generate API Key

```bash
# Use any admin key from ALLOWED_API_KEYS for initial setup
curl -X POST http://localhost:3000/api/v1/api-keys \
  -H "X-API-Key: key1" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Key"
  }'
```

Response:
```json
{
  "id": "...",
  "key": "sk_...",
  "name": "Production Key",
  "is_active": true,
  "created_at": "2024-01-01T12:00:00Z"
}
```

**Save the `key` value - you'll use this for all future API requests!**

### 4.3 Make Your First Payment

```bash
curl -X POST http://localhost:3000/payments \
  -H "X-API-Key: sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.00,
    "currency": "USD",
    "provider": "stripe",
    "customer_id": "cust_123",
    "payment_method": "tok_visa",
    "description": "Test payment"
  }'
```

## Step 5: Verification

### 5.1 Verify Authentication

```bash
# Without API key (should fail with 401)
curl http://localhost:3000/api/v1/api-keys

# With API key (should succeed)
curl -H "X-API-Key: sk_..." http://localhost:3000/api/v1/api-keys
```

### 5.2 Verify Rate Limiting

```bash
# Check rate limit headers
curl -I -H "X-API-Key: sk_..." http://localhost:3000/api/v1/api-keys
```

Look for headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: ...
```

### 5.3 Verify Audit Logs

1. Go to Supabase Dashboard → Table Editor → audit_logs
2. You should see entries for all API calls you made

## Step 6: Rate Limiting Tiers

Your customer can be upgraded by updating their tier:

```bash
# Upgrade to growth tier (5,000 requests/hour)
curl -X PATCH http://localhost:3000/api/v1/customers/{id} \
  -H "X-API-Key: key1" \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "growth"
  }'

# Upgrade to scale tier (20,000 requests/hour)
curl -X PATCH http://localhost:3000/api/v1/customers/{id} \
  -H "X-API-Key: key1" \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "scale"
  }'
```

## Step 7: API Key Management

### List API Keys
```bash
curl -H "X-API-Key: sk_..." http://localhost:3000/api/v1/api-keys
```

### Revoke API Key
```bash
curl -X PATCH http://localhost:3000/api/v1/api-keys/{key_id} \
  -H "X-API-Key: sk_..." \
  -H "Content-Type: application/json" \
  -d '{"action": "revoke"}'
```

### Rotate API Key
```bash
curl -X PATCH http://localhost:3000/api/v1/api-keys/{key_id} \
  -H "X-API-Key: sk_..." \
  -H "Content-Type: application/json" \
  -d '{"action": "rotate"}'
```

### Delete API Key
```bash
curl -X DELETE http://localhost:3000/api/v1/api-keys/{key_id} \
  -H "X-API-Key: sk_..."
```

## Troubleshooting

### Connection to Supabase Failed
- Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
- Check that Supabase project is active
- Ensure your IP isn't blocked by Supabase firewall

### Database Tables Not Found
- Verify migrations were run in SQL Editor
- Check that all tables exist in Table Editor
- Try running migrations again

### Rate Limiting Not Working
- Ensure Redis is running: `redis-cli ping` (should return PONG)
- Check REDIS_URL in .env

### Authentication Failing
- Ensure API key is correctly formatted (should start with `sk_`)
- Verify key was generated for the correct customer
- Check that key is marked as active in database

### Payments Failing
- Verify Stripe/PayPal credentials are correct
- Use test credentials in development
- Check payment method format (test values for development)

## Next Steps

1. Explore the API documentation at http://localhost:3000/docs
2. Test different payment flows
3. Try upgrading customer tiers
4. Monitor audit logs in Supabase
5. Implement payment webhooks (optional)

## Support

For more information:
- See `backend/README.md` for API documentation
- See `backend/db/README.md` for database schema details
- Check `README.md` for project architecture
