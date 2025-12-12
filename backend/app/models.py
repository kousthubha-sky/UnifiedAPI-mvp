"""Pydantic models for API requests and responses.

Defines data models for customers, API keys, and shared types that
mirror the TypeScript/Zod schemas from the original Fastify backend.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import Column, String, Boolean, TIMESTAMP, func, UUID, JSON, Text, Integer
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

# SQLAlchemy Models
class Organization(Base):
    """Organization model for multi-tenancy."""
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    clerk_id = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, unique=True, index=True)
    plan = Column(String(50), nullable=False, default="free")
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now(), onupdate=func.now())

class ServiceCredential(Base):
    """Service credentials model with environment support."""
    __tablename__ = "service_credentials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    service_name = Column(String(50), nullable=False)
    environment = Column(String(20), nullable=False, default="test")  # 'test' or 'prod'
    encrypted_data = Column(Text, nullable=False)  # JSON encrypted data
    features_config = Column(JSON, nullable=False, default=dict)
    enabled_webhook_events = Column(JSON, nullable=False, default=list)
    webhook_url = Column(String(2048))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        {'schema': None},  # Use default schema
    )

class ApiKey(Base):
    """API keys model."""
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    environment = Column(String(20), nullable=False, default="test")  # 'test' or 'prod'
    key_hash = Column(String(255), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    rate_limit_calls = Column(Integer, nullable=False, default=100)
    rate_limit_window = Column(Integer, nullable=False, default=60)  # seconds
    last_used_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    expired_at = Column(TIMESTAMP)

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
    user_id: str = Field(..., description="Clerk user ID")
    tier: CustomerTier = Field(
        default=CustomerTier.STARTER,
        description="Customer tier (defaults to starter)",
    )
    paypal_account_id: str | None = Field(
        default=None,
        description="Optional PayPal merchant ID",
    )


class UpdateCustomerRequest(BaseModel):
    """Request model for updating a customer."""

    email: EmailStr | None = Field(default=None, description="New email address")
    tier: CustomerTier | None = Field(default=None, description="New tier")
    paypal_account_id: str | None = Field(
        default=None,
        description="PayPal merchant ID",
    )


class CustomerResponse(BaseModel):
    """Response model for a customer."""

    id: str = Field(..., description="Customer UUID")
    email: str = Field(..., description="Customer email")
    tier: str = Field(..., description="Customer tier")
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
