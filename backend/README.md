# Unified Payment API - Backend (Python/FastAPI)

A robust Python FastAPI backend service for processing payments across multiple providers (Stripe and PayPal) with built-in rate limiting, authentication, and comprehensive logging.

## Features

- **Multi-Provider Payment Processing**: Support for Stripe and PayPal adapters
- **Type-Safe**: Full type hints with Pydantic models and mypy strict mode
- **REST API with OpenAPI**: Interactive Swagger UI and ReDoc documentation
- **Authentication**: Database-backed API key validation with Redis caching
- **Rate Limiting**: Per-tier rate limiting with Redis and SlowAPI
- **Structured Logging**: Structlog with JSON output in production (Pino-compatible fields)
- **Error Handling**: Centralized error handling with domain-specific error mapping
- **Caching**: Redis-backed caching for performance optimization
- **Database Integration**: Supabase PostgreSQL for schema, customers, and audit logs
- **Async First**: Built on async/await for high performance

## Requirements

- Python 3.11+
- Redis (for caching and rate limiting)
- Supabase account (for database)

## Project Structure

```
backend/
├── app/
│   ├── __init__.py           # Package initialization
│   ├── main.py               # FastAPI application & lifespan
│   ├── config.py             # Pydantic settings configuration
│   ├── logging.py            # Structured logging (structlog)
│   └── dependencies.py       # Dependency injection
├── db/
│   └── migrations/           # Database migrations
├── tests/
│   └── test_health.py        # Test suite
├── pyproject.toml            # Project configuration & dependencies
├── Dockerfile                # Container configuration
├── docker-compose.yml        # Local development setup
├── .env.example              # Environment template
└── README.md                 # This file
```

## Quick Start

### 1. Create Virtual Environment

```bash
# Using uv (recommended)
uv venv
source .venv/bin/activate

# Or using standard venv
python -m venv .venv
source .venv/bin/activate
```

### 2. Install Dependencies

```bash
# Using uv (fast)
uv pip install -e ".[dev]"

# Or using pip
pip install -e ".[dev]"
```

### 3. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your credentials
nano .env
```

### 4. Start Development Server

```bash
# With auto-reload
uvicorn app.main:app --reload --port 3001

# Or using Python directly
python -m app.main
```

The server will be available at:
- **API**: http://localhost:3001
- **Swagger UI**: http://localhost:3001/docs
- **ReDoc**: http://localhost:3001/redoc
- **Health Check**: http://localhost:3001/health

## Development Commands

### Run Server

```bash
# Development with hot reload
uvicorn app.main:app --reload --port 3001

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 3001 --workers 4
```

### Run Tests

```bash
# Run all tests
pytest

# With coverage
pytest --cov=app --cov-report=html

# Verbose output
pytest -v
```

### Linting & Formatting

```bash
# Lint with Ruff
ruff check app tests

# Fix lint issues
ruff check --fix app tests

# Format code
ruff format app tests
```

### Type Checking

```bash
# Run mypy
mypy app
```

## Docker

### Build Image

```bash
# Production build
docker build -t payment-hub-backend .

# Development build
docker build --target development -t payment-hub-backend:dev .
```

### Run Container

```bash
# Run production container
docker run -p 3001:3001 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_ANON_KEY=your-key \
  payment-hub-backend
```

### Docker Compose

```bash
# Start all services (backend + Redis)
docker compose up

# Start in background
docker compose up -d

# View logs
docker compose logs -f backend

