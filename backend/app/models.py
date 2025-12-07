"""Pydantic models for API requests and responses.

Defines data models for customers, API keys, and shared types that
mirror the TypeScript/Zod schemas from the original Fastify backend.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, EmailStr, Field

# =============================================================================
# Customer Models
# =============================================================================


class CustomerTier(str, Enum):
    """Customer tier levels."""

    STARTER = "starter"
    GROWTH = "growth"
    SCALE = "scale"
    ADMIN = "admin"


class CreateCustomerRequest(BaseModel):
    """Request model for creating a customer."""

    email: EmailStr = Field(..., description="Customer's email address")
    tier: CustomerTier = Field(
        default=CustomerTier.STARTER,
        description="Customer tier (defaults to starter)",
    )
    stripe_account_id: str | None = Field(
        default=None,
        description="Optional Stripe connected account ID",
    )
    paypal_account_id: str | None = Field(
        default=None,
        description="Optional PayPal merchant ID",
    )


class UpdateCustomerRequest(BaseModel):
    """Request model for updating a customer."""

    email: EmailStr | None = Field(default=None, description="New email address")
    tier: CustomerTier | None = Field(default=None, description="New tier")
    stripe_account_id: str | None = Field(
        default=None,
        description="Stripe connected account ID",
    )
    paypal_account_id: str | None = Field(
        default=None,
        description="PayPal merchant ID",
    )


class CustomerResponse(BaseModel):
    """Response model for a customer."""

    id: str = Field(..., description="Customer UUID")
    email: str = Field(..., description="Customer email")
    tier: str = Field(..., description="Customer tier")
    stripe_account_id: str | None = Field(
        default=None,
        description="Stripe connected account ID",
    )
    paypal_account_id: str | None = Field(
        default=None,
        description="PayPal merchant ID",
    )
    created_at: str = Field(..., description="Creation timestamp (ISO 8601)")
    updated_at: str = Field(..., description="Last update timestamp (ISO 8601)")
    trace_id: str | None = Field(default=None, description="Request trace ID")


# =============================================================================
# API Key Models
# =============================================================================


class CreateApiKeyRequest(BaseModel):
    """Request model for creating an API key."""

    name: str | None = Field(
        default=None,
        max_length=255,
        description="Optional name for the API key",
    )
    customer_id: str | None = Field(
        default=None,
        description="Customer ID (required when using bootstrap key)",
    )


class ApiKeyAction(str, Enum):
    """Actions that can be performed on an API key."""

    REVOKE = "revoke"
    ROTATE = "rotate"


class UpdateApiKeyRequest(BaseModel):
    """Request model for updating an API key (revoke/rotate)."""

    action: ApiKeyAction = Field(..., description="Action to perform")
    name: str | None = Field(
        default=None,
        max_length=255,
        description="New name for the API key (optional)",
    )


class ApiKeyResponse(BaseModel):
    """Response model for an API key (without the key itself)."""

    id: str = Field(..., description="API key UUID")
    name: str | None = Field(default=None, description="API key name")
    is_active: bool = Field(..., description="Whether the key is active")
    last_used_at: str | None = Field(
        default=None,
        description="Last used timestamp (ISO 8601)",
    )
    created_at: str = Field(..., description="Creation timestamp (ISO 8601)")
    trace_id: str | None = Field(default=None, description="Request trace ID")


class CreateApiKeyResponse(BaseModel):
    """Response model for a newly created API key (includes the key)."""

    id: str = Field(..., description="API key UUID")
    key: str = Field(..., description="The API key (only shown once)")
    name: str | None = Field(default=None, description="API key name")
    is_active: bool = Field(..., description="Whether the key is active")
    created_at: str = Field(..., description="Creation timestamp (ISO 8601)")
    trace_id: str | None = Field(default=None, description="Request trace ID")


class RotateApiKeyResponse(BaseModel):
    """Response model for a rotated API key (includes new key)."""

    id: str = Field(..., description="API key UUID")
    key: str = Field(..., description="The new API key (only shown once)")
    name: str | None = Field(default=None, description="API key name")
    is_active: bool = Field(..., description="Whether the key is active")
    created_at: str = Field(..., description="Creation timestamp (ISO 8601)")
    trace_id: str | None = Field(default=None, description="Request trace ID")
    message: str = Field(
        default="API key rotated successfully",
        description="Status message",
    )


class ListApiKeysResponse(BaseModel):
    """Response model for listing API keys."""

    keys: list[ApiKeyResponse] = Field(..., description="List of API keys")
    total: int = Field(..., description="Total count of keys")
    trace_id: str | None = Field(default=None, description="Request trace ID")


class DeleteApiKeyResponse(BaseModel):
    """Response model for deleting an API key."""

    message: str = Field(..., description="Success message")
    trace_id: str | None = Field(default=None, description="Request trace ID")


class RevokeApiKeyResponse(BaseModel):
    """Response model for revoking an API key."""

    id: str = Field(..., description="API key UUID")
    is_active: bool = Field(default=False, description="Key is now inactive")
    message: str = Field(
        default="API key revoked successfully",
        description="Status message",
    )
    trace_id: str | None = Field(default=None, description="Request trace ID")


# =============================================================================
# List/Query Models
# =============================================================================


class PaginationParams(BaseModel):
    """Common pagination parameters."""

    limit: int = Field(default=10, ge=1, le=100, description="Maximum results")
    offset: int = Field(default=0, ge=0, description="Results to skip")


class ListCustomersResponse(BaseModel):
    """Response model for listing customers (admin only)."""

    customers: list[CustomerResponse] = Field(..., description="List of customers")
    total: int = Field(..., description="Total count")
    limit: int = Field(..., description="Current limit")
    offset: int = Field(..., description="Current offset")
    trace_id: str | None = Field(default=None, description="Request trace ID")


# =============================================================================
# Success/Message Models
# =============================================================================


class SuccessResponse(BaseModel):
    """Generic success response."""

    success: bool = Field(default=True, description="Operation succeeded")
    message: str = Field(..., description="Success message")
    trace_id: str | None = Field(default=None, description="Request trace ID")


# =============================================================================
# Helper Functions
# =============================================================================


def datetime_to_iso(dt: datetime | str | None) -> str:
    """Convert a datetime to ISO 8601 string.

    Args:
        dt: A datetime object, ISO string, or None.

    Returns:
        ISO 8601 formatted string.
    """
    if dt is None:
        return datetime.now().isoformat()
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


def parse_db_datetime(value: Any) -> str:
    """Parse a database datetime value to ISO string.

    Handles various formats that may come from Supabase.

    Args:
        value: The datetime value from the database.

    Returns:
        ISO 8601 formatted string.
    """
    if value is None:
        return datetime.now().isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, str):
        return value
    return str(value)
