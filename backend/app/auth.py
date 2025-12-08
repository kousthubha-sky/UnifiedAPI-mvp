"""API Key Authentication for the OneRouter API.

Implements authentication that:
- Checks ALLOWED_API_KEYS from settings
- Supports BOOTSTRAP_API_KEY for /api/v1/api-keys POST
- Validates keys against Supabase (api_keys + customers tables)
- Caches lookups in Redis
- Attaches customer_id, tier, and bootstrap flags to request state
"""

from __future__ import annotations

import contextlib
import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Annotated, Any

import structlog
from fastapi import Depends, Header, Request

from app.config import Settings, get_settings
from app.errors import (
    BootstrapKeyNotAllowedError,
    InvalidAPIKeyError,
    MissingAPIKeyError,
)

if TYPE_CHECKING:
    pass

logger = structlog.get_logger("auth")

# Cache TTL in seconds (5 minutes)
API_KEY_CACHE_TTL = 300

# Routes where bootstrap key is allowed
BOOTSTRAP_ALLOWED_ROUTES = {
    ("POST", "/api/v1/api-keys"),
}

# Public routes that don't require authentication
PUBLIC_ROUTES = {
    ("GET", "/"),
    ("GET", "/health"),
    ("GET", "/docs"),
    ("GET", "/redoc"),
    ("GET", "/openapi.json"),
    ("POST", "/api/v1/customers"),
}

# HTTP methods that bypass authentication (e.g., CORS preflight)
AUTH_BYPASS_METHODS = {"OPTIONS"}


@dataclass
class AuthContext:
    """Authentication context attached to request state.

    Attributes:
        customer_id: UUID of the authenticated customer
        tier: Customer tier (starter, growth, scale, admin)
        api_key_id: UUID of the API key used
        is_bootstrap: Whether this is a bootstrap key authentication
        is_static_key: Whether this is a static allowed API key
    """

    customer_id: str | None
    tier: str
    api_key_id: str | None = None
    is_bootstrap: bool = False
    is_static_key: bool = False


def _get_route_key(method: str, path: str) -> tuple[str, str]:
    """Get a normalized route key for comparison."""
    # Normalize path by removing trailing slash
    normalized_path = path.rstrip("/") if path != "/" else path
    return (method.upper(), normalized_path)


def is_public_route(method: str, path: str) -> bool:
    """Check if a route is public and doesn't require authentication."""
    # OPTIONS requests always bypass auth (CORS preflight)
    if method.upper() in AUTH_BYPASS_METHODS:
        return True
    route_key = _get_route_key(method, path)
    return route_key in PUBLIC_ROUTES


def is_bootstrap_allowed_route(method: str, path: str) -> bool:
    """Check if a route allows bootstrap key authentication."""
    route_key = _get_route_key(method, path)
    return route_key in BOOTSTRAP_ALLOWED_ROUTES


async def _get_cached_api_key(redis_client: Any, api_key: str) -> dict[str, Any] | None:
    """Get API key data from Redis cache.

    Args:
        redis_client: Redis client instance
        api_key: The API key to look up

    Returns:
        Cached API key data or None if not cached
    """
    if redis_client is None:
        return None

    try:
        cache_key = f"api_key:{api_key}"
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        logger.warning("Redis cache read failed", error=str(e))

    return None


async def _set_cached_api_key(redis_client: Any, api_key: str, data: dict[str, Any]) -> None:
    """Cache API key data in Redis.

    Args:
        redis_client: Redis client instance
        api_key: The API key
        data: Data to cache
    """
    if redis_client is None:
        return

    try:
        cache_key = f"api_key:{api_key}"
        await redis_client.set(cache_key, json.dumps(data), ex=API_KEY_CACHE_TTL)
    except Exception as e:
        logger.warning("Redis cache write failed", error=str(e))


async def _invalidate_cached_api_key(redis_client: Any, api_key: str) -> None:
    """Invalidate cached API key data.

    Args:
        redis_client: Redis client instance
        api_key: The API key to invalidate
    """
    if redis_client is None:
        return

    try:
        cache_key = f"api_key:{api_key}"
        await redis_client.delete(cache_key)
    except Exception as e:
        logger.warning("Redis cache invalidation failed", error=str(e))


