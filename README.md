# UnifiedAPI-mvp

A unified payment processing API supporting multiple payment providers (Stripe, PayPal) through a single, consistent interface.

## 🎉 Latest Update (December 2024)

All dependencies have been updated to their latest stable versions:
- **Backend**: Fastify 5, Stripe 16, TypeScript 5.7, ESLint 9
- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, TypeScript 5.7

**Build Status**: ✅ All builds passing

See [UPDATE_SUMMARY.md](./UPDATE_SUMMARY.md) for a quick overview or [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed changes.

## 🏗️ Architecture

### Backend
- **Framework**: Fastify 5 (Node.js REST API)
- **Language**: TypeScript 5.7 with strict mode
- **Payment Providers**: Stripe 16 (PaymentIntents API), PayPal
- **Database**: Supabase (PostgreSQL)
- **Caching**: Redis 4.7
- **Validation**: Zod 3.24
- **Logging**: Pino 9
- **API Documentation**: Swagger/OpenAPI

### Frontend
- **Framework**: Next.js 16 (React 19)
- **Language**: TypeScript 5.7
- **Styling**: Tailwind CSS 4 (CSS-first configuration)
- **UI Components**: Custom components with Tailwind
- **State Management**: React Hooks
- **Data Fetching**: Native fetch with custom API client

## 📦 Project Structure

```
.
├── backend/                 # Backend API server
│   ├── src/
│   │   ├── api/            # Routes and middleware
│   │   ├── adapters/       # Payment provider adapters
│   │   ├── types/          # TypeScript types and DTOs
│   │   └── utils/          # Helper utilities
│   ├── dist/               # Compiled JavaScript
│   ├── package.json
│   └── eslint.config.js    # ESLint 9 flat config
│
├── frontend/               # Next.js frontend
│   ├── app/               # Next.js App Router pages
│   ├── components/        # React components
│   ├── lib/               # Utilities and API client
│   ├── package.json
│   └── tailwind.config.ts # Tailwind configuration
│
└── docs/                  # Documentation
    ├── UPDATE_SUMMARY.md       # Quick update overview
    ├── MIGRATION_GUIDE.md      # Detailed migration guide
    ├── DEPENDENCY_VERSIONS.md  # Version comparison
    ├── TEST_CHECKLIST.md       # Testing guidelines
    └── CHANGELOG.md            # Release notes
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x or later
- npm 9.x or 10.x
- Redis (for caching)
- Supabase account
- Stripe account (for payments)

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase and payment provider credentials

# Set up Supabase (if not already done)
# 1. Create a project at https://supabase.com
# 2. Run db/migrations/001_initial_schema.sql in Supabase SQL editor
# 3. Update .env with your SUPABASE_URL and SUPABASE_ANON_KEY

# Build TypeScript
npm run build

# Start development server
npm run dev

# Or start production server
npm start
```

For detailed Supabase setup instructions, see `backend/db/README.md`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev

# Or build for production
npm run build
npm start
```

## 🔧 Environment Variables

### Backend (.env)

```bash
PORT=3000
HOST=0.0.0.0

# Stripe
STRIPE_API_KEY=sk_test_...

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# Supabase
SUPABASE_URL=https://...
SUPABASE_KEY=...

# Redis
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGIN=http://localhost:3001
```

### Frontend (.env)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 📚 API Documentation

Once the backend is running, visit:
- Swagger UI: `http://localhost:3000/docs`
- Health Check: `http://localhost:3000/health`

### Key Endpoints

#### Customer Management
- `POST /api/v1/customers` - Create customer account
- `GET /api/v1/customers/:id` - Get customer profile
- `PATCH /api/v1/customers/:id` - Update customer profile

#### API Key Management
- `POST /api/v1/api-keys` - Generate API key
- `GET /api/v1/api-keys` - List API keys
- `PATCH /api/v1/api-keys/:id` - Revoke/rotate key
- `DELETE /api/v1/api-keys/:id` - Delete key

#### Payment Operations
- `POST /payments` - Create a payment
- `POST /payments/:id/refund` - Refund a payment

## 🧪 Development

### Backend Commands

```bash
npm run dev         # Start development server with hot reload
npm run build       # Compile TypeScript
npm run start       # Start production server
npm run lint        # Run ESLint
npm run test        # Run tests (Vitest)
```

### Frontend Commands

```bash
npm run dev         # Start Next.js dev server
npm run build       # Build for production
npm run start       # Start production server
npm run lint        # Run ESLint (Next.js)
npm run type-check  # Run TypeScript compiler check
```

## 🔐 Authentication

The API uses API key authentication:
1. Generate an API key via the dashboard
2. Include it in requests: `X-API-Key: your-api-key`

## 💳 Supported Payment Methods

### Stripe (v16 - PaymentIntents API)
- Credit/Debit Cards
- Digital Wallets (Apple Pay, Google Pay)
- Bank Transfers
- Buy Now, Pay Later

### PayPal
- PayPal Balance
- Credit/Debit Cards via PayPal
- PayPal Credit

## 🎨 Styling (Tailwind CSS 4)

The frontend uses Tailwind CSS 4 with CSS-first configuration:

```css
/* In app/globals.css */
@import "tailwindcss";

@theme {
  --color-primary: #0066cc;
  --color-secondary: #6f42c1;
}
```

Custom utilities are available:
- `.btn`, `.btn-primary`, `.btn-secondary`
- `.card`
- `.input`, `.input-label`
- `.form-group`

## 📈 Monitoring & Logging

- **Logging**: Pino 9 with pretty printing in development
- **Health Check**: `/health` endpoint
- **Swagger Docs**: `/docs` endpoint

## 🧰 Tech Stack Details

### Backend Dependencies (Major)
- Fastify 5.6+ - Web framework
- Stripe 16.12+ - Payment processing (PaymentIntents API)
- TypeScript 5.9+ - Type safety
- Pino 9.14+ - Logging
- Redis 4.7+ - Caching
- Zod 3.25+ - Validation
- ESLint 9.39+ - Linting (flat config)

### Frontend Dependencies (Major)
- Next.js 16.0+ - React framework
- React 19.2+ - UI library
- TypeScript 5.9+ - Type safety
- Tailwind CSS 4.1+ - Styling (via @tailwindcss/postcss)
- ESLint 9.39+ - Linting (via eslint-config-next)

## 🔄 Recent Updates

### December 2024 - Major Dependency Updates

**Breaking Changes**:
- Stripe: Migrated to PaymentIntents API (transaction IDs now use `pi_` prefix)
- Tailwind CSS: New CSS-first configuration
- React: Removed JSX.Element type annotations
- ESLint: Migrated to flat config format

**See**: [UPDATE_SUMMARY.md](./UPDATE_SUMMARY.md) for details

## 📖 Documentation

- [UPDATE_SUMMARY.md](./UPDATE_SUMMARY.md) - Quick overview of recent updates
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Detailed migration instructions
- [DEPENDENCY_VERSIONS.md](./DEPENDENCY_VERSIONS.md) - Complete version list
- [TEST_CHECKLIST.md](./TEST_CHECKLIST.md) - Testing guidelines
- [CHANGELOG.md](./CHANGELOG.md) - Release notes

## 🤝 Contributing

1. Ensure Node.js 20+ is installed
2. Run `npm install` in both backend and frontend
3. Follow existing code style and conventions
4. Run linters and tests before committing
5. Update documentation as needed

## 📝 Code Style

- **Backend**: ESLint 9 with TypeScript plugin (flat config)
- **Frontend**: ESLint 9 via Next.js config
- **TypeScript**: Strict mode enabled
- **Imports**: Backend uses .js extensions, frontend does not

## 🐛 Troubleshooting

### Backend Issues

**Build fails:**
- Ensure TypeScript 5.7+ is installed
- Check that all imports use .js extensions

**Stripe errors:**
- Verify API key is correct
- Check that you're using test mode keys in development

### Frontend Issues

**Build fails:**
- Run `npm install` to ensure all dependencies are installed
- Clear `.next` folder: `rm -rf .next`

**Tailwind classes not working:**
- Ensure `@import "tailwindcss"` is in globals.css
- Check that @tailwindcss/postcss is in package.json

## 📄 License

ISC

## 🙋 Support

For issues or questions:
1. Check the documentation files
2. Review the TEST_CHECKLIST.md
3. Check the MIGRATION_GUIDE.md for breaking changes
4. Review official documentation for libraries used

---

**Status**: ✅ Production Ready  
**Last Updated**: December 2024  
**Build Status**: All Passing
