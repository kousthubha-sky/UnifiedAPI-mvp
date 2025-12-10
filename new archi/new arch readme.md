# UnifiedAPI 2025 - Complete Setup Guide

> A modern, production-ready payment API with hybrid Stripe Connect + BYOK architecture

## 🎯 What is UnifiedAPI?

UnifiedAPI is a unified payment processing platform that gives your customers **two ways** to integrate payments:

1. **Stripe Connect** (Recommended) - One-click OAuth setup, like Clerk authentication
2. **BYOK** (Bring Your Own Keys) - Manual API key entry for advanced users

**The magic**: Your customers use the same SDK regardless of which method they choose!

## 🏗️ Architecture Overview

```
Frontend (Next.js)
    ↓ 
SDK (TypeScript)
    ↓
Backend (FastAPI)
    ↓
├─ Stripe Connect (OAuth) → Customer's Stripe Account
└─ BYOK (API Key) → Customer's Stripe Account
```

## 🚀 Quick Start (5 minutes)

### Prerequisites

- Docker & Docker Compose
- Python 3.12+
- Node.js 20+
- PostgreSQL 16+
- Stripe Account (test mode is fine)

### 1. Clone and Setup

```bash
# Clone repository
git clone https://github.com/yourorg/unifiedapi.git
cd unifiedapi

# Run automated setup
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This script will:
- Generate encryption keys
- Create `.env` file
- Start PostgreSQL and Redis
- Run database migrations

### 2. Configure Stripe

Edit `.env` and add your Stripe credentials:

```bash
# Test mode keys from https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_51...your_key_here

# For Connect (optional - get from https://dashboard.stripe.com/settings/applications)
ENABLE_CONNECT=true
STRIPE_CONNECT_CLIENT_ID=ca_...your_client_id
```

### 3. Start Development Environment

```bash
# Option 1: Docker (recommended)
docker-compose up

# Option 2: Local development
chmod +x scripts/dev.sh
./scripts/dev.sh
```

### 4. Access Services

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 📋 Project Structure

```
unifiedapi/
├── backend/              # FastAPI Python backend
│   ├── app/
│   │   ├── main.py      # Main application
│   │   ├── models/      # Database models
│   │   ├── services/    # Business logic
│   │   ├── api/         # API routes
│   │   └── core/        # Auth, encryption, config
│   ├── alembic/         # Database migrations
│   ├── tests/           # Backend tests
│   └── requirements.txt
│
├── sdk/                 # TypeScript SDK
│   ├── src/
│   │   ├── client.ts    # Main client
│   │   ├── services/    # Service modules
│   │   └── types/       # TypeScript types
│   ├── tests/           # SDK tests
│   └── package.json
│
├── frontend/            # Next.js frontend
│   ├── app/             # App Router pages
│   ├── components/      # React components
│   ├── lib/             # Utilities
│   └── package.json
│
├── scripts/             # Automation scripts
│   ├── setup.sh         # Initial setup
│   ├── dev.sh           # Start dev environment
│   └── test.sh          # Run all tests
│
├── k8s/                 # Kubernetes manifests
└── docker-compose.yml   # Docker orchestration
```

## 🔧 Development Workflow

### Backend Development

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000

# Run tests
pytest tests/ -v --cov=app
```

### SDK Development

```bash
cd sdk

# Install dependencies
npm install

# Build SDK
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Publish to npm
npm publish --access public
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📚 Usage Examples

### 1. Customer Registers

```typescript
// Frontend - Register new customer
const response = await fetch('http://localhost:8000/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'customer@example.com',
    password: 'secure_password',
    name: 'John Doe',
    company_name: 'Acme Inc'
  })
});

const { access_token, customer_id } = await response.json();

// Generate API key for SDK usage
const keyResponse = await fetch('http://localhost:8000/api/v1/auth/api-keys', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ key_name: 'Production Key' })
});

const { api_key } = await keyResponse.json();
// api_key: "uapi_abc123..."
```

### 2. Customer Connects Stripe (Option A: Connect)

```typescript
// Frontend - Initiate Stripe Connect
const response = await fetch('http://localhost:8000/api/v1/connect/stripe/onboard', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${api_key}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'customer@example.com',
    account_type: 'express',
    country: 'US'
  })
});

const { onboarding_url } = await response.json();

// Redirect customer to Stripe onboarding
window.location.href = onboarding_url;