# Stop services
docker compose down
```

## Configuration

### Environment Variables

All configuration is via environment variables. The application maintains backward compatibility with the Node.js backend's environment variable names.

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production/test) | `development` |
| `LOG_LEVEL` | Logging level (debug/info/warning/error) | `info` |
| `PORT` | Server port | `3001` |
| `HOST` | Server host | `0.0.0.0` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `SUPABASE_URL` | Supabase project URL | - |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | - |
| `STRIPE_API_KEY` | Stripe API key | - |
| `PAYPAL_CLIENT_ID` | PayPal client ID | - |
| `PAYPAL_CLIENT_SECRET` | PayPal client secret | - |
| `CORS_ORIGIN` | CORS allowed origins | `*` |

See `.env.example` for a complete list.

### Logging

The application uses structured logging with fields compatible with the previous Pino-based logging:

| Field | Description |
|-------|-------------|
| `type` | Log type (REQUEST, RESPONSE, AUDIT, ERROR) |
| `trace_id` | Request trace ID (from `X-Trace-Id` header or generated) |
| `timestamp` | ISO 8601 timestamp |
| `level` | Log level |
| `method` | HTTP method |
| `url` | Request URL |
| `status_code` | Response status code |
| `latency_ms` | Request latency in milliseconds |
| `duration` | Human-readable duration (e.g., "42.5ms") |
| `ip` | Client IP address |

**Development Output** (pretty-printed):
```
2024-01-15 10:30:45 [info     ] Request received    method=GET url=/health ip=127.0.0.1 trace_id=abc-123
2024-01-15 10:30:45 [info     ] Response sent       method=GET url=/health status_code=200 latency_ms=1.5
```

**Production Output** (JSON):
```json
{"timestamp":"2024-01-15T10:30:45.123456+00:00","level":"info","type":"RESPONSE","method":"GET","url":"/health","status_code":200,"latency_ms":1.5,"trace_id":"abc-123"}
```

## API Endpoints

### Health Check

```
GET /health
```

Returns server health status.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:45.123456+00:00"
}
```

### API Documentation

| Endpoint | Description |
|----------|-------------|
| `GET /docs` | Swagger UI |
| `GET /redoc` | ReDoc |
| `GET /openapi.json` | OpenAPI schema |

## Database Setup

The database schema remains the same as the Node.js backend. Run the migrations from `db/migrations/001_initial_schema.sql` in your Supabase SQL editor.

### Tables

- **customers**: Customer accounts and subscription tiers
- **api_keys**: API keys for authentication
- **audit_logs**: Audit trail of all API requests
- **usage_stats**: Daily usage statistics per customer
- **payments**: Payment transaction records

See `db/README.md` for complete schema details.

## Architecture

### Application Lifespan

The FastAPI application uses a lifespan context manager for proper resource management:

1. **Startup**:
   - Configure structured logging
   - Initialize Redis connection
   - Initialize Supabase client
   - Log startup banner

2. **Shutdown**:
   - Close Redis connection
   - Clean up Supabase client

### Dependency Injection

Dependencies are provided via FastAPI's dependency injection system:

```python
from app.dependencies import RedisDep, SupabaseDep, TraceIdDep

@app.get("/example")
async def example(
    redis: RedisDep,
    supabase: SupabaseDep,
    trace_id: TraceIdDep,
):
    ...
```

### Request Tracing

Every request includes a trace ID for distributed tracing:

1. Check `X-Trace-Id` or `X-Request-Id` header
2. Generate UUID if not provided
3. Include in all log entries
4. Return in `X-Trace-Id` response header

## Migration from Node.js

This FastAPI backend is a drop-in replacement for the Node.js/Fastify backend:

- Same port (3001) and endpoints
- Same environment variable names
- Same database schema
- Compatible logging format
- Same CORS configuration

The frontend and SDK continue to work without changes.

## Troubleshooting

### Redis Connection Failed

If Redis is not available, the server will start with a warning:
```
WARNING: Redis connection failed, continuing without cache
```

For full functionality, ensure Redis is running:
```bash
# Using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or install locally
redis-server
```

### Supabase Not Configured

Without Supabase credentials, database features will be unavailable:
```
WARNING: Supabase not configured
```

Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in your `.env` file.

### Import Errors

Ensure you're running from the backend directory with the virtual environment activated:
```bash
cd backend
source .venv/bin/activate
```

## License

ISC
