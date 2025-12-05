# PaymentHub Frontend

A Next.js 14 + React 19 frontend application for the unified payment API.

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **UI Library**: React 19
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 3
- **Database Client**: @supabase/supabase-js
- **Validation**: Zod
- **Utilities**: clsx

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout with Navbar
│   ├── page.tsx                # Landing page (Hero + Features)
│   ├── globals.css             # Tailwind + custom styles
│   └── dashboard/
│       └── page.tsx            # Dashboard with API key management
├── components/
│   ├── Navbar.tsx              # Navigation component
│   ├── Hero.tsx                # Hero section
│   └── Features.tsx            # Features section
├── lib/
│   ├── api.ts                  # API client utilities
│   └── supabase.ts             # Supabase browser client
├── tailwind.config.ts          # Tailwind configuration
├── next.config.js              # Next.js configuration
├── postcss.config.js           # PostCSS configuration
├── tsconfig.json               # TypeScript configuration
└── .env.example                # Environment variables template
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
cd frontend
npm install
```

### Environment Setup

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required environment variables:
- `NEXT_PUBLIC_API_BASE_URL` - Backend API base URL (default: http://localhost:3001)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_KEY` - Supabase anon key

### Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Building

Build for production:

```bash
npm run build
```

### Production

Start the production server:

```bash
npm start
```

### Linting & Type Checking

Run ESLint:

```bash
npm run lint
```

Run TypeScript type checker:

```bash
npm run type-check
```

## Pages

### Landing Page (`/`)
- Hero section with call-to-action
- Feature highlights
- Company statistics

### Dashboard (`/dashboard`)
- API key generation form
- List of existing API keys
- Copy-to-clipboard functionality
- Real-time integration with backend API

## API Integration

The `lib/api.ts` module provides an `ApiClient` class for making requests to the backend:

```typescript
import { apiClient } from '@/lib/api.js';

// Create a payment
const response = await apiClient.createPayment({
  amount: 10000,
  currency: 'USD',
  provider: 'stripe',
});

// Generate API key
const keyResponse = await apiClient.generateApiKey();

// Set API key for authenticated requests
apiClient.setApiKey('your-api-key');
```

## Supabase Integration

The `lib/supabase.ts` module provides utilities for browser-side Supabase operations:

```typescript
import { fetchApiKeys } from '@/lib/supabase.js';

const keys = await fetchApiKeys();
```

## Styling

The project uses Tailwind CSS with custom configuration:

- **Colors**: Primary (`#0066cc`), Secondary (`#6f42c1`)
- **Components**: Reusable utility classes for buttons, cards, inputs
- **Responsive**: Mobile-first design with breakpoints at sm, md, lg, xl

## TypeScript Configuration

The project uses strict TypeScript with:
- Strict null checks
- No implicit any
- No unused variables/parameters
- Complete ESM module resolution with `.js` extensions

## Contributing

Follow the existing code style:
- Use functional components with hooks
- Use TypeScript for all files
- Include proper type annotations
- Use `'use client'` for interactive components
- Import paths with `.js` extensions for ES modules

## License

ISC