// After customer completes onboarding, they're redirected back
// Check status:
const statusResponse = await fetch('http://localhost:8000/api/v1/connect/stripe/status', {
  headers: { 'Authorization': `Bearer ${api_key}` }
});

const { is_complete, charges_enabled } = await statusResponse.json();
// is_complete: true, charges_enabled: true ✓
```

### 3. Customer Adds API Key (Option B: BYOK)

```typescript
// Frontend - Save Stripe API key
const response = await fetch('http://localhost:8000/api/v1/config/api-key', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${api_key}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    provider: 'stripe',
    api_key: 'sk_test_51ABC...'
  })
});

// Verify credentials
const verifyResponse = await fetch('http://localhost:8000/api/v1/config/verify?provider=stripe', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${api_key}` }
});

const { is_valid } = await verifyResponse.json();
// is_valid: true ✓
```

### 4. Create Payment (Works with Both Methods!)

```typescript
// SDK Usage - Same code works for Connect AND BYOK!
import { UnifiedAPIClient } from '@unifiedapi/client';

const client = new UnifiedAPIClient({
  apiKey: 'uapi_abc123...', // From step 1
  baseUrl: 'http://localhost:8000'
});

// Create payment
const payment = await client.payments.create({
  amount: 10000, // $100.00 in cents
  currency: 'usd',
  description: 'Order #12345',
  customer_email: 'buyer@example.com'
});

console.log(payment);
// {
//   id: 'pi_3ABC...',
//   amount: 10000,
//   currency: 'usd',
//   status: 'succeeded',
//   provider: 'stripe',
//   connection_type: 'connect', // or 'api_key'
//   created_at: 1702847234
// }
```

### 5. Refund Payment

```typescript
const refund = await client.payments.refund(payment.id, {
  amount: 5000, // Partial refund: $50.00
  reason: 'requested_by_customer'
});

console.log(refund);
// {
//   id: 're_3ABC...',
//   payment_id: 'pi_3ABC...',
//   amount: 5000,
//   status: 'succeeded'
// }
```

### 6. List Payments

```typescript
const payments = await client.payments.list({
  limit: 10,
  offset: 0,
  status: 'succeeded'
});

console.log(payments);
// {
//   data: [...],
//   total: 42,
//   has_more: true
// }
```

## 🧪 Testing

### Run All Tests

```bash
chmod +x scripts/test.sh
./scripts/test.sh
```

### Backend Tests Only

```bash
cd backend
pytest tests/ -v --cov=app --cov-report=html

# View coverage report
open htmlcov/index.html
```

### SDK Tests Only

```bash
cd sdk
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

### Integration Tests

```bash
cd backend
pytest tests/integration/ -v
```

## 🔒 Security Best Practices

### Encryption Keys

**Development:**
```bash
# Generate new keys
openssl rand -hex 32  # SECRET_KEY
openssl rand -hex 32  # ENCRYPTION_KEY
```

**Production:**
Use a proper key management service:
- AWS KMS
- Google Cloud KMS
- HashiCorp Vault
- Azure Key Vault

```python
# backend/app/core/encryption.py (production version)
import boto3
from botocore.exceptions import ClientError

class ProductionEncryption:
    def __init__(self):
        self.kms = boto3.client('kms')
        self.key_id = os.getenv('AWS_KMS_KEY_ID')
    
    def encrypt(self, plaintext: str) -> str:
        response = self.kms.encrypt(
            KeyId=self.key_id,
            Plaintext=plaintext.encode()
        )
        return base64.b64encode(response['CiphertextBlob']).decode()
    
    def decrypt(self, encrypted: str) -> str:
        ciphertext_blob = base64.b64decode(encrypted)
        response = self.kms.decrypt(
            CiphertextBlob=ciphertext_blob
        )
        return response['Plaintext'].decode()
```

### API Key Rotation

```typescript
// Rotate customer's API key
const newKey = await fetch('http://localhost:8000/api/v1/auth/api-keys', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${oldKey}` },
  body: JSON.stringify({ key_name: 'Rotated Key' })
});

// Revoke old key
await fetch(`http://localhost:8000/api/v1/auth/api-keys/${oldKeyId}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${newKey}` }
});
```

### Rate Limiting

```python
# backend/app/core/rate_limit.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# In main.py
from slowapi.errors import RateLimitExceeded

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# In routes
@router.post("/payments")
@limiter.limit("100/minute")
async def create_payment(...):
    ...
