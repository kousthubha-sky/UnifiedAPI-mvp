# Changelog

All notable changes to the OneRouter SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2024-12-06

### Added

- **Environment-Aware Configuration**
  - Automatic environment detection (local/staging/production)
  - Hostname-based detection (.lc/.st/.pr)
  - Environment-specific default configurations
  - `UNIFIED_ENV` and `NODE_ENV` support

- **Auto-Validation & Health Monitoring**
  - API key format validation
  - Automatic connectivity validation on client creation
  - Comprehensive health check API (`healthCheck()`)
  - Service-level health monitoring (API, auth, payments, customers)

- **Metrics & Performance Monitoring**
  - Built-in request metrics tracking
  - Performance statistics (latency, success rate, request counts)
  - Environment-aware metric tagging
  - Memory-efficient metrics storage (last 150 requests)

- **Request/Response Interceptors**
  - Customizable request interceptors for request modification
  - Response interceptors for data transformation
  - Error interceptors for error handling and transformation
  - Support for async interceptor functions

- **Performance Optimizations**
  - HTTP/2 support with connection keep-alive
  - Automatic request compression for large payloads
  - Response caching for read operations (GET requests)
  - Optimized retry logic with exponential backoff

- **Enhanced API Features**
  - `getMetrics()` - Access request metrics
  - `healthCheck()` - Comprehensive health validation
  - `detectEnvironment()` - Environment detection utility
  - `mergeConfig()` - Configuration merging utility
  - `validateApiKey()` - API key validation utility

- **UnifiedAPIClient**: Main SDK client with configurable options
  - API key authentication
  - Configurable timeout (default: 30s)
  - Automatic retry with exponential backoff (default: 3 retries)
  - Optional HMAC request signing
  - Automatic trace ID generation

- **Payments Resource**
  - `payments.create()` - Create a new payment
  - `payments.refund()` - Refund a payment (full or partial)
  - `payments.list()` - List payments with filtering and pagination
  - `payments.get()` - Get a single payment by ID

- **Customers Resource**
  - `customers.create()` - Create a customer
  - `customers.update()` - Update customer information
  - `customers.list()` - List customers with pagination

- **API Keys Resource**
  - `apiKeys.create()` - Create API keys
  - `apiKeys.list()` - List API keys
  - `apiKeys.update()` - Update/revoke API keys
  - `apiKeys.delete()` - Delete API keys

- **Idempotency Support**
  - Pass `idempotencyKey` in request options for safe retries

- **Rich Error Classes**
  - `OneRouterError` - Base error class
  - `ValidationError` - Request validation errors
  - `AuthenticationError` - API key issues
  - `ForbiddenError` - Access denied
  - `NotFoundError` - Resource not found
  - `PaymentNotFoundError` - Payment not found
  - `RateLimitError` - Rate limit exceeded (with `retryAfter`)
  - `PaymentError` - Payment operation failed
  - `RefundError` - Refund operation failed
  - `ProviderError` - Payment provider error
  - `NetworkError` - Network connectivity issue
  - `TimeoutError` - Request timed out
  - `InternalError` - Server error

- **Type Guards**
  - `isOneRouterError()` - Check if error is SDK error
  - `isRetryableError()` - Check if error is retryable

- **Testing Support**
  - `MockTransport` class for unit testing
  - `UnifiedAPIClient.withMockTransport()` factory method
  - Request logging for verification
  - 95%+ test coverage

- **Build System**
  - tsup bundler configuration
  - Dual ESM/CJS output
  - TypeScript declarations for both module systems
  - Source maps

- **Documentation**
  - Comprehensive README with examples
  - API reference documentation
  - Environment configuration guide
  - Troubleshooting guide
  - Migration guides

### Technical Details

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.7
- **Module Format**: ESM (primary), CJS (compatibility)
- **Test Framework**: Vitest
- **Bundler**: tsup

### Dependencies

- No runtime dependencies (uses native `fetch`)
- Development dependencies:
  - TypeScript 5.7
  - tsup 8.x
  - Vitest 2.x
  - ESLint 9.x

---

## Version Strategy

This SDK follows semantic versioning:

- **Major** (1.0.0): Breaking changes to the public API
- **Minor** (0.1.0): New features, backward compatible
- **Patch** (0.0.1): Bug fixes, backward compatible

### Pre-release Tags

- `alpha` - Early development, unstable API
- `beta` - Feature complete, API may change
- `rc` - Release candidate, final testing

Example: `1.0.0-beta.1`

### npm Tags

- `latest` - Stable release (default)
- `next` - Pre-release versions
- `canary` - Development builds

---

## Migration Guides

### Migrating from 0.x to 1.0 (Future)

_Migration guide will be added when 1.0 is released._
