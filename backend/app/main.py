"""PaymentHub Backend - FastAPI Application.

Main application module with lifespan management for Redis and Supabase clients.
"""

import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app import __version__
from app.auth import authenticate_request
from app.config import get_settings
from app.dependencies import (
    close_redis,
    close_supabase,
    init_redis,
    init_supabase,
)
from app.errors import (
    APIError,
    api_error_handler,
    create_error_response,
)
from app.logging import (
    configure_logging,
    get_logger,
    get_request_latency_ms,
    request_log,
    response_log,
    set_trace_id,
    start_request_timer,
)
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
        "Starting PaymentHub API",
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
{"═" * 70}
  🚀 PaymentHub API Server Started
{"═" * 70}
  📍 Server URL:    http://{settings.host if settings.host != "0.0.0.0" else "localhost"}:{settings.port}
  📚 Documentation: http://{settings.host if settings.host != "0.0.0.0" else "localhost"}:{settings.port}/docs
  💚 Health Check:  http://{settings.host if settings.host != "0.0.0.0" else "localhost"}:{settings.port}/health
  🔴 Redis:         {redis_status.capitalize()} on {settings.redis_url}
  🗄️  Supabase:      {supabase_status.capitalize()}{" - " + settings.supabase_url.replace("https://", "") if settings.supabase_url else ""}
{"═" * 70}
  Environment:      {settings.environment}
  Python Version:   {sys.version.split()[0]}
  Log Level:        {settings.log_level}
{"═" * 70}
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
    logger.info("Shutting down PaymentHub API")

    await close_redis()
    close_supabase()

    logger.info("Server shutdown complete")


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

    # Register exception handlers
    fastapi_app.add_exception_handler(APIError, api_error_handler)

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
            )
        except APIError as auth_error:
            # Return auth error response
            from app.logging import get_trace_id

            response = create_error_response(
                code=auth_error.code,
                message=auth_error.message,
                status_code=auth_error.status_code,
                details=auth_error.details,
                trace_id=get_trace_id(),
            )
            response.headers["X-Trace-Id"] = get_trace_id()
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
        from app.logging import get_trace_id

        response.headers["X-Trace-Id"] = get_trace_id()

        return response

    # Health check endpoint
    @fastapi_app.get(
        "/health",
        tags=["health"],
        summary="Health Check",
        description="Returns server health status.",
        response_model=dict[str, str],
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
