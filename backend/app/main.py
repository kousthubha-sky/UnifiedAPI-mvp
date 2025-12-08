"""OneRouter Backend - FastAPI Application.

Main application module with lifespan management for Redis and Supabase clients.
"""

import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import ORJSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app import __version__


class ForceCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
from app.api_keys.routes import router as api_keys_router
from app.auth import authenticate_request
from app.config import get_settings
from app.customers.routes import router as customers_router
from app.dependencies import (
    close_redis,
    close_supabase,
    init_redis,
    init_supabase,
)
from app.errors import (
    APIError,
    ErrorCode,
    api_error_handler,
    create_error_response,
)
from app.app_logging import (
    configure_logging,
    get_logger,
    get_request_latency_ms,
    get_trace_id,
    request_log,
    response_log,
    set_trace_id,
    start_request_timer,
)
from app.payments.routes import router as payments_router
from app.rate_limiting import rate_limit_middleware

# Configure logging first
configure_logging()
logger = get_logger("main")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler.

    Initializes and cleans up:
    - Redis client
    - Supabase client

    The lifespan context manager ensures resources are properly
    initialized before the app starts and cleaned up on shutdown.
    """
    settings = get_settings()

    # Startup
    logger.info(
        "Starting OneRouter API",
        version=__version__,
        environment=settings.environment,
        python_version=sys.version.split()[0],
    )

    # Initialize Redis
    try:
        await init_redis(settings)
        redis_status = "connected"
    except Exception as e:
        logger.warning(
            "Redis connection failed, continuing without cache",
            error=str(e),
        )
        redis_status = "disconnected"

    # Initialize Supabase
    try:
        supabase_client = init_supabase(settings)
        supabase_status = "connected" if supabase_client else "not configured"
    except Exception as e:
        logger.warning(
            "Supabase initialization failed",
            error=str(e),
        )
        supabase_status = "error"

    # Print startup banner
    banner = f"""
{"=" * 70}
  OneRouter API Server Started
{"=" * 70}
  Server URL:    http://{settings.host if settings.host != "0.0.0.0" else "localhost"}:{settings.port}
  Documentation: http://{settings.host if settings.host != "0.0.0.0" else "localhost"}:{settings.port}/docs
  Health Check:  http://{settings.host if settings.host != "0.0.0.0" else "localhost"}:{settings.port}/health
  Redis:         {redis_status.capitalize()} on {settings.redis_url}
  Supabase:      {supabase_status.capitalize()}{" - " + settings.supabase_url.replace("https://", "") if settings.supabase_url else ""}
{"=" * 70}
  Environment:      {settings.environment}
  Python Version:   {sys.version.split()[0]}
  Log Level:        {settings.log_level}
{"=" * 70}
"""
    print(banner)

    logger.info(
        "Server started",
        type="SERVER_STARTED",
        host=settings.host,
        port=settings.port,
        redis_status=redis_status,
        supabase_status=supabase_status,
    )

    yield

    # Shutdown
    logger.info("Shutting down OneRouter API")

    await close_redis()
    close_supabase()

    logger.info("Server shutdown complete")


async def validation_error_handler(
    _request: Request,
    exc: RequestValidationError,
) -> ORJSONResponse:
    """Handle FastAPI validation errors.

    Converts Pydantic validation errors into the standard API error format.

    Args:
        _request: FastAPI request
        exc: The validation exception

    Returns:
        Standardized error response
    """
    # Extract error details from validation errors
    errors = exc.errors()
    error_details = []

    for error in errors:
        loc = error.get("loc", [])
        # Skip "body" prefix in location
        field_path = ".".join(str(part) for part in loc if part != "body")
        error_details.append(
            {
                "field": field_path,
                "message": error.get("msg", "Validation error"),
                "type": error.get("type", "value_error"),
            }
        )

    return create_error_response(
        code=ErrorCode.VALIDATION_ERROR,
        message="Request validation failed",
        status_code=400,
        details={"errors": error_details},
        trace_id=get_trace_id(),
    )


def custom_openapi(app: FastAPI) -> dict[str, Any]:
    """Generate custom OpenAPI schema with API key security scheme.

    Args:
        app: FastAPI application instance

    Returns:
        OpenAPI schema dictionary
    """
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="Unified Payment API",
        version=__version__,
        description=(
            "## Payment Orchestration API\n\n"
            "A unified payment processing API supporting multiple payment providers "
            "(Stripe and PayPal) through a single, consistent interface.\n\n"
            "### Features\n\n"
            "- **Multi-provider support**: Stripe and PayPal integration\n"
            "- **Idempotency**: Safe retries with idempotency keys\n"
            "- **Request tracing**: X-Trace-Id headers for debugging\n"
            "- **Rate limiting**: Tier-based rate limits\n"
            "- **Comprehensive filtering**: List payments with multiple filters\n\n"
            "### Authentication\n\n"
            "All endpoints (except `/health` and `POST /api/v1/customers`) require "
            "API key authentication via the `X-API-Key` header.\n\n"
            "```\n"
            "X-API-Key: pk_your_api_key_here\n"
            "```\n\n"
            "### Rate Limits\n\n"
            "| Tier | Requests/Minute |\n"
            "|------|----------------|\n"
            "| starter | 100 |\n"
            "| growth | 500 |\n"
            "| scale | 2000 |\n"
            "| admin | 10000 |\n"
        ),
        routes=app.routes,
        tags=[
            {
                "name": "health",
                "description": "Health check and server status endpoints",
            },
            {
                "name": "customers",
                "description": "Customer account management - create, read, update, delete customer profiles",
            },
            {
                "name": "api-keys",
                "description": "API key management - generate, list, rotate, and revoke API keys",
            },
            {
                "name": "payments",
                "description": "Payment operations - create payments, process refunds, check status",
            },
        ],
    )

    # Add security scheme
    openapi_schema["components"] = openapi_schema.get("components", {})
    openapi_schema["components"]["securitySchemes"] = {
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "API key for authentication. Get one from the dashboard or POST /api/v1/api-keys",
        }
    }

    # Add global security requirement (can be overridden per-operation)
    openapi_schema["security"] = [{"ApiKeyAuth": []}]

    # Add error response schemas
    openapi_schema["components"]["schemas"]["ErrorResponse"] = {
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "Error code (e.g., VALIDATION_ERROR, PAYMENT_FAILED)",
                "example": "VALIDATION_ERROR",
            },
            "error": {
                "type": "string",
                "description": "Human-readable error message",
                "example": "Request validation failed",
            },
            "details": {
                "type": "object",
                "description": "Additional error context",
                "additionalProperties": True,
                "nullable": True,
            },
            "trace_id": {
                "type": "string",
                "description": "Request trace ID for debugging",
                "example": "550e8400-e29b-41d4-a716-446655440000",
            },
        },
        "required": ["code", "error"],
    }

    # Add server information
    openapi_schema["servers"] = [
        {
            "url": "http://localhost:3000",
            "description": "Local development server",
        },
        {
            "url": "https://api.OneRouter.com",
            "description": "Production server",
        },
    ]

    # Add contact and license
    openapi_schema["info"]["contact"] = {
        "name": "OneRouter Support",
        "url": "https://OneRouter.com/support",
        "email": "support@OneRouter.com",
    }
    openapi_schema["info"]["license"] = {
        "name": "ISC",
        "url": "https://opensource.org/licenses/ISC",
    }

    app.openapi_schema = openapi_schema
    return app.openapi_schema


def create_app() -> FastAPI:
    """Create and configure the FastAPI application.

    Returns:
        Configured FastAPI application instance.
    """
    settings = get_settings()

    fastapi_app = FastAPI(
        title="Unified Payment API",
        description=(
            "Payment orchestration API with support for Stripe and PayPal, "
            "featuring exponential backoff, trace IDs, and comprehensive filtering."
        ),
        version=__version__,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
    )

    # Configure CORS
    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin.split(",") if settings.cors_origin != "*" else ["*"],
        allow_credentials=True,
        allow_methods=settings.cors_methods_list,
        allow_headers=["*"],
        expose_headers=[
            "X-Trace-Id",
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
        ],
    )

    # Force CORS headers on all responses
    fastapi_app.add_middleware(ForceCORSMiddleware)

    # Register exception handlers
    fastapi_app.add_exception_handler(APIError, api_error_handler)
    fastapi_app.add_exception_handler(RequestValidationError, validation_error_handler)

    # Combined logging, auth, and rate limiting middleware
    # Note: Middleware runs in reverse order of registration
    @fastapi_app.middleware("http")
    async def combined_middleware(request: Request, call_next: Any) -> Response:
        """Combined middleware for logging, authentication, and rate limiting."""
        # Extract or generate trace ID
        trace_id = request.headers.get("X-Trace-Id") or request.headers.get("X-Request-Id")
        set_trace_id(trace_id)

        # Start timing
        start_request_timer()

        # Get client IP
        client_ip = request.headers.get("X-Forwarded-For")
        if client_ip:
            client_ip = client_ip.split(",")[0].strip()
        elif request.client:
            client_ip = request.client.host

        # Log request
        request_log(
            method=request.method,
            url=str(request.url.path),
            ip=client_ip,
        )

        # Authenticate request (sets request.state.auth)
        try:
            await authenticate_request(
                request=request,
                settings=settings,
                x_api_key=request.headers.get("X-API-Key"),
                authorization=request.headers.get("Authorization"),
            )
        except APIError as auth_error:
            # Return auth error response
            response = create_error_response(
                code=auth_error.code,
                message=auth_error.message,
                status_code=auth_error.status_code,
                details=auth_error.details,
                trace_id=get_trace_id(),
            )
            response.headers["X-Trace-Id"] = get_trace_id()
            # Add CORS headers to error responses
            response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response

        # Apply rate limiting (after auth, so we have customer context)
        response = await rate_limit_middleware(request, call_next)

        # Log response with latency
        latency_ms = get_request_latency_ms()
        response_log(
            method=request.method,
            url=str(request.url.path),
            status_code=response.status_code,
            latency_ms=latency_ms,
        )

        # Add trace ID to response headers
        response.headers["X-Trace-Id"] = get_trace_id()

        return response

    # Health check endpoint
    @fastapi_app.get(
        "/health",
        tags=["health"],
        summary="Health Check",
        description="Returns server health status including timestamp.",
        response_model=dict[str, str],
        responses={
            200: {
                "description": "Server is healthy",
                "content": {
                    "application/json": {
                        "example": {
                            "status": "ok",
                            "timestamp": "2024-12-07T12:00:00.000Z",
                        }
                    }
                },
            }
        },
    )
    async def health_check() -> dict[str, str]:
        """Health check endpoint.

        Returns:
            Server health status with timestamp.
        """
        return {
            "status": "ok",
            "timestamp": datetime.now(UTC).isoformat(),
        }

    # Metrics endpoint
    @fastapi_app.get(
        "/api/v1/metrics",
        tags=["metrics"],
        summary="Get usage metrics",
        description="Retrieve API usage metrics and statistics.",
        response_model=dict,
    )
    async def get_metrics() -> dict:
        """Get usage metrics for the API."""
        # TODO: Implement real metrics collection
        # For now, return dummy data
        return {
            "total_requests": 1234,
            "total_success": 1200,
            "total_errors": 34,
            "success_rate": 97.2,
            "daily_metrics": [
                {"date": "2024-12-01", "requests": 100, "success": 95, "errors": 5},
                {"date": "2024-12-02", "requests": 120, "success": 115, "errors": 5},
                {"date": "2024-12-03", "requests": 90, "success": 88, "errors": 2},
                {"date": "2024-12-04", "requests": 150, "success": 145, "errors": 5},
                {"date": "2024-12-05", "requests": 200, "success": 195, "errors": 5},
                {"date": "2024-12-06", "requests": 180, "success": 175, "errors": 5},
                {"date": "2024-12-07", "requests": 294, "success": 287, "errors": 7},
            ]
        }

    # Root endpoint
    @fastapi_app.get(
        "/",
        tags=["health"],
        summary="Root",
        description="API information endpoint.",
        include_in_schema=False,
    )
    async def root() -> dict[str, str]:
        """Root endpoint with API information."""
        return {
            "name": "Unified Payment API",
            "version": __version__,
            "docs": "/docs",
            "health": "/health",
        }

    # Register routers
    fastapi_app.include_router(customers_router)
    fastapi_app.include_router(api_keys_router)
    fastapi_app.include_router(payments_router)

    # Set custom OpenAPI schema
    fastapi_app.openapi = lambda: custom_openapi(fastapi_app)

    return fastapi_app


# Create the application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.is_development,
        log_level=settings.log_level,
    )
