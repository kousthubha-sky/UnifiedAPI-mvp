"""Token-bucket rate limiting backed by Redis.

Implements tier-based rate limiting with:
- starter: 100 requests/minute
- growth: 500 requests/minute
- scale: 2000 requests/minute
- admin: 10000 requests/minute (effectively unlimited)

Emits X-RateLimit-* headers and returns 429 responses with RATE_LIMIT_EXCEEDED code.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import structlog
from fastapi import Request, Response

from app.auth import PUBLIC_ROUTES, AuthContext, _get_route_key

if TYPE_CHECKING:
    pass

logger = structlog.get_logger("rate_limiting")

# Rate limits per tier (requests per minute)
TIER_LIMITS: dict[str, int] = {
    "starter": 100,
    "growth": 500,
    "scale": 2000,
    "admin": 10000,
    "public": 60,  # For public endpoints without auth
}

# Window size in seconds
RATE_LIMIT_WINDOW = 60

# Redis key prefix for rate limiting
RATE_LIMIT_KEY_PREFIX = "ratelimit"


@dataclass
class RateLimitInfo:
    """Rate limit status information.

    Attributes:
        limit: Maximum requests allowed in the window
        remaining: Requests remaining in current window
        reset_at: Unix timestamp when the window resets
        is_exceeded: Whether the limit has been exceeded
    """

    limit: int
    remaining: int
    reset_at: int
    is_exceeded: bool


def _get_rate_limit_key(identifier: str) -> str:
    """Generate Redis key for rate limiting.

    Args:
        identifier: Unique identifier (customer_id, IP, or api_key)

    Returns:
        Redis key string
    """
    return f"{RATE_LIMIT_KEY_PREFIX}:{identifier}"


def _get_identifier(request: Request, auth_ctx: AuthContext | None) -> str:
    """Get a unique identifier for rate limiting.

    Priority:
    1. customer_id if authenticated
    2. API key hash if present
    3. Client IP address

    Args:
        request: The FastAPI request
        auth_ctx: Authentication context if available

    Returns:
        Unique identifier string
    """
    if auth_ctx and auth_ctx.customer_id:
        return f"customer:{auth_ctx.customer_id}"

    # Fall back to client IP
    client_ip = request.headers.get("X-Forwarded-For")
    if client_ip:
        client_ip = client_ip.split(",")[0].strip()
    elif request.client:
        client_ip = request.client.host
    else:
        client_ip = "unknown"

    return f"ip:{client_ip}"


def _get_tier_limit(auth_ctx: AuthContext | None) -> int:
    """Get rate limit for the authentication context's tier.

    Args:
        auth_ctx: Authentication context

    Returns:
        Requests per minute limit
    """
    if auth_ctx is None:
        return TIER_LIMITS.get("public", 60)

    tier = auth_ctx.tier.lower()
    return TIER_LIMITS.get(tier, TIER_LIMITS["starter"])


async def check_rate_limit(
    redis_client: Any,
    identifier: str,
    limit: int,
) -> RateLimitInfo:
    """Check and update rate limit using token bucket algorithm.

    Uses Redis to maintain a sliding window counter.

    Args:
        redis_client: Redis client instance
        identifier: Unique identifier for the client
        limit: Maximum requests allowed per window

    Returns:
        RateLimitInfo with current status
    """
    if redis_client is None:
        # If Redis is not available, allow all requests
        now = int(time.time())
        return RateLimitInfo(
            limit=limit,
            remaining=limit,
            reset_at=now + RATE_LIMIT_WINDOW,
            is_exceeded=False,
        )

    key = _get_rate_limit_key(identifier)
    now = int(time.time())
    window_start = now - RATE_LIMIT_WINDOW

    try:
        # Use Redis pipeline for atomic operations
        pipe = redis_client.pipeline()

        # Remove old entries outside the window
        pipe.zremrangebyscore(key, 0, window_start)

        # Count current requests in the window
        pipe.zcard(key)

        # Execute pipeline
        results = await pipe.execute()
        current_count = results[1]

        remaining = max(0, limit - current_count)
        is_exceeded = current_count >= limit

        # Calculate reset time (end of current window)
        # Get the oldest request timestamp to calculate actual reset
        oldest = await redis_client.zrange(key, 0, 0, withscores=True)
        if oldest:
            oldest_time = int(oldest[0][1])
            reset_at = oldest_time + RATE_LIMIT_WINDOW
        else:
            reset_at = now + RATE_LIMIT_WINDOW

        if not is_exceeded:
            # Add current request to the sorted set
            await redis_client.zadd(key, {str(now): now})
            # Set expiry on the key
            await redis_client.expire(key, RATE_LIMIT_WINDOW * 2)
            remaining = max(0, remaining - 1)

        return RateLimitInfo(
            limit=limit,
            remaining=remaining,
            reset_at=reset_at,
            is_exceeded=is_exceeded,
        )

    except Exception as e:
        logger.warning("Rate limit check failed", error=str(e))
        # On error, allow the request
        return RateLimitInfo(
            limit=limit,
            remaining=limit,
            reset_at=now + RATE_LIMIT_WINDOW,
            is_exceeded=False,
        )


def add_rate_limit_headers(response: Response, info: RateLimitInfo) -> None:
    """Add rate limit headers to response.

    Headers:
    - X-RateLimit-Limit: Maximum requests allowed
    - X-RateLimit-Remaining: Requests remaining in window
    - X-RateLimit-Reset: Unix timestamp when window resets

    Args:
        response: FastAPI response
        info: Rate limit status
    """
    response.headers["X-RateLimit-Limit"] = str(info.limit)
    response.headers["X-RateLimit-Remaining"] = str(info.remaining)
    response.headers["X-RateLimit-Reset"] = str(info.reset_at)


def is_rate_limit_exempt(method: str, path: str) -> bool:
    """Check if a route is exempt from rate limiting.

    Exemptions include public routes and documentation endpoints.

    Args:
        method: HTTP method
        path: Request path

    Returns:
        True if exempt from rate limiting
    """
    route_key = _get_route_key(method, path)
    return route_key in PUBLIC_ROUTES


async def rate_limit_middleware(
    request: Request,
    call_next: Any,
) -> Response:
    """Middleware to enforce rate limiting.

    This middleware:
    1. Checks if the route is exempt
    2. Gets the auth context from request state
    3. Checks rate limit against Redis
    4. Adds rate limit headers to response
    5. Returns 429 if limit exceeded

    Args:
        request: FastAPI request
        call_next: Next middleware/handler

    Returns:
        Response with rate limit headers
    """
    method = request.method
    path = request.url.path

    # Skip rate limiting for exempt routes
    if is_rate_limit_exempt(method, path):
        return await call_next(request)

    # Get auth context if available
    auth_ctx: AuthContext | None = None
    if hasattr(request.state, "auth"):
        auth_ctx = request.state.auth

    # Get identifier and limit
    identifier = _get_identifier(request, auth_ctx)
    limit = _get_tier_limit(auth_ctx)

    # Get Redis client
    redis_client = None
    try:
        from app.dependencies import _redis_client

        redis_client = _redis_client
    except ImportError:
        pass

    # Check rate limit
    rate_info = await check_rate_limit(redis_client, identifier, limit)

    if rate_info.is_exceeded:
        logger.warning(
            "Rate limit exceeded",
            identifier=identifier,
            limit=rate_info.limit,
            tier=auth_ctx.tier if auth_ctx else "public",
        )

        # Create rate limit error response
        from app.errors import ErrorCode, create_error_response

        response = create_error_response(
            code=ErrorCode.RATE_LIMIT_EXCEEDED,
            message="Rate limit exceeded. Please try again later.",
            status_code=429,
            details={
                "limit": rate_info.limit,
                "remaining": rate_info.remaining,
                "reset_at": rate_info.reset_at,
                "retry_after": rate_info.reset_at - int(time.time()),
            },
        )
        add_rate_limit_headers(response, rate_info)
        response.headers["Retry-After"] = str(rate_info.reset_at - int(time.time()))
        return response

    # Process request
    response = await call_next(request)

    # Add rate limit headers to successful responses
    add_rate_limit_headers(response, rate_info)

    return response


async def get_rate_limit_info(
    request: Request,
) -> RateLimitInfo:
    """Dependency to get current rate limit information.

    Use this to include rate limit info in response bodies if needed.

    Args:
        request: FastAPI request

    Returns:
        RateLimitInfo with current status
    """
    auth_ctx: AuthContext | None = None
    if hasattr(request.state, "auth"):
        auth_ctx = request.state.auth

    identifier = _get_identifier(request, auth_ctx)
    limit = _get_tier_limit(auth_ctx)

    redis_client = None
    try:
        from app.dependencies import _redis_client

        redis_client = _redis_client
    except ImportError:
        pass

    return await check_rate_limit(redis_client, identifier, limit)