```

## 🚀 Deployment

### Docker Production Build

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Push to registry
docker tag unifiedapi-backend:latest registry.example.com/unifiedapi-backend:latest
docker push registry.example.com/unifiedapi-backend:latest
```

### Kubernetes Deployment

```bash
# Create secrets
kubectl create secret generic unifiedapi-secrets \
  --from-literal=database-url='postgresql://...' \
  --from-literal=encryption-key='...' \
  --from-literal=stripe-secret-key='sk_live_...'

# Deploy
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods -l app=unifiedapi
kubectl logs -f deployment/unifiedapi-backend
```

### Environment Variables (Production)

```bash
# Backend
DATABASE_URL=postgresql+asyncpg://prod-db/unifiedapi
SECRET_KEY=<64-char-hex>
ENCRYPTION_KEY=<use-kms>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_API_VERSION=2025-11-17.clover
ENABLE_CONNECT=true
STRIPE_CONNECT_CLIENT_ID=ca_...
REDIS_URL=redis://prod-redis:6379
FRONTEND_URL=https://yourdomain.com
CORS_ORIGINS=["https://yourdomain.com"]

# Frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### Database Migrations (Production)

```bash
# Run migrations
cd backend
alembic upgrade head

# Rollback if needed
alembic downgrade -1

# Create new migration
alembic revision --autogenerate -m "Add new table"
```

## 📊 Monitoring & Observability

### Prometheus Metrics

```bash
# Scrape endpoint
curl http://localhost:8000/metrics

# Example metrics:
# payment_requests_total{provider="stripe",connection_type="connect",status="success"} 1234
# payment_duration_seconds_sum{provider="stripe",action="create"} 45.67
# active_payment_configs{provider="stripe",connection_type="connect"} 89
```

### Health Checks

```bash
# Liveness probe
curl http://localhost:8000/health
# {"status":"ok","version":"2.0.0"}

# Readiness probe
curl http://localhost:8000/ready
# {"database":"ok","redis":"ok"}
```

### Logging

```python
# Structured logging with correlation IDs
import structlog

logger = structlog.get_logger()

logger.info(
    "payment_created",
    payment_id="pi_123",
    customer_id="cus_456",
    amount=10000,
    connection_type="connect"
)
```

## 🐛 Troubleshooting

### Common Issues

**1. Database connection failed**
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection
psql -h localhost -U unifiedapi -d unifiedapi
```

**2. Stripe API errors**
```bash
# Verify API key
curl https://api.stripe.com/v1/balance \
  -u sk_test_...:

# Check API version compatibility
# Must use 2025-11-17.clover or later
```

**3. CORS errors in frontend**
```bash
# Verify CORS_ORIGINS in .env includes frontend URL
CORS_ORIGINS=["http://localhost:3000"]

# Check browser console for specific error
```

**4. Encryption key errors**
```bash
# Ensure key is exactly 64 hex characters
echo -n "your_key" | wc -c  # Should output 64

# Regenerate if needed
openssl rand -hex 32
```

## 📖 API Reference

### Full API Documentation

- **Interactive Docs**: http://localhost:8000/docs (Swagger UI)
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Spec**: http://localhost:8000/openapi.json

### Key Endpoints

```
Authentication:
POST   /api/v1/auth/register          - Register customer
POST   /api/v1/auth/login             - Login customer
POST   /api/v1/auth/api-keys          - Generate API key
GET    /api/v1/auth/api-keys          - List API keys
DELETE /api/v1/auth/api-keys/{id}     - Revoke API key

Configuration:
POST   /api/v1/config/api-key         - Save API key (BYOK)
POST   /api/v1/config/verify          - Verify credentials
GET    /api/v1/config/status          - Get all configs
DELETE /api/v1/config/{provider}      - Disconnect service

Stripe Connect:
POST   /api/v1/connect/stripe/onboard - Initiate onboarding
GET    /api/v1/connect/stripe/status  - Check status
GET    /api/v1/connect/stripe/dashboard - Get dashboard link

Payments:
POST   /api/v1/payments               - Create payment
POST   /api/v1/payments/{id}/refund   - Refund payment
GET    /api/v1/payments/{id}          - Get payment
GET    /api/v1/payments               - List payments
```

## 🎓 Learning Resources

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Documentation**: https://docs.unifiedapi.io
- **Discord**: https://discord.gg/unifiedapi
- **Email**: support@unifiedapi.io
- **GitHub Issues**: https://github.com/yourorg/unifiedapi/issues

---

**Built with ❤️ by the UnifiedAPI Team**