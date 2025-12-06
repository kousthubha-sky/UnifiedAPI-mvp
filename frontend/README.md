# PaymentHub Frontend

A Next.js 15 + React 19 frontend application for the unified payment API.

![Landing Page](https://via.placeholder.com/800x400?text=PaymentHub+Landing+Page)

## Features

### Marketing Landing Page
- **Hero Section**: Eye-catching hero with code preview and stats
- **Feature Highlights**: One API, Auto Retry, Fast Setup benefits
- **Comprehensive Features**: 6 feature cards showcasing all capabilities
- **Pricing Tiers**: Starter, Growth, and Scale plans with feature comparison
- **Testimonials**: Customer success stories
- **Footer**: Complete site navigation and social links

### API Documentation (`/docs`)
- **Authentication Guide**: How to use API keys and headers
- **Code Examples**: Ready-to-copy snippets in cURL, Node.js, and Python
- **Interactive Swagger**: Embedded Swagger UI for trying API requests
- **Error Handling**: Complete error code reference

### Dashboard (`/dashboard`)
- **API Key Management**: Generate, revoke, and delete API keys
- **Account Settings**: View account info and configure provider credentials
- **Usage Analytics**: Interactive charts showing request volume and success rates

### Authentication
- **Email/Password Login**: Traditional authentication
- **Magic Link**: Passwordless email authentication
- **Session Management**: Secure token-based sessions via Supabase Auth

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **UI Library**: React 19
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4
- **Auth**: Supabase Auth
- **State**: React Context API
- **Utilities**: clsx, zod

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout with AuthProvider
│   ├── page.tsx                # Marketing landing page
│   ├── globals.css             # Tailwind + custom styles
│   ├── dashboard/
│   │   └── page.tsx            # Multi-tab dashboard
│   ├── docs/
│   │   └── page.tsx            # API documentation
│   ├── login/
│   │   └── page.tsx            # Login page
│   └── signup/
│       └── page.tsx            # Signup page
├── components/
│   ├── Navbar.tsx              # Navigation with auth state
│   ├── Hero.tsx                # Landing hero section
│   ├── Features.tsx            # Feature grid
│   ├── FeatureHighlights.tsx   # Key benefits section
│   ├── Pricing.tsx             # Pricing tiers
│   ├── Testimonials.tsx        # Customer testimonials
│   └── ui/
│       ├── Alert.tsx           # Alert/notification component
│       ├── Card.tsx            # Card component
│       ├── EmptyState.tsx      # Empty state component
│       ├── LoadingSpinner.tsx  # Loading indicator
│       └── Tabs.tsx            # Tab navigation
├── lib/
│   ├── api.ts                  # API client utilities
│   ├── auth-context.tsx        # Authentication context
│   ├── supabase.ts             # Supabase client
│   └── use-metrics.ts          # Usage metrics hook
├── tailwind.config.ts          # Tailwind configuration
├── next.config.js              # Next.js configuration
├── postcss.config.js           # PostCSS configuration
└── tsconfig.json               # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Supabase project (for authentication)

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

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL | `http://localhost:3001` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Required |
| `NEXT_PUBLIC_SUPABASE_KEY` | Supabase anon key | Required |
| `NEXT_PUBLIC_DOCS_URL` | Swagger docs URL | `${API_BASE_URL}/docs` |

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

Full marketing page with:
- Hero with animated code preview
- Feature highlights (One API, Auto Retry, Fast Setup)
- Comprehensive feature grid
- Three-tier pricing table
- Customer testimonials carousel
- CTA sections
- Footer with navigation

![Landing Page Hero](https://via.placeholder.com/600x300?text=Hero+Section)

### Documentation (`/docs`)

Developer-focused documentation:
- Authentication section with header examples
- Base URL configuration
- SDK installation instructions
- Code examples in cURL, Node.js, Python
- Error handling reference
- Embedded Swagger UI for interactive testing

![Documentation Page](https://via.placeholder.com/600x300?text=API+Documentation)

### Dashboard (`/dashboard`)

Protected multi-tab dashboard:
- **API Keys Tab**: Generate, view, revoke, delete API keys
- **Settings Tab**: Account info, tier, provider credentials
- **Usage Tab**: Request metrics with bar charts

![Dashboard](https://via.placeholder.com/600x300?text=Dashboard)

### Login (`/login`)

Authentication page with:
- Email/password login
- Magic link (passwordless) option
- Link to signup

### Signup (`/signup`)

Registration page with:
- Email/password registration
- Password strength requirements
- Plan selection support via query params

## Authentication Flow

1. User visits `/signup` or `/login`
2. Creates account via Supabase Auth
3. Customer record created in backend
4. Session stored in Supabase
5. Auth context provides user state to components
6. Protected routes redirect to `/login` if unauthenticated

## API Integration

The frontend connects to the backend API via two mechanisms:

### Direct API Calls (via auth-context)

```typescript
const { generateApiKey, updateCustomer } = useAuth();

// Generate new API key
const { key, error } = await generateApiKey('my-key-name');

// Update customer settings
await updateCustomer({ stripe_account_id: 'acct_xxx' });
```

### Legacy API Client

```typescript
import { apiClient } from '@/lib/api';

apiClient.setApiKey('your-api-key');
const response = await apiClient.createPayment({...});
```

## Styling

Tailwind CSS 4 with custom theme:

- **Primary**: `#0066cc` (blue)
- **Secondary**: `#6f42c1` (purple)
- **Custom Components**: `.btn`, `.btn-primary`, `.card`, `.input`

## Responsive Design

All pages are mobile-first with breakpoints:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

## Contributing

Follow the existing code style:
- Use functional components with hooks
- Use TypeScript for all files
- Include proper type annotations
- Use `'use client'` for interactive components
- Use the `useAuth` hook for authentication state

## License

ISC