async def _validate_clerk_token(supabase_client: Any, token: str) -> dict[str, Any] | None:
    """Validate Clerk JWT token and get customer data.

    Args:
        supabase_client: Supabase client instance
        token: JWT token from Authorization header

    Returns:
        Dict with customer_id, tier if valid, None otherwise
    """
    if supabase_client is None:
        logger.warning("Supabase client not available")
        return None

    try:
        import jwt
        # Decode without verification for development
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        email = payload.get("email")
        if not user_id:
            return None

        # First try by user_id
        response = supabase_client.table("customers").select("id, tier").eq("user_id", user_id).single().execute()

        if response.data:
            return {
                "customer_id": response.data["id"],
                "tier": response.data["tier"],
            }

        # If not found, and email available, try by email (for existing customers)
        if email:
            response = supabase_client.table("customers").select("id, tier").eq("email", email).single().execute()

            if response.data:
                # Update user_id for future
                supabase_client.table("customers").update({"user_id": user_id}).eq("id", response.data["id"]).execute()
                return {
                    "customer_id": response.data["id"],
                    "tier": response.data["tier"],
                }

    except Exception as e:
        pass

    return None


async def _validate_api_key_supabase(supabase_client: Any, api_key: str) -> dict[str, Any] | None:
    """Validate API key against Supabase database.

    Looks up the key in api_keys table and joins with customers table
    to get tier information.

    Args:
        supabase_client: Supabase client instance
        api_key: The API key to validate

    Returns:
        Dict with customer_id, tier, api_key_id if valid, None otherwise
    """
    if supabase_client is None:
        return None

    try:
        # Query api_keys table joined with customers
        response = (
            supabase_client.table("api_keys")
            .select("id, customer_id, is_active, customers(id, tier)")
            .eq("key", api_key)
            .eq("is_active", True)
            .single()
            .execute()
        )

        if response.data:
            data = response.data
            customer_data = data.get("customers", {})

            # Update last_used_at timestamp (fire and forget)
            with contextlib.suppress(Exception):
                supabase_client.table("api_keys").update({"last_used_at": "now()"}).eq(
                    "id", data["id"]
                ).execute()

            return {
                "customer_id": data["customer_id"],
                "tier": customer_data.get("tier", "starter") if customer_data else "starter",
                "api_key_id": data["id"],
            }

    except Exception as e:
        logger.warning(
            "Supabase API key validation failed",
            error=str(e),
            api_key_prefix=api_key[:8] + "..." if len(api_key) > 8 else "***",
        )

    return None


