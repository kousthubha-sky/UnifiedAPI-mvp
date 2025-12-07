"""API Key management routes.

Provides the REST API endpoints for API key management including
creation, listing, rotation, revocation, and deletion.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Request

from app.auth import AuthContext, _invalidate_cached_api_key, get_auth_context
from app.dependencies import get_redis, get_supabase
from app.errors import (
    ForbiddenError,
    InternalError,
    NotFoundError,
    ValidationError,
)
from app.logging import get_logger, get_trace_id
from app.models import (
    ApiKeyAction,
    ApiKeyResponse,
    CreateApiKeyRequest,
    CreateApiKeyResponse,
    DeleteApiKeyResponse,
    ListApiKeysResponse,
    RevokeApiKeyResponse,
    RotateApiKeyResponse,
    UpdateApiKeyRequest,
    parse_db_datetime,
)

logger = get_logger("api_keys.routes")

router = APIRouter(prefix="/api/v1/api-keys", tags=["api-keys"])

# API key prefix for identification
API_KEY_PREFIX = "pk_"


def _get_optional_supabase() -> Any:
    """Get Supabase client, returning None if not available."""
    try:
        return get_supabase()
    except RuntimeError:
        return None


def _get_optional_redis() -> Any:
    """Get Redis client, returning None if not available."""
    try:
        return get_redis()
    except RuntimeError:
        return None


def _generate_api_key() -> str:
    """Generate a secure API key.

    Returns:
        A secure random API key with prefix.
    """
    # Generate 32 bytes of random data (256 bits)
    random_bytes = secrets.token_hex(32)
    return f"{API_KEY_PREFIX}{random_bytes}"


def _hash_api_key(key: str) -> str:
    """Hash an API key for storage.

    Args:
        key: The plain API key.

    Returns:
        SHA-256 hash of the key.
    """
    return hashlib.sha256(key.encode()).hexdigest()


def _api_key_from_db(data: dict[str, Any]) -> ApiKeyResponse:
    """Convert database row to ApiKeyResponse."""
    return ApiKeyResponse(
        id=str(data["id"]),
        name=data.get("name"),
        is_active=data.get("is_active", True),
        last_used_at=parse_db_datetime(data.get("last_used_at"))
        if data.get("last_used_at")
        else None,
        created_at=parse_db_datetime(data.get("created_at")),
        trace_id=get_trace_id(),
    )


@router.post(
    "",
    response_model=CreateApiKeyResponse,
    status_code=201,
    summary="Generate API key",
    description=(
        "Generate a new API key for the authenticated customer. "
        "The key is only returned once - store it securely. "
        "When using the bootstrap key, a customer_id must be provided."
    ),
    responses={
        201: {"description": "API key created successfully"},
        400: {"description": "Invalid request"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Bootstrap key requires customer_id"},
    },
)
async def create_api_key(
    request: Request,
    body: CreateApiKeyRequest,
) -> CreateApiKeyResponse:
    """Create a new API key.

    Args:
        request: FastAPI request object.
        body: API key creation request body.

    Returns:
        CreateApiKeyResponse with the new API key (shown only once).
    """
    auth_ctx = get_auth_context(request)

    # Determine customer_id
    customer_id: str | None = None

    if auth_ctx.is_bootstrap:
        # Bootstrap key requires customer_id in request
        if not body.customer_id:
            raise ValidationError(
                message="customer_id is required when using bootstrap key",
                details={"hint": "Include customer_id in the request body"},
            )
        customer_id = body.customer_id
    elif auth_ctx.is_static_key:
        # Static admin keys can specify customer_id or error
        if not body.customer_id:
            raise ValidationError(
                message="customer_id is required for admin API key creation",
                details={"hint": "Include customer_id in the request body"},
            )
        customer_id = body.customer_id
    else:
        # Regular authenticated user - use their customer_id
        customer_id = auth_ctx.customer_id

    if not customer_id:
        raise ValidationError(
            message="Unable to determine customer for API key",
            details={"auth_type": "unknown"},
        )

    logger.info(
        "Creating API key",
        customer_id=customer_id,
        name=body.name,
        is_bootstrap=auth_ctx.is_bootstrap,
    )

    supabase = _get_optional_supabase()
    if supabase is None:
        raise InternalError(message="Database not available")

    try:
        # Verify customer exists
        customer_response = (
            supabase.table("customers").select("id").eq("id", customer_id).single().execute()
        )

        if not customer_response.data:
            raise NotFoundError(
                message="Customer not found",
                details={"customer_id": customer_id},
            )

        # Generate new API key
        api_key = _generate_api_key()
        key_hash = _hash_api_key(api_key)
        now = datetime.now(UTC).isoformat()

        insert_data = {
            "customer_id": customer_id,
            "key": api_key,
            "key_hash": key_hash,
            "name": body.name or "API Key",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }

        response = supabase.table("api_keys").insert(insert_data).execute()

        if not response.data or len(response.data) == 0:
            raise InternalError(message="Failed to create API key")

        key_data = response.data[0]
        logger.info(
            "API key created",
            api_key_id=key_data["id"],
            customer_id=customer_id,
        )

        return CreateApiKeyResponse(
            id=str(key_data["id"]),
            key=api_key,  # Return the actual key (only time it's shown)
            name=key_data.get("name"),
            is_active=True,
            created_at=parse_db_datetime(key_data.get("created_at")),
            trace_id=get_trace_id(),
        )

    except (ValidationError, NotFoundError):
        raise
    except InternalError:
        raise
    except Exception as e:
        logger.error("Failed to create API key", error=str(e))
        raise InternalError(
            message="Failed to create API key",
            details={"error": str(e)},
        ) from e


@router.get(
    "",
    response_model=ListApiKeysResponse,
    summary="List API keys",
    description="List all API keys for the authenticated customer.",
    responses={
        200: {"description": "API keys listed successfully"},
        401: {"description": "Missing or invalid API key"},
    },
)
async def list_api_keys(
    request: Request,
) -> ListApiKeysResponse:
    """List all API keys for the authenticated customer.

    Args:
        request: FastAPI request object.

    Returns:
        ListApiKeysResponse with the customer's API keys.
    """
    auth_ctx = get_auth_context(request)

    # Get customer_id
    customer_id = auth_ctx.customer_id

    # Admin/static keys can't list without a customer context
    if not customer_id and (auth_ctx.is_static_key or auth_ctx.is_bootstrap):
        raise ForbiddenError(
            message="Cannot list API keys without customer context",
            details={"hint": "Use a customer API key to list keys"},
        )

    if not customer_id:
        raise ValidationError(
            message="Unable to determine customer",
        )

    logger.info(
        "Listing API keys",
        customer_id=customer_id,
    )

    supabase = _get_optional_supabase()
    if supabase is None:
        raise InternalError(message="Database not available")

    try:
        response = (
            supabase.table("api_keys")
            .select("id, name, is_active, last_used_at, created_at")
            .eq("customer_id", customer_id)
            .order("created_at", desc=True)
            .execute()
        )

        keys = [_api_key_from_db(row) for row in (response.data or [])]

        return ListApiKeysResponse(
            keys=keys,
            total=len(keys),
            trace_id=get_trace_id(),
        )

    except Exception as e:
        logger.error("Failed to list API keys", error=str(e))
        raise InternalError(
            message="Failed to list API keys",
            details={"error": str(e)},
        ) from e


@router.patch(
    "/{api_key_id}",
    response_model=RevokeApiKeyResponse | RotateApiKeyResponse,
    summary="Update API key (revoke/rotate)",
    description=(
        "Update an API key. Supported actions:\n"
        "- `revoke`: Deactivate the key\n"
        "- `rotate`: Generate a new key (old key becomes invalid)"
    ),
    responses={
        200: {"description": "API key updated successfully"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Access denied"},
        404: {"description": "API key not found"},
    },
)
async def update_api_key(
    request: Request,
    api_key_id: str,
    body: UpdateApiKeyRequest,
) -> RevokeApiKeyResponse | RotateApiKeyResponse:
    """Update an API key (revoke or rotate).

    Args:
        request: FastAPI request object.
        api_key_id: The API key UUID.
        body: Update request body with action.

    Returns:
        RevokeApiKeyResponse or RotateApiKeyResponse depending on action.
    """
    auth_ctx = get_auth_context(request)

    logger.info(
        "Updating API key",
        api_key_id=api_key_id,
        action=body.action.value,
    )

    supabase = _get_optional_supabase()
    redis = _get_optional_redis()

    if supabase is None:
        raise InternalError(message="Database not available")

    try:
        # Get the API key and verify ownership
        key_response = (
            supabase.table("api_keys")
            .select("id, customer_id, key, name, is_active, created_at")
            .eq("id", api_key_id)
            .single()
            .execute()
        )

        if not key_response.data:
            raise NotFoundError(
                message="API key not found",
                details={"api_key_id": api_key_id},
            )

        key_data = key_response.data

        # Check authorization
        if not _can_access_api_key(auth_ctx, key_data["customer_id"]):
            raise ForbiddenError(
                message="You can only modify your own API keys",
                details={"api_key_id": api_key_id},
            )

        old_key = key_data.get("key")
        now = datetime.now(UTC).isoformat()

        if body.action == ApiKeyAction.REVOKE:
            # Revoke the key
            update_data = {
                "is_active": False,
                "updated_at": now,
            }

            supabase.table("api_keys").update(update_data).eq("id", api_key_id).execute()

            # Invalidate cache
            if old_key:
                await _invalidate_cached_api_key(redis, old_key)

            logger.info(
                "API key revoked",
                api_key_id=api_key_id,
            )

            return RevokeApiKeyResponse(
                id=api_key_id,
                is_active=False,
                message="API key revoked successfully",
                trace_id=get_trace_id(),
            )

        elif body.action == ApiKeyAction.ROTATE:
            # Generate new key
            new_api_key = _generate_api_key()
            new_key_hash = _hash_api_key(new_api_key)

            update_data = {
                "key": new_api_key,
                "key_hash": new_key_hash,
                "is_active": True,
                "updated_at": now,
            }

            if body.name:
                update_data["name"] = body.name

            response = supabase.table("api_keys").update(update_data).eq("id", api_key_id).execute()

            # Invalidate old key cache
            if old_key:
                await _invalidate_cached_api_key(redis, old_key)

            updated_data = response.data[0] if response.data else key_data

            logger.info(
                "API key rotated",
                api_key_id=api_key_id,
            )

            return RotateApiKeyResponse(
                id=api_key_id,
                key=new_api_key,  # Return new key (only time it's shown)
                name=updated_data.get("name"),
                is_active=True,
                created_at=parse_db_datetime(updated_data.get("created_at")),
                message="API key rotated successfully",
                trace_id=get_trace_id(),
            )

        else:
            raise ValidationError(
                message=f"Unknown action: {body.action}",
                details={"valid_actions": ["revoke", "rotate"]},
            )

    except (NotFoundError, ForbiddenError, ValidationError):
        raise
    except Exception as e:
        logger.error("Failed to update API key", error=str(e))
        raise InternalError(
            message="Failed to update API key",
            details={"error": str(e)},
        ) from e


@router.delete(
    "/{api_key_id}",
    response_model=DeleteApiKeyResponse,
    summary="Delete API key",
    description="Permanently delete an API key.",
    responses={
        200: {"description": "API key deleted successfully"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Access denied"},
        404: {"description": "API key not found"},
    },
)
async def delete_api_key(
    request: Request,
    api_key_id: str,
) -> DeleteApiKeyResponse:
    """Delete an API key.

    Args:
        request: FastAPI request object.
        api_key_id: The API key UUID.

    Returns:
        DeleteApiKeyResponse with success message.
    """
    auth_ctx = get_auth_context(request)

    logger.info(
        "Deleting API key",
        api_key_id=api_key_id,
    )

    supabase = _get_optional_supabase()
    redis = _get_optional_redis()

    if supabase is None:
        raise InternalError(message="Database not available")

    try:
        # Get the API key and verify ownership
        key_response = (
            supabase.table("api_keys")
            .select("id, customer_id, key")
            .eq("id", api_key_id)
            .single()
            .execute()
        )

        if not key_response.data:
            raise NotFoundError(
                message="API key not found",
                details={"api_key_id": api_key_id},
            )

        key_data = key_response.data

        # Check authorization
        if not _can_access_api_key(auth_ctx, key_data["customer_id"]):
            raise ForbiddenError(
                message="You can only delete your own API keys",
                details={"api_key_id": api_key_id},
            )

        old_key = key_data.get("key")

        # Delete the key
        supabase.table("api_keys").delete().eq("id", api_key_id).execute()

        # Invalidate cache
        if old_key:
            await _invalidate_cached_api_key(redis, old_key)

        logger.info(
            "API key deleted",
            api_key_id=api_key_id,
        )

        return DeleteApiKeyResponse(
            message="API key deleted successfully",
            trace_id=get_trace_id(),
        )

    except (NotFoundError, ForbiddenError):
        raise
    except Exception as e:
        logger.error("Failed to delete API key", error=str(e))
        raise InternalError(
            message="Failed to delete API key",
            details={"error": str(e)},
        ) from e


def _can_access_api_key(auth_ctx: AuthContext, key_customer_id: str) -> bool:
    """Check if the authenticated user can access an API key.

    Args:
        auth_ctx: Authentication context.
        key_customer_id: The customer ID that owns the key.

    Returns:
        True if access is allowed.
    """
    # Admins and static key users can access any key
    if auth_ctx.tier == "admin" or auth_ctx.is_static_key:
        return True

    # Users can only access their own keys
    return auth_ctx.customer_id == key_customer_id
