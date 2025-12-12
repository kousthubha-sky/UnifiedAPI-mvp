"""FastAPI dependency injection for shared resources.

Provides dependencies for:
- Redis client
- Supabase client
- Request tracing
- Rate limiting
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated, Any

import redis.asyncio as redis
import structlog
from fastapi import Depends, Header, Request
from supabase import Client as SupabaseClient

from app.config import Settings, get_settings
from app.app_logging import get_trace_id, set_trace_id

if TYPE_CHECKING:
    from redis.asyncio.client import Redis as AsyncRedis

# Global clients (initialized during lifespan)
_redis_client: AsyncRedis[str] | None = None
_supabase_client: SupabaseClient | None = None

logger = structlog.get_logger("dependencies")


def get_redis() -> Any:
    """Get the Redis client.

    Raises:
        RuntimeError: If Redis client is not initialized.
    """
    if _redis_client is None:
        raise RuntimeError("Redis client not initialized. Check application startup.")
    return _redis_client


def get_supabase() -> SupabaseClient:
    """Get the Supabase client.

    Raises:
        RuntimeError: If Supabase client is not initialized.
    """
    if _supabase_client is None:
        raise RuntimeError("Supabase client not initialized. Check application startup.")
    return _supabase_client


async def get_trace_id_dependency(
    request: Request,
    x_trace_id: Annotated[str | None, Header(alias="X-Trace-Id")] = None,
) -> str:
    """Extract or generate trace ID for request tracing.

    Checks for trace ID in:
    1. X-Trace-Id header
    2. X-Request-Id header
    3. Generates a new UUID if not present

    Args:
        request: The FastAPI request
        x_trace_id: Optional trace ID from header

    Returns:
        The trace ID for this request
    """
    # Check headers for existing trace ID
    trace_id = x_trace_id or request.headers.get("X-Request-Id")

    # Set in context and return
    return set_trace_id(trace_id)


async def get_api_key(
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> str | None:
    """Extract API key from request header.

    Args:
        x_api_key: The API key from X-API-Key header

    Returns:
        The API key or None if not provided
    """
    return x_api_key


async def get_client_ip(request: Request) -> str | None:
    """Extract client IP address from request.

    Checks X-Forwarded-For header first for proxied requests.

    Args:
        request: The FastAPI request

    Returns:
        The client IP address or None
    """
    # Check X-Forwarded-For for proxied requests
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # First IP in the list is the client
        return forwarded_for.split(",")[0].strip()

    # Fall back to direct client
    if request.client:
        return request.client.host

    return None


# Type aliases for dependency injection
SettingsDep = Annotated[Settings, Depends(get_settings)]
RedisDep = Annotated[Any, Depends(get_redis)]
SupabaseDep = Annotated[SupabaseClient, Depends(get_supabase)]
TraceIdDep = Annotated[str, Depends(get_trace_id_dependency)]
ApiKeyDep = Annotated[str | None, Depends(get_api_key)]
ClientIpDep = Annotated[str | None, Depends(get_client_ip)]


async def init_redis(settings: Settings) -> Any:
    """Initialize Redis client.

    Args:
        settings: Application settings

    Returns:
        Connected Redis client
    """
    global _redis_client

    logger.info("Connecting to Redis", url=settings.redis_url)

    _redis_client = redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
        retry_on_timeout=True,
        socket_connect_timeout=5.0,
        socket_timeout=5.0,
    )

    # Test connection
    await _redis_client.ping()
    logger.info("Redis connected successfully")

    return _redis_client


async def close_redis() -> None:
    """Close Redis connection."""
    global _redis_client

    if _redis_client is not None:
        logger.info("Closing Redis connection")
        await _redis_client.close()
        _redis_client = None


def init_supabase(settings: Settings) -> SupabaseClient | None:
    """Initialize Supabase client.

    Args:
        settings: Application settings

    Returns:
        Supabase client or None if not configured
    """
    global _supabase_client

    if not settings.supabase_url or not settings.supabase_anon_key:
        if not settings.is_test:
            logger.warning(
                "Supabase not configured",
                hint="Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables",
            )
        return None

    from supabase import create_client

    logger.info(
        "Connecting to Supabase",
        url=settings.supabase_url.replace("https://", ""),
    )

    _supabase_client = create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
    )

    logger.info("Supabase client initialized")

    return _supabase_client


def close_supabase() -> None:
    """Close Supabase client."""
    global _supabase_client

    if _supabase_client is not None:
        logger.info("Closing Supabase client")
        _supabase_client = None


def get_current_trace_id() -> str:
    """Get the current trace ID from context.

    This is a utility function for use outside of request context.
    """
    return get_trace_id()


async def get_current_user(
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    """Get current user from API key or auth token.

    For now, returns a mock user. In production, this would validate
    the API key against the database and return user info.

    Args:
        x_api_key: API key from header
        authorization: Authorization header

    Returns:
        User information dict

    Raises:
        HTTPException: If authentication fails
    """
    # TODO: Implement real authentication
    # For now, return mock user
    if not x_api_key and not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    # Mock user - replace with real auth logic
    return {
        "id": "mock_user_id",
        "email": "user@example.com"
    }


async def get_db() -> SupabaseClient:
    """Get database client for dependency injection.

    Returns:
        Supabase client

    Raises:
        RuntimeError: If database not configured
    """
    return get_supabase()