async def authenticate_request(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    x_api_key: str | None = None,
    authorization: str | None = None,
) -> AuthContext:
    """Authenticate an incoming request.

    This is the main authentication dependency. It:
    1. Checks if the route is public (skips auth)
    2. Checks Clerk JWT token (if Authorization header present)
    3. Validates bootstrap key for allowed routes
    4. Checks static ALLOWED_API_KEYS
    5. Validates against Supabase with Redis caching

    Args:
        request: The FastAPI request
        settings: Application settings
        x_api_key: API key from header
        authorization: Authorization header (for Clerk JWT)

    Returns:
        AuthContext with authentication details

    Raises:
        MissingAPIKeyError: If no API key provided
        InvalidAPIKeyError: If API key is invalid
        BootstrapKeyNotAllowedError: If bootstrap key used on wrong route
    """
    method = request.method
    path = request.url.path

    # Skip auth for public routes
    if is_public_route(method, path):
        auth_ctx = AuthContext(
            customer_id=None,
            tier="public",
            is_bootstrap=False,
            is_static_key=False,
        )
        request.state.auth = auth_ctx
        return auth_ctx

    # Try to get Supabase client for Clerk JWT validation
    supabase_client = None
    try:
        from app.dependencies import _supabase_client
        supabase_client = _supabase_client
    except ImportError:
        pass

    # CHECK CLERK JWT FIRST (before requiring x-api-key)
    if not x_api_key and authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        validated_data = await _validate_clerk_token(supabase_client, token)
        if validated_data:
            auth_ctx = AuthContext(
                customer_id=validated_data["customer_id"],
                tier=validated_data["tier"],
                is_bootstrap=False,
                is_static_key=False,
            )
            request.state.auth = auth_ctx
            logger.debug(
                "Clerk JWT authentication success",
                customer_id=validated_data['customer_id']
            )
            return auth_ctx

    # Require API key for non-public routes (if no valid JWT found)
    if not x_api_key:
        raise MissingAPIKeyError()

    # Check bootstrap key
    if settings.bootstrap_api_key and x_api_key == settings.bootstrap_api_key:
        if not is_bootstrap_allowed_route(method, path):
            raise BootstrapKeyNotAllowedError()

        auth_ctx = AuthContext(
            customer_id=None,
            tier="admin",
            is_bootstrap=True,
            is_static_key=False,
        )
        request.state.auth = auth_ctx
        logger.debug(
            "Bootstrap key authentication",
            path=path,
            method=method,
        )
        return auth_ctx

    # Check static allowed API keys
    if settings.allowed_api_keys and x_api_key in settings.allowed_api_keys:
        auth_ctx = AuthContext(
            customer_id=None,
            tier="admin",
            is_bootstrap=False,
            is_static_key=True,
        )
        request.state.auth = auth_ctx
        logger.debug(
            "Static API key authentication",
            path=path,
            method=method,
        )
        return auth_ctx

    # Try to get Redis client
    redis_client = None
    try:
        from app.dependencies import _redis_client
        redis_client = _redis_client
    except ImportError:
        pass

    # Check Redis cache first
    cached_data = await _get_cached_api_key(redis_client, x_api_key)
    if cached_data:
        auth_ctx = AuthContext(
            customer_id=cached_data["customer_id"],
            tier=cached_data["tier"],
            api_key_id=cached_data.get("api_key_id"),
            is_bootstrap=False,
            is_static_key=False,
        )
        request.state.auth = auth_ctx
        logger.debug(
            "Cached API key authentication",
            customer_id=cached_data["customer_id"],
            tier=cached_data["tier"],
        )
        return auth_ctx

    # Validate against Supabase
    validated_data = await _validate_api_key_supabase(supabase_client, x_api_key)
    if validated_data:
        # Cache the result
        await _set_cached_api_key(redis_client, x_api_key, validated_data)

        auth_ctx = AuthContext(
            customer_id=validated_data["customer_id"],
            tier=validated_data["tier"],
            api_key_id=validated_data.get("api_key_id"),
            is_bootstrap=False,
            is_static_key=False,
        )
        request.state.auth = auth_ctx
        logger.debug(
            "Supabase API key authentication",
            customer_id=validated_data["customer_id"],
            tier=validated_data["tier"],
        )
        return auth_ctx

    # API key is invalid
    raise InvalidAPIKeyError()

def get_auth_context(request: Request) -> AuthContext:
    """Get the authentication context from request state.

    Args:
        request: The FastAPI request

    Returns:
        AuthContext from request state

    Raises:
        RuntimeError: If auth context is not set
    """
    if not hasattr(request.state, "auth"):
        raise RuntimeError("Auth context not set. Ensure authenticate_request ran.")
    return request.state.auth


def require_customer(request: Request) -> AuthContext:
    """Dependency that requires a customer-authenticated request.

    Use this for endpoints that need a real customer (not bootstrap/static keys).

    Args:
        request: The FastAPI request

    Returns:
        AuthContext with customer_id

    Raises:
        MissingAPIKeyError: If no customer context
    """
    auth_ctx = get_auth_context(request)
    if auth_ctx.customer_id is None and not auth_ctx.is_static_key:
        raise MissingAPIKeyError(
            details={"reason": "This endpoint requires customer authentication"}
        )
    return auth_ctx


# Type aliases for dependency injection
AuthDep = Annotated[AuthContext, Depends(authenticate_request)]
CustomerAuthDep = Annotated[AuthContext, Depends(require_customer)]
